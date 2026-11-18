// Founder Dashboard: capacity form, funnel, status counts and batch summary.
// All numbers are derived from the records each time this screen renders.

import { ALL_STATUSES, CAPACITY_MAX, STATUS } from '../../logic/constants.js';
import { sortOldestFirst } from '../../logic/funnelService.js';
import { approve, setCapacity, setCurrentBatch } from '../../logic/approvalService.js';
import { batchSummaries, currentBatch, funnelMetrics, statusCounts } from '../../logic/metrics.js';
import { formatDate, html } from '../dom.js';
import { funnelChart, statusBadge } from '../components.js';
import { readForm, selectField, showFieldErrors, textField } from '../forms.js';

function statTile(value, label) {
  return html`
    <div class="col-6 col-lg-3">
      <section class="lg-card stat-tile h-100">
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </section>
    </div>`;
}

export const dashboardView = {
  screen: 'dashboard',
  title: 'Founder dashboard',

  render({ state }) {
    const funnel = funnelMetrics(state.entries);
    const byId = Object.fromEntries(funnel.map((row) => [row.id, row]));
    const counts = statusCounts(state.entries);
    const batches = batchSummaries(state);
    const batch = currentBatch(state);

    return html`
      <div class="page-head">
        <h1>Founder dashboard</h1>
        <p>Set how many prospects each launch batch can take, and see where people drop out.</p>
      </div>

      <div class="row g-3 mb-3">
        ${statTile(byId.joined.count, 'Signups')}
        ${statTile(byId.approved.count, 'Reached approval')}
        ${statTile(byId.activated.count, 'Activated')}
        ${statTile(`${byId.activated.conversionFromJoined}%`, 'Signup to activation')}
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-7">
          <section class="lg-card mb-3" aria-labelledby="funnel-heading">
            <h2 id="funnel-heading">Funnel</h2>
            <p class="small text-secondary">Each stage counts everyone who has reached it, including people who have since moved further along.</p>
            ${state.entries.length === 0
              ? html`<p class="mb-0">The waitlist is empty, so there is nothing to chart yet.</p>`
              : funnelChart(funnel)}
          </section>
          <section class="lg-card" aria-labelledby="batches-heading">
            <h2 id="batches-heading">Launch batches</h2>
            <div class="table-responsive" tabindex="0" role="region" aria-label="Launch batches table">
              <table class="table queue-table">
                <thead>
                  <tr>
                    <th scope="col">Batch</th>
                    <th scope="col">Opens</th>
                    <th scope="col" class="text-end">Capacity</th>
                    <th scope="col" class="text-end">Used</th>
                    <th scope="col" class="text-end">Left</th>
                  </tr>
                </thead>
                <tbody>
                  ${batches.map((row) => html`
                    <tr>
                      <td>${row.label}${row.isCurrent ? html` <span class="small fw-semibold text-primary">(current)</span>` : ''}</td>
                      <td class="text-nowrap">${formatDate(row.opensOn)}</td>
                      <td class="text-end">${row.capacity}</td>
                      <td class="text-end">${row.used}</td>
                      <td class="text-end">${row.left}</td>
                    </tr>`)}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div class="col-12 col-lg-5">
          <section class="lg-card mb-3" aria-labelledby="capacity-heading">
            <h2 id="capacity-heading">Launch capacity</h2>
            <div class="mb-3">
              ${selectField({
                id: 'current-batch',
                name: 'batch',
                label: 'Current batch',
                required: false,
                value: state.currentBatchId,
                help: 'New approvals take seats from this batch.',
                options: batches.map((row) => ({ value: row.batchId, label: `${row.label}: ${row.left} left` })),
              })}
            </div>
            ${batch ? html`
              <form id="capacity-form" novalidate>
                ${textField({
                  id: 'capacity',
                  label: `Capacity for ${batch.label}`,
                  value: batch.capacity,
                  inputmode: 'numeric',
                  help: `A whole number from 1 to ${CAPACITY_MAX}. It can't go below the seats already used.`,
                })}
                <button type="submit" class="btn btn-primary mt-3">Save capacity</button>
              </form>` : ''}
          </section>

          <section class="lg-card mb-3" aria-labelledby="counts-heading">
            <h2 id="counts-heading">Where prospects are now</h2>
            <ul class="list-unstyled mb-0 d-grid gap-2">
              ${ALL_STATUSES.map((status) => html`
                <li class="d-flex justify-content-between align-items-center">
                  ${statusBadge(status)}
                  <span class="fw-semibold">${counts[status]}</span>
                </li>`)}
            </ul>
          </section>

          <section class="lg-card" aria-labelledby="guard-heading">
            <h2 id="guard-heading">Try the role check</h2>
            <p class="small text-secondary">Founders can't make decisions. This button calls the real approve function as you, and the guard refuses it. Then check the audit trail.</p>
            <button type="button" class="btn btn-outline-secondary w-100" id="try-approve">Try to approve the next prospect</button>
            <div id="guard-result" class="mt-3" hidden></div>
          </section>
        </div>
      </div>`;
  },

  mount(root, ctx) {
    root.querySelector('#current-batch').addEventListener('change', (event) => {
      const result = setCurrentBatch(event.target.value, ctx.actor);
      if (result.ok) ctx.toast(`Current batch is now ${result.batch.label}.`);
      else ctx.toast(result.message, 'error');
      ctx.refresh();
      root.querySelector('#current-batch').focus();
    });

    const form = root.querySelector('#capacity-form');
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = setCapacity(ctx.state.currentBatchId, readForm(form).capacity, ctx.actor);
      if (result.ok) {
        ctx.toast(`Capacity updated to ${result.batch.capacity}.`);
        ctx.refresh();
        return;
      }
      if (!showFieldErrors(form, result.fields)) ctx.toast(result.message, 'error');
    });

    root.querySelector('#try-approve').addEventListener('click', () => {
      const next = sortOldestFirst(ctx.state.entries).find((entry) => entry.status === STATUS.WAITLISTED);
      const result = approve(next?.entryId ?? 'none', '', ctx.actor);
      const panel = root.querySelector('#guard-result');
      panel.hidden = false;
      panel.innerHTML = String(html`
        <div class="alert alert-danger mb-0" role="alert">
          ${result.message}
          <a class="alert-link d-block mt-1" href="#/audit">See the blocked attempt in the audit trail</a>
        </div>`);
    });
  },
};
