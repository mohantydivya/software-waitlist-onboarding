// Approver decisions and Founder capacity settings.

import { STATUS } from './constants.js';
import { ERR, LaunchError, validationError } from './errors.js';
import { nowIso } from './clock.js';
import { createId } from './ids.js';
import { actorIdOf, appendAudit } from './audit.js';
import { guardedAction } from './roleGuard.js';
import { transition } from './funnelService.js';
import { issueInvite } from './inviteService.js';
import { getBatch, seatsLeft, seatsUsed } from './metrics.js';
import { parseCapacity, validateCapacity, validateNote } from './validators.js';

export const DECISIONS = Object.freeze({
  approve: { action: 'entry.approve', to: STATUS.APPROVED, label: 'Approved', noteRequired: false },
  reject: { action: 'entry.reject', to: STATUS.REJECTED, label: 'Rejected', noteRequired: true },
  hold: { action: 'entry.hold', to: STATUS.ON_HOLD, label: 'Put on hold', noteRequired: true },
});

function decide(kind, entryId, note, actor) {
  const { action, to, label, noteRequired } = DECISIONS[kind];
  return guardedAction({ action, actor, entryId }, (state) => {
    // The stage check runs first, so a decision on a Rejected prospect says why.
    // If the note is then refused, guardedAction discards the status change.
    const entry = transition(state, entryId, to, actor);
    const cleanNote = String(note ?? '').trim();
    if (noteRequired) {
      const errors = validateNote(cleanNote);
      if (errors.note) throw new LaunchError(ERR.NOTE_REQUIRED, errors.note, { fields: errors });
    }

    const decision = {
      decisionId: createId('dec'),
      entryId,
      approverId: actorIdOf(actor),
      decision: kind,
      note: cleanNote,
      decidedAt: nowIso(),
    };
    state.decisions.push(decision);
    appendAudit(state, {
      actor,
      action,
      entryId,
      detail: cleanNote ? `${label}. Note: ${cleanNote}` : `${label}.`,
    });

    const invite = kind === 'approve' ? issueInvite(state, entryId, actor) : null;
    return { entry, decision, invite, seatsLeft: entry.batchId ? seatsLeft(state, entry.batchId) : null };
  });
}

export const approve = (entryId, note, actor) => decide('approve', entryId, note, actor);
export const reject = (entryId, note, actor) => decide('reject', entryId, note, actor);
export const hold = (entryId, note, actor) => decide('hold', entryId, note, actor);

export function setCapacity(batchId, value, actor) {
  return guardedAction({ action: 'capacity.set', actor }, (state) => {
    const errors = validateCapacity(value);
    if (Object.keys(errors).length > 0) throw validationError(errors);

    const batch = getBatch(state, batchId);
    if (!batch) throw new LaunchError(ERR.NOT_FOUND, 'That launch batch could not be found.');

    const capacity = parseCapacity(value);
    const used = seatsUsed(state, batchId);
    if (capacity < used) {
      const message = `${batch.label} already has ${used} approved prospects, so capacity cannot be lower than ${used}.`;
      throw new LaunchError(ERR.CAPACITY_BELOW_USED, message, { fields: { capacity: message } });
    }

    const previous = batch.capacity;
    batch.capacity = capacity;
    appendAudit(state, { actor, action: 'capacity.set', detail: `${batch.label}: capacity ${previous} → ${capacity}.` });
    return { batch };
  });
}

export function setCurrentBatch(batchId, actor) {
  return guardedAction({ action: 'batch.setCurrent', actor }, (state) => {
    const batch = getBatch(state, batchId);
    if (!batch) throw new LaunchError(ERR.NOT_FOUND, 'That launch batch could not be found.');
    state.currentBatchId = batchId;
    appendAudit(state, { actor, action: 'batch.setCurrent', detail: `Current batch is now ${batch.label}.` });
    return { batch };
  });
}
