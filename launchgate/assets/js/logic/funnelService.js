// The funnel as a state machine. transition() is the only code that changes
// entry.status; it validates from-stage, to-stage, role and preconditions.

import { ONBOARDING_STEPS, ROLE, STATUS } from './constants.js';
import { ERR, LaunchError } from './errors.js';
import { nowIso } from './clock.js';
import { appendAudit } from './audit.js';
import { guardedAction } from './roleGuard.js';
import { currentBatch, seatsLeft } from './metrics.js';

const { WAITLISTED, UNDER_REVIEW, ON_HOLD, APPROVED, REJECTED, ONBOARDING, ACTIVATED } = STATUS;
const { PROSPECT, APPROVER } = ROLE;

// status -> { allowed next status: the role that may make that move }
export const TRANSITIONS = Object.freeze({
  [WAITLISTED]: { [UNDER_REVIEW]: APPROVER, [APPROVED]: APPROVER, [ON_HOLD]: APPROVER, [REJECTED]: APPROVER },
  [UNDER_REVIEW]: { [APPROVED]: APPROVER, [ON_HOLD]: APPROVER, [REJECTED]: APPROVER },
  [ON_HOLD]: { [APPROVED]: APPROVER, [REJECTED]: APPROVER },
  [APPROVED]: { [ONBOARDING]: PROSPECT },
  [ONBOARDING]: { [ACTIVATED]: PROSPECT },
  [REJECTED]: {},
  [ACTIVATED]: {},
});

export function canTransition(from, to) {
  return Object.hasOwn(TRANSITIONS[from] ?? {}, to);
}

export function allowedTargets(from) {
  return Object.keys(TRANSITIONS[from] ?? {});
}

export function getEntry(state, entryId) {
  const entry = state.entries.find((candidate) => candidate.entryId === entryId);
  if (!entry) throw new LaunchError(ERR.NOT_FOUND, 'That prospect could not be found.');
  return entry;
}

function checkPreconditions(state, entry, to) {
  if (to === APPROVED) {
    const batch = currentBatch(state);
    if (!batch || seatsLeft(state, batch.batchId) <= 0) {
      throw new LaunchError(
        ERR.CAPACITY_FULL,
        'No seats left in the current batch. Put this prospect on hold or ask the Founder to raise capacity.',
      );
    }
  }
  if (to === ONBOARDING) {
    const redeemed = state.invites.some(
      (invite) => invite.entryId === entry.entryId && invite.usedAt && !invite.voidedAt,
    );
    if (!redeemed) {
      throw new LaunchError(ERR.CODE_INVALID, 'Onboarding starts only after an invite code is redeemed.');
    }
  }
  if (to === ACTIVATED) {
    const done = state.steps.filter(
      (step) => step.entryId === entry.entryId && step.status === 'complete',
    ).length;
    if (done < ONBOARDING_STEPS.length) {
      throw new LaunchError(ERR.STEP_ORDER, 'All onboarding steps must be complete before activation.');
    }
  }
}

/**
 * Moves an entry to a new status on the given state object, or throws a LaunchError.
 * Callers run it inside guardedAction, which discards the state on a throw.
 */
export function transition(state, entryId, to, actor) {
  const entry = getEntry(state, entryId);
  const from = entry.status;
  if (!canTransition(from, to)) {
    throw new LaunchError(ERR.INVALID_TRANSITION, `This change is not allowed: a prospect cannot move from ${from} to ${to}.`);
  }
  const requiredRole = TRANSITIONS[from][to];
  if (actor?.role !== requiredRole) {
    throw new LaunchError(ERR.FORBIDDEN, 'Unauthorized: this role cannot make that status change. Nothing was changed.');
  }
  if (requiredRole === PROSPECT && actor.entryId !== entryId) {
    throw new LaunchError(ERR.FORBIDDEN, 'Unauthorized: you can only act on your own waitlist entry. Nothing was changed.');
  }
  checkPreconditions(state, entry, to);

  if (to === APPROVED) entry.batchId = state.currentBatchId;
  entry.status = to;
  entry.updatedAt = nowIso();
  appendAudit(state, { actor, action: 'status.change', entryId, detail: `${from} → ${to}` });
  return entry;
}

/** The approver picks a prospect up for review. */
export function startReview(entryId, actor) {
  return guardedAction({ action: 'entry.review', actor, entryId }, (state) => ({
    entry: transition(state, entryId, UNDER_REVIEW, actor),
  }));
}

const QUEUED_STATUSES = new Set([WAITLISTED, UNDER_REVIEW]);

export function sortOldestFirst(entries) {
  return [...entries].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.entryId.localeCompare(b.entryId),
  );
}

/** 1-based position among prospects still in line, or null if this entry is not in line. */
export function queuePosition(entries, entryId) {
  const queue = sortOldestFirst(entries.filter((entry) => QUEUED_STATUSES.has(entry.status)));
  const index = queue.findIndex((entry) => entry.entryId === entryId);
  return index === -1 ? null : index + 1;
}
