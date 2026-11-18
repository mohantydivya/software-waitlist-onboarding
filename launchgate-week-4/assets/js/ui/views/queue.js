// Approval Queue: filters, capacity meter and a table that becomes cards on phones.

import { ALL_STATUSES, COMPANY_SIZES, USE_CASES } from '../../logic/constants.js';
import { batchSummaries } from '../../logic/metrics.js';
import { AWAITING_DECISION, filterQueue } from '../../logic/waitlistService.js';
import { announce, formatDate, html } from '../dom.js';
import { capacityMeter, statusBadge } from '../components.js';
import { selectField } from '../forms.js';

const DEFAULT_FILTERS = Object.freeze({ status: AWAITING_DECISION, companySize: '', useCase: '' });

// UI state only: survives leaving the screen, and never reaches storage.
let filters = { ...DEFAULT_FILTERS };

export function resetQueueFilters() {
  filters = { ...DEFAULT_FILTERS };
}

function approvalTable(entries) {
  return html`
    <div class="table-responsive d-none d-md-block">
      <table class="table queue-table align-middle">
        <caption class="visually-hidden">Prospects, oldest first</caption>
        <thead>
          <tr>
            <th scope="col">Prospect</th>
            <th scope="col">Size</th>
            <th scope="col">Use case</th>
            <th scope="col">Joined</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map((entry) => html`
            <tr>
              <td>
                <a href="#/queue/${entry.entryId}">${entry.name}</a>
                <div class="small text-secondary">${entry.company}</div>
              </td>
              <td>${entry.companySize}</td>
              <td>${entry.useCase}</td>
              <td class="text-nowrap">${formatDate(entry.createdAt)}</td>
              <td>${statusBadge(entry.status)}</td>
            </tr>`)}
        </tbody>
      </table>
    </div>
    <ul class="list-unstyled d-grid gap-2 d-md-none mb-0">
      ${entries.map((entry) => html`
        <li class="prospect-card">
          <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <a href="#/queue/${entry.entryId}">${entry.name}</a>
            ${statusBadge(entry.status)}
          </div>
          <div class="small text-secondary">${entry.company} · ${entry.companySize} people</div>
          <div class="small text-secondary">${entry.useCase} · joined ${formatDate(entry.createdAt)}</div>
        </li>`)}
    </ul>`;
}

function emptyResults(total) {
  if (total === 0) {
    return html`
      <div class="empty-state">
        <h2>The waitlist is empty</h2>
        <p>No one has signed up yet. Share the signup page, or reset the sample data.</p>
        <a class="btn btn-primary" href="#/settings">Go to reset</a>
      </div>`;
  }
  return html`
    <div class="empty-state">
      <h2>No prospects match these filters</h2>
      <p>Try a wider search.</p>
      <button type="button" class="btn btn-outline-primary" id="clear-filters-empty">Clear filters</button>
    </div>`;
}

export const queueView = {
  screen: 'queue',
  title: 'Approval queue',

  render({ state }) {
    const batch = batchSummaries(state).find((summary) => summary.isCurrent);
    const entries = filterQueue(state.entries, filters);
    return html`
      <div class="page-head">
        <h1>Approval queue</h1>
        <p>Oldest first. Open a prospect to review the details and decide.</p>
      </div>
      <section class="lg-card mb-3" aria-label="Launch capacity">
        ${batch ? capacityMeter(batch) : html`<p class="mb-0">No launch batch is open. Ask the Founder to choose one.</p>`}
      </section>
      <div class="row g-3">
        <div class="col-12 col-lg-3">
          <section class="lg-card" aria-labelledby="filters-heading">
            <h2 id="filters-heading">Filters</h2>
            <form id="filters-form" class="row g-3" novalidate>
              <div class="col-12 col-sm-4 col-lg-12">
                ${selectField({
                  id: 'status',
                  label: 'Status',
                  required: false,
                  value: filters.status,
                  options: [
                    { value: AWAITING_DECISION, label: 'Awaiting a decision' },
                    { value: '', label: 'All statuses' },
                    ...ALL_STATUSES,
                  ],
                })}
              </div>
              <div class="col-12 col-sm-4 col-lg-12">
                ${selectField({ id: 'companySize', label: 'Company size', required: false, value: filters.companySize, placeholder: 'All sizes', options: COMPANY_SIZES })}
              </div>
              <div class="col-12 col-sm-4 col-lg-12">
                ${selectField({ id: 'useCase', label: 'Use case', required: false, value: filters.useCase, placeholder: 'All use cases', options: USE_CASES })}
              </div>
              <div class="col-12">
                <button type="button" class="btn btn-outline-secondary w-100" id="clear-filters">Clear filters</button>
              </div>
            </form>
          </section>
        </div>
        <div class="col-12 col-lg-9">
          <section class="lg-card" aria-labelledby="results-heading">
            <h2 id="results-heading">${entries.length} ${entries.length === 1 ? 'prospect' : 'prospects'}</h2>
            ${entries.length > 0 ? approvalTable(entries) : emptyResults(state.entries.length)}
          </section>
        </div>
      </div>`;
  },

  mount(root, ctx) {
    const applyFilters = () => {
      ctx.refresh({ preserve: true });
      announce(root.querySelector('#results-heading').textContent + ' shown');
    };

    root.querySelector('#filters-form').addEventListener('change', (event) => {
      filters = { ...filters, [event.target.name]: event.target.value };
      applyFilters();
    });

    const clear = () => {
      filters = { status: '', companySize: '', useCase: '' };
      ctx.refresh();
      root.querySelector('#status').focus();
      announce(root.querySelector('#results-heading').textContent + ' shown');
    };
    root.querySelector('#clear-filters').addEventListener('click', clear);
    root.querySelector('#clear-filters-empty')?.addEventListener('click', clear);
  },
};
