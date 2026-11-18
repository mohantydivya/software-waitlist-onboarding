import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_STATUSES, STATUS } from '../assets/js/logic/constants.js';
import { batchSummaries, funnelMetrics, seatsLeft, seatsUsed, statusCounts } from '../assets/js/logic/metrics.js';
import { makeEntry } from './helpers.js';

const { WAITLISTED, UNDER_REVIEW, ON_HOLD, APPROVED, REJECTED, ONBOARDING, ACTIVATED } = STATUS;

const entries = [
  makeEntry('1', WAITLISTED),
  makeEntry('2', WAITLISTED),
  makeEntry('3', UNDER_REVIEW),
  makeEntry('4', ON_HOLD),
  makeEntry('5', REJECTED),
  makeEntry('6', APPROVED, { batchId: 'b1' }),
  makeEntry('7', APPROVED, { batchId: 'b2' }),
  makeEntry('8', ONBOARDING, { batchId: 'b1' }),
  makeEntry('9', ACTIVATED, { batchId: 'b1' }),
  makeEntry('10', ACTIVATED, { batchId: 'b1' }),
];

const state = {
  entries,
  currentBatchId: 'b1',
  batches: [
    { batchId: 'b1', label: 'One', capacity: 5 },
    { batchId: 'b2', label: 'Two', capacity: 1 },
    { batchId: 'b3', label: 'Three', capacity: 9 },
  ],
};

describe('seats', () => {
  it('counts Approved, Onboarding and Activated only, per batch', () => {
    assert.equal(seatsUsed(state, 'b1'), 4);
    assert.equal(seatsLeft(state, 'b1'), 1);
    assert.equal(seatsLeft(state, 'b2'), 0);
    assert.equal(seatsUsed(state, 'b3'), 0);
    assert.equal(seatsLeft(state, 'nope'), 0);
  });

  it('summarises every batch and marks the current one', () => {
    const [one, , three] = batchSummaries(state);
    assert.deepEqual([one.used, one.left, one.isCurrent], [4, 1, true]);
    assert.deepEqual([three.used, three.left, three.isCurrent], [0, 9, false]);
  });
});

describe('funnel', () => {
  it('counts statuses so they add up to the records', () => {
    const counts = statusCounts(entries);
    assert.equal(counts[WAITLISTED], 2);
    assert.equal(counts[ACTIVATED], 2);
    assert.equal(ALL_STATUSES.reduce((sum, status) => sum + counts[status], 0), entries.length);
  });

  it('derives nested stages, conversion and drop-off', () => {
    const rows = funnelMetrics(entries);
    assert.deepEqual(rows.map((row) => row.count), [10, 8, 5, 3, 2]);
    assert.deepEqual(rows.map((row) => row.dropOff), [0, 2, 3, 2, 1]);
    assert.deepEqual(rows.map((row) => row.conversionFromPrevious), [100, 80, 62.5, 60, 66.7]);
    assert.equal(rows.at(-1).conversionFromJoined, 20);
  });

  it('handles an empty waitlist without dividing by zero', () => {
    const rows = funnelMetrics([]);
    assert.deepEqual(rows.map((row) => row.count), [0, 0, 0, 0, 0]);
    assert.deepEqual(rows.map((row) => row.conversionFromPrevious), [0, 0, 0, 0, 0]);
  });
});
