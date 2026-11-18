// The four-step checklist. Step order is enforced here; "locked" and "current" are
// derived from which steps are complete, so they cannot drift out of step.

import { ONBOARDING_STEPS, STATUS } from './constants.js';
import { ERR, LaunchError, validationError } from './errors.js';
import { nowIso } from './clock.js';
import { appendAudit } from './audit.js';
import { guardedAction } from './roleGuard.js';
import { getEntry, transition } from './funnelService.js';
import { validateStepData } from './validators.js';

/** Creates the step records when a prospect's invite is redeemed. */
export function createChecklist(state, entryId) {
  ONBOARDING_STEPS.forEach(({ id }) => {
    state.steps.push({ entryId, stepId: id, status: 'pending', completedAt: null, data: null });
  });
}

/** Steps in order, each with viewState: 'complete', 'current' or 'locked'. */
export function getChecklist(state, entryId) {
  let currentAssigned = false;
  return ONBOARDING_STEPS.map(({ id, label }) => {
    const record = state.steps.find((step) => step.entryId === entryId && step.stepId === id);
    const complete = record?.status === 'complete';
    let viewState = 'complete';
    if (!complete) {
      viewState = currentAssigned ? 'locked' : 'current';
      currentAssigned = true;
    }
    return { stepId: id, label, viewState, completedAt: record?.completedAt ?? null, data: record?.data ?? null };
  });
}

export function checklistProgress(state, entryId) {
  const steps = getChecklist(state, entryId);
  const done = steps.filter((step) => step.viewState === 'complete').length;
  return { done, total: steps.length, percent: Math.round((done / steps.length) * 100) };
}

export function completeStep(entryId, stepId, data, actor) {
  return guardedAction({ action: 'onboarding.complete', actor, entryId }, (state) => {
    const entry = getEntry(state, entryId);
    if (entry.status !== STATUS.ONBOARDING) {
      throw new LaunchError(ERR.INVALID_TRANSITION, `Onboarding steps cannot be completed from ${entry.status}.`);
    }

    const steps = getChecklist(state, entryId);
    const target = steps.find((step) => step.stepId === stepId);
    if (!target) throw new LaunchError(ERR.NOT_FOUND, 'That onboarding step does not exist.');
    if (target.viewState === 'complete') {
      throw new LaunchError(ERR.STEP_DONE, 'This step is already complete and cannot be changed.');
    }
    if (target.viewState === 'locked') {
      throw new LaunchError(ERR.STEP_ORDER, 'Complete the previous step first.');
    }

    const errors = validateStepData(stepId, data);
    if (Object.keys(errors).length > 0) throw validationError(errors);

    const record = state.steps.find((step) => step.entryId === entryId && step.stepId === stepId);
    record.status = 'complete';
    record.completedAt = nowIso();
    record.data = data;
    appendAudit(state, { actor, action: 'onboarding.complete', entryId, detail: `Completed: ${target.label}.` });

    const isLast = stepId === ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].id;
    if (isLast) transition(state, entryId, STATUS.ACTIVATED, actor);
    return { activated: isLast };
  });
}
