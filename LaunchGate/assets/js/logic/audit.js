// The audit trail is append-only: this module offers no way to edit or delete an event.

import { nowIso } from './clock.js';
import { createId } from './ids.js';

export const AUDIT_RESULT = Object.freeze({ SUCCESS: 'success', BLOCKED: 'blocked' });

export function actorIdOf(actor) {
  if (!actor) return 'unknown';
  return actor.entryId ?? actor.role ?? 'unknown';
}

export function appendAudit(state, { actor, action, entryId = null, result = AUDIT_RESULT.SUCCESS, code = null, detail = '' }) {
  const event = {
    eventId: createId('evt'),
    actorRole: actor?.role ?? 'unknown',
    actorId: actorIdOf(actor),
    action,
    entryId,
    result,
    code,
    detail,
    createdAt: nowIso(),
  };
  state.audit.push(event);
  return event;
}

/** Newest first. Later events win ties, because they were appended later. */
export function listAudit(state, { action = '', result = '', role = '', entryId = '' } = {}) {
  return state.audit
    .filter(
      (event) =>
        (!action || event.action === action) &&
        (!result || event.result === result) &&
        (!role || event.actorRole === role) &&
        (!entryId || event.entryId === entryId),
    )
    .reverse()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
