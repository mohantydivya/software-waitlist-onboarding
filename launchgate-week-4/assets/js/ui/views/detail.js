// Prospect Detail and Decision.

import { STATUS } from '../../logic/constants.js';
import { allowedTargets, queuePosition, startReview } from '../../logic/funnelService.js';
import { approve, hold, reject } from '../../logic/approvalService.js';
import { activeInvite, isExpired, reissueInvite } from '../../logic/inviteService.js';
import { batchSummaries, getBatch } from '../../logic/metrics.js';
import { listAudit } from '../../logic/audit.js';
import { html, formatDate, formatDateTime } from '../dom.js';
import { openModal, statusBadge, statusTracker } from '../components.js';
import { showFieldErrors, textareaField } from '../forms.js';
import { auditItem } from './audit.js';

const { UNDER_REVIEW, ON_HOLD, APPROVED, REJECTED } = STATUS;

const DECISION_UI = {
  approve: { title: 'Approve this prospect?', confirm: 'Approve and send invite', confirmClass: 'btn-primary', service: approve, success: 'Decision saved. Invite code issued.' },
  hold: { title: 'Put this prospect on hold?', confirm: 'Put on hold', confirmClass: 'btn-primary', service: hold, success: 'Decision saved. Prospect put on hold.' },
  reject: { title: 'Reject this prospect?', confirm: 'Reject prospect', confirmClass: 'btn-danger', service: reject, success: 'Decision saved. Prospect rejected.' },
};

function decisionPanel(entry, batch) {
  const targets = allowedTargets(entry.status);
  const decidable = targets.includes(APPROVED) && targets.includes(REJECTED);
  if (!decidable) {
    const reason = entry.status === REJECTED || entry.status === STATUS.ACTIVATED
      ? `${entry.status} is a final stage, so no more decisions can be made.`
      : `This prospect is ${entry.status}. The next move is theirs, so no decision is needed.`;
    return html`<h2>Decision</h2><p class="mb-0">${reason}</p>`;
  }

  const noSeats = !batch || batch.left <= 0;
  return html`
    <h2>Decision</h2>
    ${targets.includes(UNDER_REVIEW) ? html`
      <button type="button" class="btn btn-outline-primary w-100 mb-2" id="start-review">Start review</button>` : ''}
    <button type="button" class="btn btn-primary w-100 mb-2" data-decision="approve"
      ${noSeats ? html`disabled aria-describedby="no-seats-help"` : ''}>${noSeats ? 'No seats left' : 'Approve'}</button>
    ${noSeats ? html`
      <p class="small text-secondary" id="no-seats-help">The current batch has no seats left. Put this prospect on hold, or ask the Founder to raise capacity.</p>` : ''}
    ${targets.includes(ON_HOLD) ? html`
      <button type="button" class="btn btn-outline-secondary w-100 mb-2" data-decision="hold">Put on hold</button>` : ''}
    <button type="button" class="btn btn-outline-danger w-100" data-decision="reject">Reject</button>`;
}

function invitePanel(entry, invite) {
  if (!invite) return '';
  const expired = !invite.usedAt && isExpired(invite);
  let state = `Expires on ${formatDate(invite.expiresAt)}`;
  if (invite.usedAt) state = `Redeemed on ${formatDate(invite.usedAt)}`;
  else if (expired) state = `Expired on ${formatDate(invite.expiresAt)}`;
  return html`
    <section class="lg-card mt-3" aria-labelledby="invite-heading">
      <h2 id="invite-heading">Invitation</h2>
      <div class="invite-notice">
        <p class="small fw-semibold mb-1">Simulated invitation to ${entry.email}</p>
        <p class="mb-1"><span class="invite-code">${invite.code}</span></p>
        <p class="small mb-0">${state}</p>
      </div>
      ${expired && entry.status === APPROVED ? html`
        <button type="button" class="btn btn-outline-primary w-100 mt-3" id="reissue">Reissue invite code</button>
        <p class="small text-secondary mt-2 mb-0">The new code replaces the expired one, which stops working.</p>` : ''}
    </section>`;
}

function decisionBody(entry, kind, batch) {
  const isApprove = kind === 'approve';
  return html`
    <dl class="row mb-3 detail-list">
      <dt class="col-4">Prospect</dt><dd class="col-8">${entry.name}, ${entry.company}</dd>
      <dt class="col-4">Decision</dt><dd class="col-8">${DECISION_UI[kind].confirm}</dd>
      ${isApprove && batch ? html`
        <dt class="col-4">Seats left</dt><dd class="col-8">${batch.left} now, ${batch.left - 1} after this approval (${batch.label})</dd>` : ''}
    </dl>
    ${textareaField({
      id: 'decision-note',
      name: 'note',
      label: 'Note',
      required: !isApprove,
      help: isApprove ? 'Saved to the audit trail.' : 'At least 10 characters. Saved to the audit trail.',
    })}`;
}

