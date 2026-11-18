// Settings: current role, reset sample data and known limitations.
// Also holds the Unauthorized and Storage Error screens, which offer the same exits.

import { ROLE_LABELS } from '../../logic/constants.js';
import { SCHEMA_VERSION } from '../../logic/storage.js';
import { html } from '../dom.js';
import { openModal } from '../components.js';
import { homeFor } from '../session.js';

export const settingsView = {
  screen: 'settings',
  title: 'Settings',

  render({ actor, state }) {
    return html`
      <div class="page-head">
        <h1>Settings</h1>
      </div>
      <div class="row g-3">
        <div class="col-12 col-md-6">
          <section class="lg-card h-100" aria-labelledby="role-heading">
            <h2 id="role-heading">Current role</h2>
            <p>${ROLE_LABELS[actor.role]}${actor.entryId ? `, ${state.entries.find((entry) => entry.entryId === actor.entryId)?.name ?? ''}` : ''}</p>
            <a class="btn btn-outline-secondary" href="#/login">Switch role</a>
          </section>
        </div>
        <div class="col-12 col-md-6">
          <section class="lg-card h-100" aria-labelledby="reset-heading">
            <h2 id="reset-heading">Demo data</h2>
            <p>Reset puts every prospect, batch, invite and audit event back to the original samples. Data format version ${SCHEMA_VERSION}.</p>
            <button type="button" class="btn btn-outline-danger" id="reset-data">Reset sample data</button>
          </section>
        </div>
        <div class="col-12">
          <section class="lg-card" aria-labelledby="limits-heading">
            <h2 id="limits-heading">Known limitations</h2>
            <ul class="mb-0">
              <li>Data lives in this browser's LocalStorage. It isn't shared with other browsers, and it isn't a secure database.</li>
              <li>Roles are for demonstration, not security. A real product needs a server that enforces roles and unique emails.</li>
              <li>Invitations appear on screen only. No email or SMS is ever sent.</li>
              <li>Two tabs acting in the same instant could still collide, because LocalStorage has no locking. Each action re-reads the latest data first to make this rare.</li>
            </ul>
          </section>
        </div>
      </div>`;
  },

  mount(root, ctx) {
    root.querySelector('#reset-data').addEventListener('click', () => {
      openModal({
        title: 'Reset sample data?',
        body: html`<p class="mb-0">Everything you've changed in this demo, including new signups and the audit trail, will be replaced by the original samples.</p>`,
        confirmLabel: 'Reset sample data',
        confirmClass: 'btn-danger',
        onConfirm: () => {
          ctx.resetData();
          return true;
        },
      });
    });
  },
};

export function unauthorizedScreen(actor) {
  return html`
    <section class="lg-card empty-state" role="alert">
      <h1>Unauthorized</h1>
      <p>${ROLE_LABELS[actor.role] ?? 'This role'} can't use this screen. Nothing was changed, and this attempt was recorded in the audit trail.</p>
      <a class="btn btn-primary" href="${homeFor(actor.role)}">Go to my home screen</a>
      <a class="btn btn-outline-secondary ms-2" href="#/login">Switch role</a>
    </section>`;
}

export function storageErrorScreen(message) {
  return html`
    <section class="lg-card empty-state" role="alert">
      <h1>Your data couldn't be loaded</h1>
      <p>${message}</p>
      <button type="button" class="btn btn-primary" id="storage-reset">Reset sample data</button>
    </section>`;
}
