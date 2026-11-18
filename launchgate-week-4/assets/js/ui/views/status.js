// My Status: funnel stage, queue position, invite box and next step.

import { INVITE_VALID_DAYS, STATUS } from '../../logic/constants.js';
import { getEntry, queuePosition } from '../../logic/funnelService.js';
import { activeInvite, isExpired, redeemInvite } from '../../logic/inviteService.js';
import { checklistProgress } from '../../logic/onboardingService.js';
import { ERR } from '../../logic/errors.js';
import { formatDate, html } from '../dom.js';
import { statusBadge, statusTracker } from '../components.js';
import { readForm, showFieldErrors, textField } from '../forms.js';

const { WAITLISTED, UNDER_REVIEW, ON_HOLD, APPROVED, REJECTED, ONBOARDING, ACTIVATED } = STATUS;

const WAITING_COPY = {
  [WAITLISTED]: 'You are in line. Next, an operations approver reviews your request. There is nothing you need to do yet.',
  [UNDER_REVIEW]: 'An operations approver is looking at your request now. You will see the decision here.',
};

function invitePanel(invite) {
  const expired = isExpired(invite);
  return html`
    <section class="lg-card mt-3" aria-labelledby="invite-heading">
      <h2 id="invite-heading">Redeem your invite</h2>
      <div class="invite-notice mb-3">
        <p class="small fw-semibold mb-1">Simulated invitation (no real email was sent)</p>
        <p class="mb-1">You're approved. Your invite code is <span class="invite-code">${invite.code}</span></p>
        <p class="small mb-0">${expired ? `This code expired on ${formatDate(invite.expiresAt)}.` : `It works once and expires on ${formatDate(invite.expiresAt)}.`}</p>
      </div>
      ${expired ? html`
        <div class="alert alert-warning" role="alert">Your code has expired. Your seat is still held, so ask the operations team to send a new one.</div>` : ''}
      <form id="redeem-form" novalidate>
        ${textField({ id: 'code', label: 'Invite code', autocomplete: 'off', help: 'Enter the code exactly as it appears in your invitation.' })}
        <button type="submit" class="btn btn-primary mt-3">Redeem code</button>
      </form>
    </section>`;
}

function nextStep(state, entry) {
  const { status } = entry;
  if (WAITING_COPY[status]) return html`<p class="mb-0">${WAITING_COPY[status]}</p>`;
  if (status === ON_HOLD) {
    return html`<p class="mb-0">Your request is on hold for now, so you are out of the line until the team looks at it again. There is nothing you need to do.</p>`;
  }
  if (status === REJECTED) {
    return html`<p class="mb-0">We can't offer you a place in this launch. This decision is final for this waitlist entry.</p>`;
  }
  if (status === APPROVED) {
    return html`<p class="mb-0">Enter your invite code below, within ${INVITE_VALID_DAYS} days of receiving it, to start onboarding.</p>`;
  }
  if (status === ONBOARDING) {
    const progress = checklistProgress(state, entry.entryId);
    return html`
      <p>You've finished ${progress.done} of ${progress.total} onboarding steps.</p>
      <a class="btn btn-primary" href="#/onboarding">Continue onboarding</a>`;
  }
  return html`
    <p>You're all set, and your workspace is ready to use.</p>
    <a class="btn btn-outline-primary" href="#/onboarding">View your welcome screen</a>`;
}

export const statusView = {
  screen: 'status',
  title: 'My status',

  render({ state, actor }) {
    const entry = getEntry(state, actor.entryId);
    const position = queuePosition(state.entries, entry.entryId);
    const invite = entry.status === APPROVED ? activeInvite(state, entry.entryId) : null;
    const showFigure = position !== null;
    return html`
      <div class="page-head">
        <h1>My status</h1>
        <p>${entry.name}, ${entry.company}</p>
      </div>
      <section class="lg-card mb-3" aria-labelledby="stage-heading">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <h2 class="mb-0" id="stage-heading">Current stage</h2>
          ${statusBadge(entry.status)}
        </div>
        ${statusTracker(entry)}
      </section>
      <div class="row g-3">
        ${showFigure ? html`
          <div class="col-12 col-md-4">
            <section class="lg-card h-100" aria-labelledby="position-heading">
              <h2 id="position-heading">Queue position</h2>
              <p class="position-figure mb-1">#${position}</p>
              <p class="text-secondary small mb-0">Based on when you joined, oldest first.</p>
            </section>
          </div>` : ''}
        <div class="col-12 ${showFigure ? 'col-md-8' : ''}">
          <section class="lg-card h-100" aria-labelledby="next-heading">
            <h2 id="next-heading">What happens next</h2>
            ${nextStep(state, entry)}
          </section>
        </div>
      </div>
      ${invite ? invitePanel(invite) : ''}`;
  },

  mount(root, ctx) {
    const form = root.querySelector('#redeem-form');
    if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = redeemInvite(ctx.actor.entryId, readForm(form).code, ctx.actor);
      if (result.ok) {
        ctx.toast('Code redeemed. Welcome to onboarding.');
        ctx.navigate('#/onboarding');
        return;
      }
      const fields = result.fields ?? (result.code === ERR.STORAGE || result.code === ERR.FORBIDDEN ? {} : { code: result.message });
      if (!showFieldErrors(form, fields)) ctx.toast(result.message, 'error');
    });
  },
};