export const detailView = {
  screen: 'detail',
  title: 'Prospect detail',

  render({ state, params }) {
    const entry = state.entries.find((candidate) => candidate.entryId === params.id);
    if (!entry) {
      return html`
        <section class="lg-card empty-state">
          <h1>Prospect not found</h1>
          <p>This prospect may have been removed by a data reset.</p>
          <a class="btn btn-primary" href="#/queue">Back to the queue</a>
        </section>`;
    }

    const batch = batchSummaries(state).find((summary) => summary.isCurrent);
    const position = queuePosition(state.entries, entry.entryId);
    const entryBatch = getBatch(state, entry.batchId);
    const history = listAudit(state, { entryId: entry.entryId });

    return html`
      <p><a href="#/queue"><span aria-hidden="true">←</span> Back to the queue</a></p>
      <div class="page-head d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h1 class="mb-0">${entry.name}</h1>
          <p>${entry.jobTitle}, ${entry.company}</p>
        </div>
        ${statusBadge(entry.status)}
      </div>
      <section class="lg-card mb-3" aria-label="Funnel stage">${statusTracker(entry)}</section>
      <div class="row g-3">
        <div class="col-12 col-lg-8 order-2 order-lg-1">
          <section class="lg-card" aria-labelledby="profile-heading">
            <h2 id="profile-heading">Profile</h2>
            <dl class="row mb-0 detail-list">
              <div class="col-12 col-sm-6"><dt>Work email</dt><dd>${entry.email}</dd></div>
              <div class="col-12 col-sm-6"><dt>Company size</dt><dd>${entry.companySize} people</dd></div>
              <div class="col-12 col-sm-6"><dt>Intended use</dt><dd>${entry.useCase}</dd></div>
              <div class="col-12 col-sm-6"><dt>Joined</dt><dd>${formatDateTime(entry.createdAt)}</dd></div>
              <div class="col-12 col-sm-6"><dt>Queue position</dt><dd>${position === null ? 'Not in line' : `#${position}`}</dd></div>
              <div class="col-12 col-sm-6"><dt>Launch batch</dt><dd>${entryBatch?.label ?? 'Not assigned'}</dd></div>
            </dl>
          </section>
          <section class="lg-card mt-3" aria-labelledby="history-heading">
            <h2 id="history-heading">History</h2>
            <ol class="audit-list">${history.map((event) => auditItem(event))}</ol>
          </section>
        </div>
        <div class="col-12 col-lg-4 order-1 order-lg-2">
          <section class="lg-card" id="decision-panel">${decisionPanel(entry, batch)}</section>
          ${invitePanel(entry, activeInvite(state, entry.entryId))}
        </div>
      </div>`;
  },

  mount(root, ctx) {
    const { state, actor, params } = ctx;
    const entry = state.entries.find((candidate) => candidate.entryId === params.id);
    if (!entry) return;

    const report = (result, success) => {
      if (result.ok) ctx.toast(success);
      else ctx.toast(result.message, 'error');
      ctx.refresh();
    };

    root.querySelector('#start-review')?.addEventListener('click', () => {
      report(startReview(entry.entryId, actor), 'Review started.');
    });

    root.querySelector('#reissue')?.addEventListener('click', () => {
      report(reissueInvite(entry.entryId, actor), 'A new invite code was issued.');
    });

    root.querySelectorAll('[data-decision]').forEach((button) => {
      button.addEventListener('click', () => {
        const kind = button.dataset.decision;
        const ui = DECISION_UI[kind];
        const batch = batchSummaries(ctx.state).find((summary) => summary.isCurrent);
        openModal({
          title: ui.title,
          body: decisionBody(entry, kind, batch),
          confirmLabel: ui.confirm,
          confirmClass: ui.confirmClass,
          onConfirm: (dialog) => {
            const form = dialog.querySelector('form');
            const result = ui.service(entry.entryId, form.elements.note.value, actor);
            if (!result.ok && result.fields) {
              showFieldErrors(form, result.fields);
              return false;
            }
            report(result, ui.success);
            return true;
          },
        });
      });
    });
  },
};
