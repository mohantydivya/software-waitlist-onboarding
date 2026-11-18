// The PRD's critical path, end to end through the public service functions.

import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../assets/js/logic/constants.js';
import { joinWaitlist } from '../assets/js/logic/waitlistService.js';
import { startReview } from '../assets/js/logic/funnelService.js';
import { approve } from '../assets/js/logic/approvalService.js';
import { redeemInvite } from '../assets/js/logic/inviteService.js';
import { completeStep } from '../assets/js/logic/onboardingService.js';
import { funnelMetrics, seatsUsed } from '../assets/js/logic/metrics.js';
import { readState } from '../assets/js/logic/storage.js';
import { APPROVER, SIGNUP, VISITOR, entryStatus, prospect, setup, teardown } from './helpers.js';

describe('critical path', () => {
  beforeEach(() => setup({ capacity: 1 }));
  afterEach(teardown);

  it('join, review, approve, redeem, four steps, Activated', () => {
    const joined = joinWaitlist(SIGNUP, VISITOR);
    assert.equal(joined.position, 1);
    const { entryId } = joined.entry;
    const me = prospect(entryId);
    assert.equal(entryStatus(entryId), STATUS.WAITLISTED);

    assert.equal(startReview(entryId, APPROVER).ok, true);
    assert.equal(entryStatus(entryId), STATUS.UNDER_REVIEW);

    const approved = approve(entryId, 'Good fit for the batch.', APPROVER);
    assert.equal(approved.ok, true);
    assert.equal(entryStatus(entryId), STATUS.APPROVED);
    assert.equal(seatsUsed(readState(), 'b1'), 1);

    assert.equal(redeemInvite(entryId, approved.invite.code, me).ok, true);
    assert.equal(entryStatus(entryId), STATUS.ONBOARDING);

    const steps = [
      ['profile', { workspaceName: 'Acme HQ' }],
      ['template', { templateId: 'blank' }],
      ['teammates', { teammates: '' }],
      ['tour', { tourDone: true }],
    ];
    steps.forEach(([stepId, data], index) => {
      const result = completeStep(entryId, stepId, data, me);
      assert.equal(result.ok, true, stepId);
      assert.equal(result.activated, index === steps.length - 1);
    });
    assert.equal(entryStatus(entryId), STATUS.ACTIVATED);

    const funnel = funnelMetrics(readState().entries);
    assert.deepEqual(funnel.map((row) => row.count), [1, 1, 1, 1, 1]);

    const actions = readState().audit.map((event) => event.action);
    assert.equal(actions.filter((action) => action === 'status.change').length, 4);
    assert.ok(readState().audit.every((event) => event.result === 'success'));
  });
});
