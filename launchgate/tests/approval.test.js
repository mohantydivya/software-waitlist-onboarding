import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../assets/js/logic/constants.js';
import { ERR } from '../assets/js/logic/errors.js';
import { approve, hold, reject, setCapacity, setCurrentBatch } from '../assets/js/logic/approvalService.js';
import { readState, writeState } from '../assets/js/logic/storage.js';
import { seatsLeft, seatsUsed } from '../assets/js/logic/metrics.js';
import { APPROVER, FOUNDER, dataSnapshot, entryStatus, lastAudit, makeEntry, prospect, setup, teardown } from './helpers.js';

const { WAITLISTED, UNDER_REVIEW, ON_HOLD, APPROVED, REJECTED } = STATUS;
const NOTE = 'A note that is long enough.';

describe('approver decisions', () => {
  beforeEach(() => setup({
    entries: [
      makeEntry('e1'),
      makeEntry('e2', UNDER_REVIEW),
      makeEntry('e3', ON_HOLD),
      makeEntry('gone', REJECTED),
    ],
  }));
  afterEach(teardown);

  it('approves, assigns the batch, records the decision and issues one invite', () => {
    const result = approve('e1', '', APPROVER);
    assert.equal(result.ok, true);
    assert.equal(result.entry.batchId, 'b1');
    assert.equal(result.seatsLeft, 1);
    assert.equal(entryStatus('e1'), APPROVED);
    const state = readState();
    assert.equal(state.decisions.length, 1);
    assert.equal(state.invites.filter((invite) => invite.entryId === 'e1').length, 1);
  });

  it('lets an on-hold prospect be approved or rejected later', () => {
    assert.equal(approve('e3', '', APPROVER).ok, true);
    assert.equal(reject('e2', NOTE, APPROVER).ok, true);
  });

  for (const [name, decide] of [['reject', reject], ['hold', hold]]) {
    it(`${name} needs a note of at least 10 characters`, () => {
      const before = dataSnapshot();
      const result = decide('e1', 'too short', APPROVER);
      assert.equal(result.code, ERR.NOTE_REQUIRED);
      assert.ok(result.fields.note);
      assert.equal(dataSnapshot(), before);
      assert.equal(decide('e1', '   123456789   ', APPROVER).code, ERR.NOTE_REQUIRED);
      assert.equal(decide('e1', '1234567890', APPROVER).ok, true);
    });
  }

  for (const [name, actor] of [['Prospect', prospect('e1')], ['Founder', FOUNDER]]) {
    it(`blocks a ${name} approving, changes nothing and logs the attempt`, () => {
      const before = dataSnapshot();
      const result = approve('e1', '', actor);
      assert.equal(result.ok, false);
      assert.equal(result.code, ERR.FORBIDDEN);
      assert.match(result.message, /Unauthorized/);
      assert.equal(dataSnapshot(), before);
      const event = lastAudit();
      assert.equal(event.result, 'blocked');
      assert.equal(event.action, 'entry.approve');
      assert.equal(event.entryId, 'e1');
      assert.equal(event.actorRole, actor.role);
      assert.equal(event.code, ERR.FORBIDDEN);
    });
  }

  it('blocks a role-less caller', () => {
    assert.equal(approve('e1', '', null).code, ERR.FORBIDDEN);
    assert.equal(lastAudit().actorRole, 'unknown');
  });

  it('refuses a decision on a Rejected prospect, with or without a note', () => {
    const before = dataSnapshot();
    assert.equal(approve('gone', '', APPROVER).code, ERR.INVALID_TRANSITION);
    assert.equal(hold('gone', NOTE, APPROVER).code, ERR.INVALID_TRANSITION);
    assert.equal(reject('gone', 'short', APPROVER).code, ERR.INVALID_TRANSITION);
    assert.equal(dataSnapshot(), before);
    assert.equal(lastAudit().code, ERR.INVALID_TRANSITION);
  });

  it('writes every decision to the audit trail', () => {
    hold('e1', NOTE, APPROVER);
    const actions = readState().audit.map((event) => event.action);
    assert.deepEqual(actions, ['status.change', 'entry.hold']);
    assert.match(lastAudit().detail, /long enough/);
  });

  it('reports a missing prospect', () => {
    assert.equal(approve('nope', '', APPROVER).code, ERR.NOT_FOUND);
  });
});

