// Everything here is derived from records on demand. Nothing is stored,
// so seats and funnel counts can never disagree with the entries.

import { ALL_STATUSES, STATUS } from './constants.js';

const { UNDER_REVIEW, ON_HOLD, APPROVED, REJECTED, ONBOARDING, ACTIVATED } = STATUS;

const SEAT_STATUSES = new Set([APPROVED, ONBOARDING, ACTIVATED]);

export function getBatch(state, batchId) {
  return state.batches.find((batch) => batch.batchId === batchId) ?? null;
}

export function currentBatch(state) {
  return getBatch(state, state.currentBatchId);
}

export function seatsUsed(state, batchId) {
  return state.entries.filter((entry) => entry.batchId === batchId && SEAT_STATUSES.has(entry.status)).length;
}

export function seatsLeft(state, batchId) {
  const batch = getBatch(state, batchId);
  if (!batch) return 0;
  return Math.max(batch.capacity - seatsUsed(state, batchId), 0);
}

export function batchSummaries(state) {
  return state.batches.map((batch) => ({
    ...batch,
    used: seatsUsed(state, batch.batchId),
    left: seatsLeft(state, batch.batchId),
    isCurrent: batch.batchId === state.currentBatchId,
  }));
}

export function statusCounts(entries) {
  const counts = Object.fromEntries(ALL_STATUSES.map((status) => [status, 0]));
  entries.forEach((entry) => {
    counts[entry.status] += 1;
  });
  return counts;
}

function percent(part, whole) {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10;
}

// Stages nest because the funnel never moves backwards: everyone Activated was
// once Onboarding, and so on. "Reviewed" means the prospect has left Waitlisted.
const FUNNEL_STAGES = [
  { id: 'joined', label: 'Joined', statuses: ALL_STATUSES },
  { id: 'reviewed', label: 'Reviewed', statuses: [UNDER_REVIEW, ON_HOLD, REJECTED, APPROVED, ONBOARDING, ACTIVATED] },
  { id: 'approved', label: 'Reached approval', statuses: [APPROVED, ONBOARDING, ACTIVATED] },
  { id: 'onboarding', label: 'Reached onboarding', statuses: [ONBOARDING, ACTIVATED] },
  { id: 'activated', label: 'Activated', statuses: [ACTIVATED] },
];

/** Each stage: how many reached it, conversion from the stage before, and how many dropped. */
export function funnelMetrics(entries) {
  const total = entries.length;
  let previous = total;
  return FUNNEL_STAGES.map((stage) => {
    const count = entries.filter((entry) => stage.statuses.includes(entry.status)).length;
    const row = {
      id: stage.id,
      label: stage.label,
      count,
      conversionFromPrevious: percent(count, previous),
      conversionFromJoined: percent(count, total),
      dropOff: previous - count,
    };
    previous = count;
    return row;
  });
}
