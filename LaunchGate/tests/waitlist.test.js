import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../assets/js/logic/constants.js';
import { ERR } from '../assets/js/logic/errors.js';
import { AWAITING_DECISION, filterQueue, joinWaitlist } from '../assets/js/logic/waitlistService.js';
import { readState } from '../assets/js/logic/storage.js';
import { APPROVER, FOUNDER, SIGNUP, T0, VISITOR, lastAudit, makeEntry, setup, teardown } from './helpers.js';

describe('joinWaitlist', () => {
  beforeEach(() => setup());
  afterEach(teardown);

  it('saves one Waitlisted entry and returns the queue position', () => {
    const result = joinWaitlist(SIGNUP, VISITOR);
    assert.equal(result.ok, true);
    assert.equal(result.position, 1);
    assert.equal(result.entry.status, STATUS.WAITLISTED);
    assert.equal(readState().entries.length, 1);
    assert.equal(lastAudit().action, 'entry.join');
  });

  it('refuses a duplicate email and points at the existing entry', () => {
    const first = joinWaitlist(SIGNUP, VISITOR);
    const result = joinWaitlist(SIGNUP, VISITOR);
    assert.equal(result.code, ERR.DUPLICATE_EMAIL);
    assert.equal(result.existingEntryId, first.entry.entryId);
    assert.match(result.fields.email, /already on the waitlist/);
    assert.equal(readState().entries.length, 1);
  });

  it('compares emails case-insensitively and ignores spaces', () => {
    joinWaitlist(SIGNUP, VISITOR);
    const result = joinWaitlist({ ...SIGNUP, email: '  TEST@Acme.EXAMPLE ' }, VISITOR);
    assert.equal(result.code, ERR.DUPLICATE_EMAIL);
    assert.equal(lastAudit().result, 'blocked');
  });

  it('returns field errors and saves nothing for an invalid form', () => {
    const result = joinWaitlist({ ...SIGNUP, email: 'nope', name: '' }, VISITOR);
    assert.equal(result.code, ERR.VALIDATION);
    assert.ok(result.fields.email);
    assert.ok(result.fields.name);
    assert.equal(readState().entries.length, 0);
  });

  it('blocks staff roles from joining', () => {
    assert.equal(joinWaitlist(SIGNUP, APPROVER).code, ERR.FORBIDDEN);
    assert.equal(joinWaitlist(SIGNUP, FOUNDER).code, ERR.FORBIDDEN);
  });
});

describe('filterQueue', () => {
  const at = (offset) => new Date(T0 + offset).toISOString();
  const entries = [
    makeEntry('c', STATUS.WAITLISTED, { createdAt: at(3), companySize: '1-10', useCase: 'Internal tools' }),
    makeEntry('a', STATUS.WAITLISTED, { createdAt: at(1), companySize: '11-50', useCase: 'Internal tools' }),
    makeEntry('b', STATUS.ON_HOLD, { createdAt: at(2), companySize: '11-50', useCase: 'Project tracking' }),
    makeEntry('d', STATUS.ACTIVATED, { createdAt: at(0), companySize: '11-50', useCase: 'Internal tools' }),
  ];
  const ids = (filters) => filterQueue(entries, filters).map((entry) => entry.entryId);

  it('lists oldest first', () => {
    assert.deepEqual(ids({}), ['d', 'a', 'b', 'c']);
  });

  it('filters by each field', () => {
    assert.deepEqual(ids({ status: STATUS.ON_HOLD }), ['b']);
    assert.deepEqual(ids({ companySize: '1-10' }), ['c']);
    assert.deepEqual(ids({ useCase: 'Project tracking' }), ['b']);
  });

  it('combines filters', () => {
    assert.deepEqual(ids({ status: STATUS.WAITLISTED, companySize: '11-50', useCase: 'Internal tools' }), ['a']);
    assert.deepEqual(ids({ status: STATUS.REJECTED, companySize: '11-50' }), []);
  });

  it('has an "awaiting decision" view that leaves out finished prospects', () => {
    assert.deepEqual(ids({ status: AWAITING_DECISION }), ['a', 'b', 'c']);
  });

  it('does not reorder the original array', () => {
    filterQueue(entries, {});
    assert.equal(entries[0].entryId, 'c');
  });
});
