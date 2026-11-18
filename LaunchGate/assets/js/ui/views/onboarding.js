// Onboarding Checklist: four ordered steps and the completion screen.

import { STATUS, TEMPLATES } from '../../logic/constants.js';
import { getEntry } from '../../logic/funnelService.js';
import { checklistProgress, completeStep, getChecklist } from '../../logic/onboardingService.js';
import { html } from '../dom.js';
import { readForm, selectField, showFieldErrors, textField, textareaField } from '../forms.js';

const STEP_FORMS = {
  profile: () => html`
    ${textField({ id: 'workspaceName', label: 'Workspace name', help: 'Your team will see this name. Use 2 to 60 characters.' })}`,
  template: () => html`
    ${selectField({ id: 'templateId', label: 'Starting template', options: TEMPLATES.map(({ id, label }) => ({ value: id, label })), placeholder: 'Choose a template' })}`,
  teammates: () => html`
    ${textareaField({
      id: 'teammates',
      label: 'Teammate emails',
      required: false,
      rows: 2,
      help: 'Separate addresses with commas. Leave this empty to invite people later. No email is sent in this demo.',
    })}`,
  tour: () => html`
    <p class="mb-2">A quick look around your simulated workspace:</p>
    <ol class="tour-list">
      <li>Boards show all your team's work in one place.</li>
      <li>Reports update as work moves along.</li>
      <li>Automations handle repeat tasks for you.</li>
    </ol>
    <div class="form-check">
      <input class="form-check-input" type="checkbox" id="tourDone" name="tourDone" aria-describedby="tourDone-error">
      <label class="form-check-label" for="tourDone">I've finished the tour</label>
      <div class="invalid-feedback" id="tourDone-error"></div>
    </div>`,
};

function stepCard(step, index) {
  const number = index + 1;
  if (step.viewState === 'complete') {
    return html`
      <li class="step-card">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h2 class="mb-0">${number}. ${step.label}</h2>
          <span class="step-state text-primary"><span aria-hidden="true">✓</span> Complete</span>
        </div>
      </li>`;
  }
  if (step.viewState === 'locked') {
    return html`
      <li class="step-card is-locked">
        <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h2 class="mb-0">${number}. ${step.label}</h2>
          <span class="step-state">Locked: complete the previous step</span>
        </div>
      </li>`;
  }
  return html`
    <li class="step-card is-current" aria-current="step">
      <h2 tabindex="-1" data-current-step>${number}. ${step.label}</h2>
      <form id="step-form" data-step="${step.stepId}" novalidate>
        ${STEP_FORMS[step.stepId]()}
        <button type="submit" class="btn btn-primary mt-3">Complete this step</button>
      </form>
    </li>`;
}

function welcome(entry) {
  return html`
    <section class="lg-card empty-state" aria-labelledby="welcome-heading">
      <p class="eyebrow">Activated</p>
      <h1 id="welcome-heading" tabindex="-1" data-current-step>Welcome aboard, ${entry.name}.</h1>
      <p>You've finished onboarding, and your Beacon workspace is ready for your team.</p>
      <a class="btn btn-primary" href="#/status">Back to my status</a>
    </section>`;
}

export const onboardingView = {
  screen: 'onboarding',
  title: 'Onboarding',

  render({ state, actor }) {
    const entry = getEntry(state, actor.entryId);
    if (entry.status === STATUS.ACTIVATED) return welcome(entry);
    if (entry.status !== STATUS.ONBOARDING) {
      return html`
        <section class="lg-card empty-state">
          <h1>Onboarding hasn't started yet</h1>
          <p>You're currently ${entry.status}. Onboarding opens after you are approved and redeem your invite code.</p>
          <a class="btn btn-primary" href="#/status">See my status</a>
        </section>`;
    }

    const steps = getChecklist(state, entry.entryId);
    const progress = checklistProgress(state, entry.entryId);
    return html`
      <div class="page-head">
        <h1>Finish onboarding</h1>
        <p>Complete the steps in order. A finished step can't be changed.</p>
      </div>
      <section class="lg-card mb-3" aria-labelledby="progress-label">
        <div class="d-flex justify-content-between mb-2">
          <span class="fw-semibold" id="progress-label">Progress</span>
          <span>${progress.done} of ${progress.total} steps</span>
        </div>
        <div class="progress" role="progressbar" aria-labelledby="progress-label"
          aria-valuenow="${progress.percent}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar" style="width: ${progress.percent}%"></div>
        </div>
      </section>
      <ol class="list-unstyled d-grid gap-3 mb-0">
        ${steps.map(stepCard)}
      </ol>`;
  },

  mount(root, ctx) {
    const form = root.querySelector('#step-form');
    if (!form) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = readForm(form);
      const data = form.dataset.step === 'tour' ? { tourDone: values.tourDone === 'on' } : values;
      const result = completeStep(ctx.actor.entryId, form.dataset.step, data, ctx.actor);
      if (!result.ok) {
        if (!showFieldErrors(form, result.fields)) ctx.toast(result.message, 'error');
        return;
      }
      ctx.toast(result.activated ? 'Onboarding complete. You are now Activated.' : 'Step completed.');
      ctx.refresh();
      document.querySelector('[data-current-step]')?.focus();
    });
  },
};
