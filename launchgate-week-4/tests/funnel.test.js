import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_STATUSES, ONBOARDING_STEPS, ROLE, STATUS } from '../assets/js/logic/constants.js';
import { ERR } from '../assets/js/logic/errors.js';
import { TRANSITIONS, canTransition, queuePosition, startReview, transition } from '../assets/js/logic/funnelService.js';
import { readState } from '../assets/js/logic/storage.js';
import { APPROVER, FOUNDER, T0, dataSnapshot, entryStatus, lastAudit, makeEntry, prospect, setup, teardown } from './helpers.js';

const { WAITLISTED, UNDER_REVIEW, ON_HOLD, APPROVED, REJECTED, ONBOARDING, ACTIVATED } = STATUS;

// Workflow rule 2, written out by hand so the test does not just mirror the code.
const ALLOWED = new Set([
  `${WAITLISTED}>${UNDER_REVIEW}`,
  `${WAITLISTED}>${APPROVED}`,
  `${WAITLISTED}>${ON_HOLD}`,
  `${WAITLISTED}>${REJECTED}`,
  `${UNDER_REVIEW}>${APPROVED}`,
  `${UNDER_REVIEW}>${ON_HOLD}`,
  `${UNDER_REVIEW}>${REJECTED}`,
  `${ON_HOLD}>${APPROVED}`,
  `${ON_HOLD}>${REJECTED}`,
  `${APPROVED}>${ONBOARDING}`,
  `${ONBOARDING}>${ACTIVATED}`,
]);

function codedError(code) {
  return (err) => err.code === code;
}

describe('funnel transitions', () => {
  beforeEach(() => setup({ entries: [makeEntry('e1')] }));
  afterEach(teardown);

  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const allowed = ALLOWED.has(`${from}>${to}`);
      it(`${from} -> ${to} is ${allowed ? 'allowed' : 'refused'}`, () => {
        assert.equal(canTransition(from, to), allowed);
        if (allowed) return;
        const state = { ...readState(), entries: [makeEntry('e1', from)] };
        assert.throws(() => transition(state, 'e1', to, APPROVER), codedError(ERR.INVALID_TRANSITION));
        assert.equal(state.entries[0].status, from);
      });
    }
  }

  it('makes Rejected and Activated final', () => {
    assert.deepEqual(Object.keys(TRANSITIONS[REJECTED]), []);
    assert.deepEqual(Object.keys(TRANSITIONS[ACTIVATED]), []);
  });

  it('refuses Waitlisted straight to Activated, even for the owner', () => {
    const state = readState();
    assert.throws(() => transition(state, 'e1', ACTIVATED, prospect('e1')), codedError(ERR.INVALID_TRANSITION));
  });

  it('refuses a move by the wrong role', () => {
    const state = readState();
    assert.throws(() => transition(state, 'e1', APPROVED, FOUNDER), codedError(ERR.FORBIDDEN));
    assert.throws(() => transition(state, 'e1', APPROVED, prospect('e1')), codedError(ERR.FORBIDDEN));
  });

  it("refuses a prospect moving someone else's entry", () => {
    const state = { ...readState(), entries: [makeEntry('e1', ONBOARDING)] };
    assert.throws(() => transition(state, 'e1', ACTIVATED, prospect('e2')), codedError(ERR.FORBIDDEN));
  });

  it('refuses Onboarding without a redeemed invite', () => {
    const state = { ...readState(), entries: [makeEntry('e1', APPROVED)] };
    assert.throws(() => transition(state, 'e1', ONBOARDING, prospect('e1')), codedError(ERR.CODE_INVALID));
  });

  it('refuses Activated until every step is complete', () => {
    const steps = ONBOARDING_STEPS.slice(0, 3).map(({ id }) => ({ entryId: 'e1', stepId: id, status: 'complete' }));
    const state = { ...readState(), steps, entries: [makeEntry('e1', ONBOARDING)] };
    assert.throws(() => transition(state, 'e1', ACTIVATED, prospect('e1')), codedError(ERR.STEP_ORDER));
  });

  it('refuses an unknown entry', () => {
    assert.throws(() => transition(readState(), 'nope', APPROVED, APPROVER), codedError(ERR.NOT_FOUND));
  });

  it('writes an audit event for every status change', () => {
    const state = readState();
    transition(state, 'e1', UNDER_REVIEW, APPROVER);
    const event = state.audit.at(-1);
    assert.equal(event.action, 'status.change');
    assert.equal(event.detail, `${WAITLISTED} → ${UNDER_REVIEW}`);
    assert.equal(event.actorRole, ROLE.APPROVER);
  });
});

describe('startReview', () => {
  beforeEach(() => setup({ entries: [makeEntry('e1')] }));
  afterEach(teardown);

  it('lets the approver start a review', () => {
    assert.equal(startReview('e1', APPROVER).ok, true);
    assert.equal(entryStatus('e1'), UNDER_REVIEW);
  });

  it('blocks the founder and logs it', () => {
    const before = dataSnapshot();
    const result = startReview('e1', FOUNDER);
    assert.equal(result.code, ERR.FORBIDDEN);
    assert.equal(dataSnapshot(), before);
    assert.equal(lastAudit().result, 'blocked');
  });
});

describe('queuePosition', () => {
  const entries = [
    makeEntry('late', WAITLISTED, { createdAt: new Date(T0 + 2000).toISOString() }),
    makeEntry('early', UNDER_REVIEW, { createdAt: new Date(T0).toISOString() }),
    makeEntry('middle', WAITLISTED, { createdAt: new Date(T0 + 1000).toISOString() }),
    makeEntry('held', ON_HOLD, { createdAt: new Date(T0 - 5000).toISOString() }),
    makeEntry('done', ACTIVATED, { createdAt: new Date(T0 - 9000).toISOString() }),
  ];

  it('orders by join time and is derived from records', () => {
    assert.equal(queuePosition(entries, 'early'), 1);
    assert.equal(queuePosition(entries, 'middle'), 2);
    assert.equal(queuePosition(entries, 'late'), 3);
  });

  it('gives no position to anyone out of the line', () => {
    assert.equal(queuePosition(entries, 'held'), null);
    assert.equal(queuePosition(entries, 'done'), null);
  });
});
