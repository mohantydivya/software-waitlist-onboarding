// App shell: hash router, session, cross-tab refresh and the console API.

import { ERR, LaunchError } from './logic/errors.js';
import { ROLE } from './logic/constants.js';
import { canAccessScreen, logBlockedScreen } from './logic/roleGuard.js';
import { DATA_KEY, readState, resetState } from './logic/storage.js';
import { approve, hold, reject, setCapacity } from './logic/approvalService.js';
import { startReview } from './logic/funnelService.js';
import { redeemInvite, reissueInvite } from './logic/inviteService.js';
import { completeStep } from './logic/onboardingService.js';
import { announce } from './ui/dom.js';
import { navbar, showToast } from './ui/components.js';
import { resolveActor, setSession } from './ui/session.js';
import { landingView } from './ui/views/landing.js';
import { loginView } from './ui/views/login.js';
import { statusView } from './ui/views/status.js';
import { onboardingView } from './ui/views/onboarding.js';
import { queueView, resetQueueFilters } from './ui/views/queue.js';
import { detailView } from './ui/views/detail.js';
import { dashboardView } from './ui/views/dashboard.js';
import { auditView } from './ui/views/audit.js';
import { settingsView, storageErrorScreen, unauthorizedScreen } from './ui/views/settings.js';

const viewEl = document.getElementById('view');
const navEl = document.getElementById('navbar');

function matchRoute(path) {
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return { view: landingView, params: {} };
  const staticRoutes = {
    login: loginView,
    status: statusView,
    onboarding: onboardingView,
    queue: queueView,
    dashboard: dashboardView,
    audit: auditView,
    settings: settingsView,
  };
  if (parts[0] === 'queue' && parts[1]) return { view: detailView, params: { id: parts[1] } };
  return { view: staticRoutes[parts[0]] ?? landingView, params: {} };
}

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, queryString = ''] = raw.split('?');
  return { path, query: new URLSearchParams(queryString), ...matchRoute(path) };
}

function navigate(hash) {
  if (window.location.hash === hash) render({ isNavigation: true });
  else window.location.hash = hash;
}

function renderNavbar(actor, state) {
  const prospectName = actor.entryId
    ? state.entries.find((entry) => entry.entryId === actor.entryId)?.name
    : null;
  const markup = String(navbar(actor, window.location.hash || '#/', prospectName));
  // Leave it alone when nothing changed, so an open menu or focused link survives a refresh.
  if (navEl.dataset.markup !== markup) {
    navEl.innerHTML = markup;
    navEl.dataset.markup = markup;
  }
}

function snapshotControls() {
  const values = {};
  viewEl.querySelectorAll('input[id], select[id], textarea[id]').forEach((control) => {
    values[control.id] = control.type === 'checkbox' ? control.checked : control.value;
  });
  return { values, focusId: viewEl.contains(document.activeElement) ? document.activeElement.id : '' };
}

function restoreControls({ values, focusId }) {
  Object.entries(values).forEach(([id, value]) => {
    const control = document.getElementById(id);
    if (!control || !viewEl.contains(control)) return;
    if (control.type === 'checkbox') control.checked = value;
    else control.value = value;
  });
  if (focusId) document.getElementById(focusId)?.focus();
}

function renderStorageError(message) {
  navEl.innerHTML = '';
  navEl.dataset.markup = '';
  viewEl.innerHTML = String(storageErrorScreen(message));
  viewEl.querySelector('#storage-reset').addEventListener('click', resetData);
  document.title = 'Storage error · LaunchGate';
}

function resetData() {
  try {
    const actor = (() => {
      try {
        return resolveActor(readState());
      } catch {
        return { role: ROLE.VISITOR };
      }
    })();
    const state = resetState(actor);
    resetQueueFilters();
    if (resolveActor(state).role !== actor.role) setSession({ role: ROLE.VISITOR });
    showToast('Sample data has been reset.');
    render();
  } catch (err) {
    if (!(err instanceof LaunchError)) throw err;
    renderStorageError(err.message);
  }
}

/**
 * @param {object} options
 * @param {boolean} options.isNavigation a real route change: moves focus for keyboard users
 * @param {boolean} options.logRefusal record a refused screen; a plain redraw must not log it again
 * @param {boolean} options.preserve keep typed values, for refreshes the user did not ask for
 */
function render({ isNavigation = false, logRefusal = isNavigation, preserve = false } = {}) {
  try {
    const route = parseHash();
    const snapshot = preserve ? snapshotControls() : null;
    const state = readState();
    const actor = resolveActor(state);
    renderNavbar(actor, state);

    if (!canAccessScreen(actor.role, route.view.screen)) {
      if (logRefusal) logBlockedScreen(actor, route.view.screen, route.params.id ?? null);
      viewEl.innerHTML = String(unauthorizedScreen(actor));
      document.title = 'Unauthorized · LaunchGate';
    } else {
      const ctx = {
        state,
        actor,
        params: route.params,
        query: route.query,
        refresh: render,
        refreshNavbar: () => {
          const latest = readState();
          renderNavbar(resolveActor(latest), latest);
        },
        navigate,
        setSession,
        resetData,
        toast: showToast,
      };
      viewEl.innerHTML = String(route.view.render(ctx));
      route.view.mount?.(viewEl, ctx);
      document.title = `${route.view.title} · LaunchGate`;
    }

    if (snapshot) restoreControls(snapshot);
    if (isNavigation) {
      window.scrollTo(0, 0);
      viewEl.focus({ preventScroll: true });
      announce(document.title);
    }
  } catch (err) {
    if (!(err instanceof LaunchError)) throw err;
    if (err.code === ERR.STORAGE) renderStorageError(err.message);
    else {
      showToast(err.message, 'error');
      // The prospect behind this session is gone or unusable, so start again.
      setSession({ role: ROLE.VISITOR });
      navigate('#/login');
    }
  }
}

/** Callable from the browser console. Runs as the current role, through the same guard. */
function exposeConsoleApi() {
  const currentActor = () => resolveActor(readState());
  const call = (fn) => {
    const result = fn(currentActor());
    if (!result.ok) showToast(result.message, 'error');
    render({ preserve: true });
    return result;
  };
  window.launchgate = {
    whoami: currentActor,
    startReview: (entryId) => call((actor) => startReview(entryId, actor)),
    approve: (entryId, note = '') => call((actor) => approve(entryId, note, actor)),
    reject: (entryId, note = '') => call((actor) => reject(entryId, note, actor)),
    hold: (entryId, note = '') => call((actor) => hold(entryId, note, actor)),
    reissue: (entryId) => call((actor) => reissueInvite(entryId, actor)),
    redeem: (code) => call((actor) => redeemInvite(actor.entryId, code, actor)),
    completeStep: (stepId, data) => call((actor) => completeStep(actor.entryId, stepId, data, actor)),
    setCapacity: (batchId, value) => call((actor) => setCapacity(batchId, value, actor)),
  };
}

window.addEventListener('hashchange', () => render({ isNavigation: true }));

// Another tab changed the data: redraw from storage without losing what's been typed here.
window.addEventListener('storage', (event) => {
  if (event.key === DATA_KEY || event.key === null) render({ preserve: true });
});

document.getElementById('skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  viewEl.focus();
});

exposeConsoleApi();
render({ logRefusal: true });
