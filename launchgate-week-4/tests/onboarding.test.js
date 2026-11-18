import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ONBOARDING_STEPS, STATUS } from '../assets/js/logic/constants.js';
import { ERR } from '../assets/js/logic/errors.js';
import { checklistProgress, completeStep, createChecklist, getChecklist } from '../assets/js/logic/onboardingService.js';
import { readState, writeState } from '../assets/js/logic/storage.js';
import { APPROVER, dataSnapshot, entryStatus, lastAudit, makeEntry, prospect, setup, teardown } from './helpers.js';

const { ONBOARDING, ACTIVATED, WAITLISTED } = STATUS;
const ME = prospect('e1');

const VALID_DATA = {
  profile: { workspaceName: 'Acme HQ' },
  template: { templateId: 'blank' },
  teammates: { teammates: 'a@acme.example, b@acme.example' },
  tour: { tourDone: true },
};

function completeThrough(count) {
  ONBOARDING_STEPS.slice(0, count).forEach(({ id }) => {
    assert.equal(completeStep('e1', id, VALID_DATA[id], ME).ok, true);
  });
}

describe('onboarding checklist', () => {
  beforeEach(() => {
    setup({
      entries: [makeEntry('e1', ONBOARDING), makeEntry('e2', ONBOARDING), makeEntry('new', WAITLISTED)],
      invites: [{ code: 'C1', entryId: 'e1', usedAt: '2026-01-01T00:00:00.000Z', voidedAt: null }],
    });
    const state = readState();
    createChecklist(state, 'e1');
    createChecklist(state, 'e2');
    writeState(state);
  });
  afterEach(teardown);

  it('starts with step one current and the rest locked', () => {
    const views = getChecklist(readState(), 'e1').map((step) => step.viewState);
    assert.deepEqual(views, ['current', 'locked', 'locked', 'locked']);
  });

  it('refuses skipping a step and changes nothing', () => {
    const before = dataSnapshot();
    const result = completeStep('e1', 'template', VALID_DATA.template, ME);
    assert.equal(result.code, ERR.STEP_ORDER);
    assert.equal(dataSnapshot(), before);
    assert.equal(lastAudit().code, ERR.STEP_ORDER);
  });

  it('refuses jumping straight to the last step', () => {
    assert.equal(completeStep('e1', 'tour', VALID_DATA.tour, ME).code, ERR.STEP_ORDER);
    assert.equal(entryStatus('e1'), ONBOARDING);
  });

  it('does not let a completed step be redone', () => {
    completeThrough(1);
    const result = completeStep('e1', 'profile', { workspaceName: 'Changed' }, ME);
    assert.equal(result.code, ERR.STEP_DONE);
    const record = readState().steps.find((step) => step.entryId === 'e1' && step.stepId === 'profile');
    assert.equal(record.data.workspaceName, 'Acme HQ');
  });

  it('tracks progress and only activates on the last step', () => {
    completeThrough(3);
    assert.deepEqual(checklistProgress(readState(), 'e1'), { done: 3, total: 4, percent: 75 });
    assert.equal(entryStatus('e1'), ONBOARDING);
    const result = completeStep('e1', 'tour', VALID_DATA.tour, ME);
    assert.equal(result.activated, true);
    assert.equal(entryStatus('e1'), ACTIVATED);
  });

  it('refuses bad step data with a field message, without logging a blocked attempt', () => {
    const eventsBefore = readState().audit.length;
    const result = completeStep('e1', 'profile', { workspaceName: ' ' }, ME);
    assert.equal(result.code, ERR.VALIDATION);
    assert.ok(result.fields.workspaceName);
    assert.equal(readState().audit.length, eventsBefore);
  });

  it("keeps each prospect's progress separate", () => {
    completeThrough(2);
    assert.equal(checklistProgress(readState(), 'e2').done, 0);
  });

  it("blocks completing someone else's step", () => {
    assert.equal(completeStep('e2', 'profile', VALID_DATA.profile, ME).code, ERR.FORBIDDEN);
    assert.equal(checklistProgress(readState(), 'e2').done, 0);
  });

  it('blocks non-prospect roles', () => {
    assert.equal(completeStep('e1', 'profile', VALID_DATA.profile, APPROVER).code, ERR.FORBIDDEN);
  });

  it('refuses steps before onboarding has started', () => {
    const result = completeStep('new', 'profile', VALID_DATA.profile, prospect('new'));
    assert.equal(result.code, ERR.INVALID_TRANSITION);
  });

  it('refuses an unknown step', () => {
    assert.equal(completeStep('e1', 'nope', {}, ME).code, ERR.NOT_FOUND);
  });
});
