import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_STATUSES, ONBOARDING_STEPS, STATUS } from '../assets/js/logic/constants.js';
import { ERR } from '../assets/js/logic/errors.js';
import { SAMPLE_CODES, buildSampleState } from '../assets/js/logic/sampleData.js';
import { batchSummaries, seatsLeft } from '../assets/js/logic/metrics.js';
import { approve } from '../assets/js/logic/approvalService.js';
import { redeemInvite } from '../assets/js/logic/inviteService.js';
import { checklistProgress } from '../assets/js/logic/onboardingService.js';
import { memoryBackend, readState, resetState, useBackend } from '../assets/js/logic/storage.js';
import { APPROVER, T0, prospect, teardown } from './helpers.js';
import { setClock } from '../assets/js/logic/clock.js';

describe('sample data contents', () => {
  const state = buildSampleState(T0);

  it('has a prospect at every stage', () => {
    ALL_STATUSES.forEach((status) => {
      assert.ok(state.entries.some((entry) => entry.status === status), status);
    });
  });

  it('has a full batch, an empty batch and a current batch with seats', () => {
    const summaries = batchSummaries(state);
    assert.ok(summaries.some((batch) => batch.left === 0 && batch.used > 0));
    assert.ok(summaries.some((batch) => batch.used === 0));
    assert.ok(seatsLeft(state, state.currentBatchId) > 0);
  });

  it('has an expired, unused invite', () => {
    const invite = state.invites.find((candidate) => candidate.code === SAMPLE_CODES.expired);
    assert.equal(invite.usedAt, null);
    assert.ok(new Date(invite.expiresAt).getTime() < T0);
  });

  it('has an invite for every approved prospect and a checklist for every onboarding one', () => {
    state.entries
      .filter((entry) => [STATUS.APPROVED, STATUS.ONBOARDING, STATUS.ACTIVATED].includes(entry.status))
      .forEach((entry) => {
        assert.ok(state.invites.some((invite) => invite.entryId === entry.entryId), entry.entryId);
      });
    state.entries.filter((entry) => entry.status === STATUS.ACTIVATED).forEach((entry) => {
      assert.equal(checklistProgress(state, entry.entryId).done, ONBOARDING_STEPS.length);
    });
  });

  it('has unique, fictional email addresses', () => {
    const emails = state.entries.map((entry) => entry.email);
    assert.equal(new Set(emails).size, emails.length);
    emails.forEach((email) => assert.match(email, /\.example$/));
  });

  it('has audit events, including a blocked attempt', () => {
    assert.ok(state.audit.length > state.entries.length);
    assert.ok(state.audit.some((event) => event.result === 'blocked'));
  });
});

describe('sample data in the rules', () => {
  beforeEach(() => {
    setClock(() => T0);
    useBackend(memoryBackend());
    resetState();
  });
  afterEach(teardown);

  it('the expired sample code is refused and the valid one works', () => {
    assert.equal(redeemInvite('e-008', SAMPLE_CODES.expired, prospect('e-008')).code, ERR.CODE_EXPIRED);
    assert.equal(redeemInvite('e-007', SAMPLE_CODES.valid, prospect('e-007')).ok, true);
  });

  it('the used sample code is refused', () => {
    assert.equal(redeemInvite('e-003', SAMPLE_CODES.used, prospect('e-003')).code, ERR.CODE_USED);
  });

  it('the current batch has exactly two seats left', () => {
    assert.equal(approve('e-015', '', APPROVER).ok, true);
    assert.equal(approve('e-016', '', APPROVER).ok, true);
    assert.equal(approve('e-017', '', APPROVER).code, ERR.CAPACITY_FULL);
    assert.equal(seatsLeft(readState(), 'b-beta'), 0);
  });
});
