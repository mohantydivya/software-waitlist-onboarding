// Role Select: the demonstration login.

import { ROLE } from '../../logic/constants.js';
import { sortOldestFirst } from '../../logic/funnelService.js';
import { html } from '../dom.js';
import { homeFor } from '../session.js';

export const loginView = {
  screen: 'login',
  title: 'Choose a role',

  render({ state, actor, query }) {
    const entries = sortOldestFirst(state.entries);
    const selected = query.get('entry') ?? actor.entryId ?? '';
    return html`
      <div class="page-head">
        <h1>Choose a demonstration role</h1>
        <p>Pick who you want to be. This is a demo switch, not real sign-in, so there is no password.</p>
      </div>
      <div class="row g-3">
        <div class="col-12 col-md-4">
          <section class="lg-card role-card">
            <h2>Prospect</h2>
            <p>See your status and place in line, redeem an invite and finish onboarding. You can act only on your own entry.</p>
            <form id="prospect-form" class="role-action" novalidate>
              <label class="form-label" for="prospect-select">Prospect to view as</label>
              <select class="form-select mb-3" id="prospect-select">
                ${entries.map((entry) => html`
                  <option value="${entry.entryId}" ${entry.entryId === selected ? html`selected` : ''}>${entry.name} · ${entry.status}</option>`)}
              </select>
              <button type="submit" class="btn btn-primary w-100" ${entries.length === 0 ? html`disabled` : ''}>Enter as prospect</button>
            </form>
          </section>
        </div>
        <div class="col-12 col-md-4">
          <section class="lg-card role-card">
            <h2>Operations Approver</h2>
            <p>Work through the queue oldest first. Approve, reject or hold prospects within the launch capacity.</p>
            <div class="role-action">
              <button type="button" class="btn btn-primary w-100" data-role="${ROLE.APPROVER}">Enter as approver</button>
            </div>
          </section>
        </div>
        <div class="col-12 col-md-4">
          <section class="lg-card role-card">
            <h2>Founder</h2>
            <p>Set launch capacity and watch the funnel. Founders see every decision but cannot change one.</p>
            <div class="role-action">
              <button type="button" class="btn btn-primary w-100" data-role="${ROLE.FOUNDER}">Enter as founder</button>
            </div>
          </section>
        </div>
      </div>
      <p class="mt-4">
        Just browsing? <button type="button" class="btn btn-link p-0 align-baseline" data-role="${ROLE.VISITOR}">Continue as a visitor</button>
      </p>`;
  },

  mount(root, ctx) {
    const enter = (session) => {
      ctx.setSession(session);
      ctx.navigate(homeFor(session.role));
    };

    root.querySelector('#prospect-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const entryId = root.querySelector('#prospect-select').value;
      if (entryId) enter({ role: ROLE.PROSPECT, entryId });
    });

    root.querySelectorAll('[data-role]').forEach((button) => {
      button.addEventListener('click', () => enter({ role: button.dataset.role }));
    });
  },
};
