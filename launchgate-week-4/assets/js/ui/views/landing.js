// Landing page and waitlist form.

import { COMPANY_SIZES, ROLE, USE_CASES } from '../../logic/constants.js';
import { ERR } from '../../logic/errors.js';
import { joinWaitlist } from '../../logic/waitlistService.js';
import { html } from '../dom.js';
import { clearFieldErrors, readForm, selectField, showFieldErrors, textField } from '../forms.js';

const PATH = [
  ['Join the waitlist', 'Tell us about your team and see your place in line straight away.'],
  ['Get reviewed', 'Our operations team admits people in order, as launch seats open up.'],
  ['Redeem your invite', 'Once approved, you get a personal code that works once and lasts 7 days.'],
  ['Finish onboarding', 'Four short steps take you from invite to your first working session.'],
];

function waitlistForm() {
  return html`
    <h2 id="join-heading">Join the waitlist</h2>
    <p class="text-secondary">All fields are required.</p>
    <form id="waitlist-form" novalidate aria-labelledby="join-heading">
      <div class="row g-3">
        <div class="col-12 col-sm-6">${textField({ id: 'name', label: 'Full name', autocomplete: 'name' })}</div>
        <div class="col-12 col-sm-6">${textField({ id: 'email', label: 'Work email', type: 'email', autocomplete: 'email', inputmode: 'email' })}</div>
        <div class="col-12 col-sm-6">${textField({ id: 'company', label: 'Company', autocomplete: 'organization' })}</div>
        <div class="col-12 col-sm-6">${textField({ id: 'jobTitle', label: 'Job title', autocomplete: 'organization-title' })}</div>
        <div class="col-12 col-sm-6">${selectField({ id: 'companySize', label: 'Company size', options: COMPANY_SIZES, placeholder: 'Choose a size' })}</div>
        <div class="col-12 col-sm-6">${selectField({ id: 'useCase', label: 'Intended use', options: USE_CASES, placeholder: 'Choose a use' })}</div>
      </div>
      <div id="duplicate-help" class="alert alert-warning mt-3 mb-0" role="alert" hidden></div>
      <p class="privacy-note mt-3 mb-3">This is a demo with fictional data. Please use a made-up name and an address such as you@company.example.</p>
      <button type="submit" class="btn btn-primary w-100">Join the waitlist</button>
    </form>`;
}

function staffNotice(actor) {
  return html`
    <h2>Signing up is for prospects</h2>
    <p class="text-secondary">You are viewing as a staff role, which cannot join the waitlist. Switch to a visitor or prospect to try the form.</p>
    <a class="btn btn-primary" href="#/login">Switch role</a>
    <a class="btn btn-outline-secondary ms-2" href="${actor.role === ROLE.FOUNDER ? '#/dashboard' : '#/queue'}">Back to work</a>`;
}

function confirmation(entry, position) {
  return html`
    <p class="eyebrow">You're on the list</p>
    <h2 id="confirmation-heading" tabindex="-1">Thanks, ${entry.name}.</h2>
    <p class="position-figure my-3">#${position}</p>
    <p>That's your place in line. An operations approver reviews prospects oldest first, and your status updates as soon as they decide.</p>
    <p class="text-secondary small">We'd normally email you at ${entry.email}. In this demo, check My status instead.</p>
    <a class="btn btn-primary w-100" href="#/status">Open my status</a>`;
}

export const landingView = {
  screen: 'landing',
  title: 'Join the waitlist',

  render({ actor }) {
    const isStaff = actor.role === ROLE.APPROVER || actor.role === ROLE.FOUNDER;
    return html`
      <div class="row g-4 g-lg-5 align-items-start">
        <div class="col-12 col-lg-6">
          <p class="eyebrow">Beacon, the shared workspace for operations teams</p>
          <h1 class="hero-title">Get your team in early, without the guesswork.</h1>
          <p class="hero-lead mt-3">We admit a limited number of teams to each launch batch. Join the waitlist and you'll always know where you stand and what happens next.</p>
          ${isStaff ? '' : html`<button type="button" class="btn btn-primary d-lg-none mt-1" id="jump-to-form">Join the waitlist</button>`}
          <ol class="path-list">
            ${PATH.map(([title, text], index) => html`
              <li>
                <span class="num" aria-hidden="true">${index + 1}</span>
                <div><strong>${title}</strong><p>${text}</p></div>
              </li>`)}
          </ol>
        </div>
        <div class="col-12 col-lg-6">
          <section class="lg-card" id="join-card">
            ${isStaff ? staffNotice(actor) : waitlistForm()}
          </section>
        </div>
      </div>`;
  },

  mount(root, ctx) {
    root.querySelector('#jump-to-form')?.addEventListener('click', () => {
      root.querySelector('#name').focus();
      root.querySelector('#join-card').scrollIntoView({ block: 'start' });
    });

    const form = root.querySelector('#waitlist-form');
    if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const duplicateHelp = form.querySelector('#duplicate-help');
      duplicateHelp.hidden = true;
      clearFieldErrors(form);

      const result = joinWaitlist(readForm(form), ctx.actor);
      if (result.ok) {
        ctx.setSession({ role: ROLE.PROSPECT, entryId: result.entry.entryId });
        ctx.refreshNavbar();
        root.querySelector('#join-card').innerHTML = String(confirmation(result.entry, result.position));
        root.querySelector('#confirmation-heading').focus();
        ctx.toast(`You joined the waitlist at position ${result.position}.`);
        return;
      }

      showFieldErrors(form, result.fields);
      if (result.code === ERR.DUPLICATE_EMAIL) {
        duplicateHelp.innerHTML = String(html`This email is already on the waitlist. <a class="alert-link" href="#/login?entry=${result.existingEntryId}">Check your status instead.</a>`);
        duplicateHelp.hidden = false;
      } else if (result.code !== ERR.VALIDATION) {
        ctx.toast(result.message, 'error');
      }
    });
  },
};
