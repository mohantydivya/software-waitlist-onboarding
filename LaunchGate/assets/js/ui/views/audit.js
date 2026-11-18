// Audit Trail: read-only, newest first, with filters.

import { ROLE, ROLE_LABELS } from '../../logic/constants.js';
import { listAudit } from '../../logic/audit.js';
import { formatDateTime, html } from '../dom.js';
import { selectField } from '../forms.js';

const ACTION_LABELS = {
  'entry.join': 'Joined the waitlist',
  'entry.review': 'Started review',
  'entry.approve': 'Approve',
  'entry.reject': 'Reject',
  'entry.hold': 'Put on hold',
  'status.change': 'Status changed',
  'invite.issue': 'Invite issued',
  'invite.redeem': 'Invite redeemed',
  'invite.reissue': 'Invite reissued',
  'onboarding.complete': 'Onboarding step',
  'capacity.set': 'Capacity set',
  'batch.setCurrent': 'Current batch changed',
  'data.reset': 'Sample data reset',
};

function actionLabel(action) {
  if (action.startsWith('screen.')) return `Opened ${action.slice('screen.'.length)} screen`;
  return ACTION_LABELS[action] ?? action;
}

function actorLabel(event, names) {
  const role = ROLE_LABELS[event.actorRole] ?? 'Unknown role';
  if (event.actorRole === ROLE.PROSPECT && names?.[event.actorId]) return `${names[event.actorId]} (Prospect)`;
  return role;
}

export function auditItem(event, names) {
  const blocked = event.result === 'blocked';
  return html`
    <li>
      <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <strong>${actionLabel(event.action)}</strong>
        <span class="status-badge ${blocked ? 'result-blocked' : 'result-success'}">
          <span aria-hidden="true">${blocked ? '✕' : '✓'}</span>${blocked ? 'Blocked' : 'Done'}
        </span>
      </div>
      ${event.detail ? html`<div>${event.detail}</div>` : ''}
      <div class="audit-meta">
        ${actorLabel(event, names)}
        ${names && event.entryId && names[event.entryId] ? html` · about ${names[event.entryId]}` : ''}
        · <time datetime="${event.createdAt}">${formatDateTime(event.createdAt)}</time>
        ${event.code ? html` · <span class="audit-code">${event.code}</span>` : ''}
      </div>
    </li>`;
}

const EMPTY_FILTERS = Object.freeze({ action: '', result: '', role: '' });
let filters = { ...EMPTY_FILTERS };

export const auditView = {
  screen: 'audit',
  title: 'Audit trail',

  render({ state }) {
    const events = listAudit(state, filters);
    const names = Object.fromEntries(state.entries.map((entry) => [entry.entryId, entry.name]));
    const actions = [...new Set(state.audit.map((event) => event.action))].sort();
    return html`
      <div class="page-head">
        <h1>Audit trail</h1>
        <p>Who did what and when, newest first. Events can't be edited or deleted.</p>
      </div>
      <section class="lg-card mb-3" aria-label="Filters">
        <form id="audit-filters" class="row g-3 align-items-start" novalidate>
          <div class="col-12 col-md-4">
            ${selectField({
              id: 'filter-action',
              name: 'action',
              label: 'Action',
              required: false,
              value: filters.action,
              placeholder: 'All actions',
              options: actions.map((action) => ({ value: action, label: actionLabel(action) })),
            })}
          </div>
          <div class="col-6 col-md-4">
            ${selectField({
              id: 'filter-result',
              name: 'result',
              label: 'Result',
              required: false,
              value: filters.result,
              placeholder: 'All results',
              options: [{ value: 'success', label: 'Done' }, { value: 'blocked', label: 'Blocked' }],
            })}
          </div>
          <div class="col-6 col-md-4">
            ${selectField({
              id: 'filter-role',
              name: 'role',
              label: 'Role',
              required: false,
              value: filters.role,
              placeholder: 'All roles',
              options: Object.values(ROLE).map((role) => ({ value: role, label: ROLE_LABELS[role] })),
            })}
          </div>
        </form>
      </section>
      <section class="lg-card" aria-labelledby="events-heading">
        <h2 id="events-heading">${events.length} ${events.length === 1 ? 'event' : 'events'}</h2>
        ${events.length > 0 ? html`
          <ol class="audit-list">${events.map((event) => auditItem(event, names))}</ol>` : html`
          <div class="empty-state">
            <p>No events match these filters.</p>
            <button type="button" class="btn btn-outline-primary" id="clear-audit-filters">Clear filters</button>
          </div>`}
      </section>`;
  },

  mount(root, ctx) {
    root.querySelector('#audit-filters').addEventListener('change', (event) => {
      filters = { ...filters, [event.target.name]: event.target.value };
      ctx.refresh({ preserve: true });
    });
    root.querySelector('#clear-audit-filters')?.addEventListener('click', () => {
      filters = { ...EMPTY_FILTERS };
      ctx.refresh();
      root.querySelector('#filter-action').focus();
    });
  },
};
