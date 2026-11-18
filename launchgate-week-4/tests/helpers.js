import { DAY_MS, ROLE, STATUS } from '../assets/js/logic/constants.js';
import { resetClock, setClock } from '../assets/js/logic/clock.js';
import { createEmptyState, memoryBackend, readState, useBackend, writeState } from '../assets/js/logic/storage.js';

export const T0 = Date.UTC(2026, 0, 15, 12, 0, 0);

export const APPROVER = Object.freeze({ role: ROLE.APPROVER });
export const FOUNDER = Object.freeze({ role: ROLE.FOUNDER });
export const VISITOR = Object.freeze({ role: ROLE.VISITOR });
export const prospect = (entryId) => ({ role: ROLE.PROSPECT, entryId });

export const SIGNUP = Object.freeze({
  name: 'Test Person',
  email: 'test@acme.example',
  company: 'Acme',
  jobTitle: 'Manager',
  companySize: '11-50',
  useCase: 'Internal tools',
});

let clockMs = T0;

export function advanceClock(ms) {
  clockMs += ms;
}

export function makeEntry(entryId, status = STATUS.WAITLISTED, overrides = {}) {
  return {
    entryId,
    name: `Person ${entryId}`,
    email: `${entryId}@acme.example`,
    company: 'Acme',
    jobTitle: 'Manager',
    companySize: '11-50',
    useCase: 'Internal tools',
    status,
    batchId: null,
    createdAt: new Date(T0 - DAY_MS).toISOString(),
    updatedAt: new Date(T0 - DAY_MS).toISOString(),
    ...overrides,
  };
}

/** Fresh in-memory storage, a fixed clock and one batch with the given capacity. */
export function setup({ entries = [], capacity = 2, invites = [], steps = [] } = {}) {
  clockMs = T0;
  setClock(() => clockMs);
  useBackend(memoryBackend());
  const state = createEmptyState();
  state.batches.push({ batchId: 'b1', label: 'Batch 1', capacity, opensOn: '2026-01-01' });
  state.currentBatchId = 'b1';
  state.entries = entries;
  state.invites = invites;
  state.steps = steps;
  writeState(state);
}

export function teardown() {
  resetClock();
  useBackend(null);
}

/** Everything except the audit trail, for "this changed no data" assertions. */
export function dataSnapshot() {
  const { audit, ...rest } = readState();
  return JSON.stringify(rest);
}

export function lastAudit() {
  return readState().audit.at(-1);
}

export function entryStatus(entryId) {
  return readState().entries.find((entry) => entry.entryId === entryId).status;
}
