// Shared UI pieces: navbar, status badge, status tracker, funnel chart, toast and modal.

import { ROLE, ROLE_LABELS, STATUS } from '../logic/constants.js';
import { esc, html } from './dom.js';

const { WAITLISTED, UNDER_REVIEW, ON_HOLD, APPROVED, REJECTED, ONBOARDING, ACTIVATED } = STATUS;

const STATUS_META = {
  [WAITLISTED]: { className: 'status-waitlisted', icon: '○' },
  [UNDER_REVIEW]: { className: 'status-under-review', icon: '◐' },
  [ON_HOLD]: { className: 'status-on-hold', icon: '‖' },
  [APPROVED]: { className: 'status-approved', icon: '✓' },
  [REJECTED]: { className: 'status-rejected', icon: '✕' },
  [ONBOARDING]: { className: 'status-onboarding', icon: '▸' },
  [ACTIVATED]: { className: 'status-activated', icon: '★' },
};

export function statusBadge(status) {
  const meta = STATUS_META[status];
  return html`<span class="status-badge ${meta.className}"><span aria-hidden="true">${meta.icon}</span>${status}</span>`;
}

const NAV_LINKS = {
  [ROLE.VISITOR]: [['#/', 'Join the waitlist'], ['#/login', 'Demo login'], ['#/settings', 'Settings']],
  [ROLE.PROSPECT]: [['#/status', 'My status'], ['#/onboarding', 'Onboarding'], ['#/settings', 'Settings']],
  [ROLE.APPROVER]: [['#/queue', 'Approval queue'], ['#/audit', 'Audit trail'], ['#/settings', 'Settings']],
  [ROLE.FOUNDER]: [['#/dashboard', 'Dashboard'], ['#/audit', 'Audit trail'], ['#/settings', 'Settings']],
};