describe('batch capacity', () => {
  beforeEach(() => setup({ capacity: 1, entries: [makeEntry('e1'), makeEntry('e2')] }));
  afterEach(teardown);

  it('never approves beyond capacity', () => {
    assert.equal(approve('e1', '', APPROVER).ok, true);
    const before = dataSnapshot();
    const result = approve('e2', '', APPROVER);
    assert.equal(result.code, ERR.CAPACITY_FULL);
    assert.equal(dataSnapshot(), before);
    assert.equal(entryStatus('e2'), WAITLISTED);
    assert.equal(lastAudit().code, ERR.CAPACITY_FULL);
    assert.equal(seatsUsed(readState(), 'b1'), 1);
  });

  it('frees the path again once the founder raises capacity', () => {
    approve('e1', '', APPROVER);
    assert.equal(setCapacity('b1', 2, FOUNDER).ok, true);
    assert.equal(approve('e2', '', APPROVER).ok, true);
    assert.equal(seatsLeft(readState(), 'b1'), 0);
  });

  it('re-reads storage before deciding, so a stale tab cannot over-admit', () => {
    approve('e1', '', APPROVER); // another tab took the last seat
    assert.equal(approve('e2', '', APPROVER).code, ERR.CAPACITY_FULL);
  });

  it('refuses approval when no current batch is set', () => {
    const state = readState();
    state.currentBatchId = null;
    writeState(state);
    assert.equal(approve('e1', '', APPROVER).code, ERR.CAPACITY_FULL);
  });
});

describe('setCurrentBatch', () => {
  beforeEach(() => setup({ entries: [makeEntry('e1')] }));
  afterEach(teardown);

  it('is only for the founder', () => {
    assert.equal(setCurrentBatch('b1', APPROVER).code, ERR.FORBIDDEN);
    assert.equal(setCurrentBatch('b1', FOUNDER).ok, true);
    assert.equal(setCurrentBatch('nope', FOUNDER).code, ERR.NOT_FOUND);
  });
});

describe('setCapacity', () => {
  beforeEach(() => setup({ capacity: 2, entries: [makeEntry('e1'), makeEntry('e2')] }));
  afterEach(teardown);

  it('lets the founder set a positive whole number', () => {
    assert.equal(setCapacity('b1', '25', FOUNDER).ok, true);
    assert.equal(readState().batches[0].capacity, 25);
    assert.match(lastAudit().detail, /2 → 25/);
  });

  for (const bad of ['0', '-1', '5.5', '1e2', '', 'ten', '501']) {
    it(`refuses capacity "${bad}"`, () => {
      const result = setCapacity('b1', bad, FOUNDER);
      assert.equal(result.code, ERR.VALIDATION);
      assert.ok(result.fields.capacity);
    });
  }

  it('accepts the maximum of 500', () => {
    assert.equal(setCapacity('b1', 500, FOUNDER).ok, true);
  });

  it('cannot go below the number already approved', () => {
    approve('e1', '', APPROVER);
    approve('e2', '', APPROVER);
    const result = setCapacity('b1', 1, FOUNDER);
    assert.equal(result.code, ERR.CAPACITY_BELOW_USED);
    assert.equal(readState().batches[0].capacity, 2);
    assert.equal(setCapacity('b1', 2, FOUNDER).ok, true);
  });

  it('blocks everyone but the founder', () => {
    assert.equal(setCapacity('b1', 9, APPROVER).code, ERR.FORBIDDEN);
    assert.equal(setCapacity('b1', 9, prospect('e1')).code, ERR.FORBIDDEN);
    assert.equal(lastAudit().action, 'capacity.set');
    assert.equal(readState().batches[0].capacity, 2);
  });

  it('reports a missing batch', () => {
    assert.equal(setCapacity('nope', 5, FOUNDER).code, ERR.NOT_FOUND);
  });
});