const GATE_ICON = html`<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#0f6f6a"/><path d="M9 25V10a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v15" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M16 13v12" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;

export function navbar(actor, activeHash, prospectName) {
  const links = NAV_LINKS[actor.role] ?? NAV_LINKS[ROLE.VISITOR];
  const activeBase = activeHash.split('?')[0];
  const isActive = (href) =>
    href === activeBase || (href !== '#/' && activeBase.startsWith(`${href}/`));
  return html`
    <nav class="navbar navbar-expand-md lg-navbar" aria-label="Main">
      <div class="container-xl">
        <a class="lg-brand text-decoration-none" href="#/">${GATE_ICON}<span>LaunchGate</span></a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav-links"
          aria-controls="nav-links" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="nav-links">
          <ul class="navbar-nav me-auto ms-md-3">
            ${links.map(([href, label]) => html`
              <li class="nav-item">
                <a class="nav-link ${isActive(href) ? 'active' : ''}" href="${href}"
                  ${isActive(href) ? html`aria-current="page"` : ''}>${label}</a>
              </li>`)}
          </ul>
          <div class="d-flex align-items-center gap-3 py-2 py-md-0">
            <span class="role-chip">Viewing as <strong>${prospectName ?? ROLE_LABELS[actor.role]}</strong></span>
            <a class="btn btn-sm btn-outline-secondary" href="#/login">Switch role</a>
          </div>
        </div>
      </div>
    </nav>`;
}

// Hold and rejection branch off at the review stage rather than adding stages.
const TRACK = [WAITLISTED, UNDER_REVIEW, APPROVED, ONBOARDING, ACTIVATED];

export function statusTracker(entry) {
  const status = entry.status;
  const branched = status === ON_HOLD || status === REJECTED;
  const currentIndex = branched ? 1 : TRACK.indexOf(status);
  const finished = status === ACTIVATED;

  return html`
    <ol class="stepper" aria-label="Funnel stage">
      ${TRACK.map((stage, index) => {
        const label = index === 1 && branched ? status : stage;
        const isCurrent = index === currentIndex;
        const isDone = index < currentIndex || (finished && isCurrent);
        const classes = [
          isDone && 'is-done',
          isCurrent && !finished && 'is-current',
          isCurrent && status === REJECTED && 'is-stopped',
          isCurrent && status === ON_HOLD && 'is-paused',
        ].filter(Boolean).join(' ');
        let mark = String(index + 1);
        if (isDone) mark = '✓';
        else if (isCurrent && status === REJECTED) mark = '✕';
        else if (isCurrent && status === ON_HOLD) mark = '‖';
        let state = 'upcoming';
        if (isDone) state = 'complete';
        if (isCurrent) state = 'current stage';
        return html`
          <li class="${classes}" ${isCurrent ? html`aria-current="step"` : ''}>
            <span class="dot" aria-hidden="true">${mark}</span>
            <span>${label}<span class="visually-hidden"> (${state})</span></span>
          </li>`;
      })}
    </ol>`;
}

export function funnelChart(rows) {
  const top = rows[0]?.count ?? 0;
  return html`
    <ol class="funnel-chart">
      ${rows.map((row, index) => html`
        <li>
          <div class="funnel-row-head">
            <span>${row.label}</span>
            <span>
              <span class="value">${row.count}</span>
              ${index > 0 ? html`<span class="conversion"> · ${row.conversionFromPrevious}% of previous, ${row.dropOff} dropped</span>` : ''}
            </span>
          </div>
          <div class="funnel-track" aria-hidden="true">
            <div class="funnel-bar" style="width: ${top === 0 ? 0 : (row.count / top) * 100}%"></div>
          </div>
        </li>`)}
    </ol>`;
}

export function capacityMeter(batch) {
  const percent = batch.capacity === 0 ? 0 : Math.round((batch.used / batch.capacity) * 100);
  return html`
    <div class="d-flex justify-content-between align-items-baseline flex-wrap gap-2 mb-2">
      <div>
        <h2 class="mb-0">Seats in ${batch.label}</h2>
        <div class="text-secondary small">${batch.used} of ${batch.capacity} used</div>
      </div>
      <div class="seats-figure">${batch.left} ${batch.left === 1 ? 'seat' : 'seats'} left</div>
    </div>
    <div class="progress" role="progressbar" aria-label="Seats used in ${batch.label}"
      aria-valuenow="${batch.used}" aria-valuemin="0" aria-valuemax="${batch.capacity}">
      <div class="progress-bar" style="width: ${percent}%"></div>
    </div>`;
}

export function showToast(message, severity = 'success') {
  const container = document.getElementById('toasts');
  const isError = severity === 'error';
  const el = document.createElement('div');
  el.className = `toast align-items-center border-0 text-bg-${isError ? 'danger' : 'dark'}`;
  el.setAttribute('role', isError ? 'alert' : 'status');
  el.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${esc(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>`;
  container.append(el);
  const toast = new window.bootstrap.Toast(el, { delay: isError ? 8000 : 4500 });
  el.addEventListener('hidden.bs.toast', () => {
    toast.dispose();
    el.remove();
  });
  toast.show();
}

let modalCount = 0;

/**
 * Opens a confirm dialog with a form inside. onConfirm receives the dialog element
 * and returns false to stay open, for example to show a field error.
 */
export function openModal({ title, body, confirmLabel, confirmClass = 'btn-primary', onConfirm }) {
  modalCount += 1;
  const titleId = `modal-title-${modalCount}`;
  const trigger = document.activeElement;
  const el = document.createElement('div');
  el.className = 'modal fade';
  el.tabIndex = -1;
  el.setAttribute('aria-labelledby', titleId);
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('role', 'dialog');
  el.innerHTML = String(html`
    <div class="modal-dialog modal-dialog-centered">
      <form class="modal-content" novalidate>
        <div class="modal-header">
          <h2 class="modal-title" id="${titleId}">${title}</h2>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cancel"></button>
        </div>
        <div class="modal-body">${body}</div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="submit" class="btn ${confirmClass}">${confirmLabel}</button>
        </div>
      </form>
    </div>`);
  document.body.append(el);

  const modal = new window.bootstrap.Modal(el);
  el.querySelector('form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (onConfirm(el) !== false) modal.hide();
  });
  el.addEventListener('shown.bs.modal', () => {
    (el.querySelector('textarea, input') ?? el.querySelector('[type="submit"]')).focus();
  });
  el.addEventListener('hidden.bs.modal', () => {
    modal.dispose();
    el.remove();
    if (trigger?.isConnected) trigger.focus();
    else document.getElementById('view')?.focus();
  });
  modal.show();
}
