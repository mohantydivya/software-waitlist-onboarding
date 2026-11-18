// The single guard. Every state-changing service call runs through guardedAction,
// so role checks hold even when the UI is bypassed from a direct link or the console.

import { ROLE, ROLE_LABELS } from './constants.js';
import { ERR, LaunchError } from './errors.js';
import { AUDIT_RESULT, appendAudit } from './audit.js';
import { readState, writeState } from './storage.js';

const { VISITOR, PROSPECT, APPROVER, FOUNDER } = ROLE;

export const PERMISSIONS = Object.freeze({
  'entry.join': [VISITOR, PROSPECT],
  'entry.review': [APPROVER],
  'entry.approve': [APPROVER],
  'entry.reject': [APPROVER],
  'entry.hold': [APPROVER],
  'invite.reissue': [APPROVER],
  'invite.redeem': [PROSPECT],
  'onboarding.complete': [PROSPECT],
  'capacity.set': [FOUNDER],
  'batch.setCurrent': [FOUNDER],
});

const ALL_ROLES = [VISITOR, PROSPECT, APPROVER, FOUNDER];

export const SCREENS = Object.freeze({
  landing: ALL_ROLES,
  login: ALL_ROLES,
  settings: ALL_ROLES,
  status: [PROSPECT],
  onboarding: [PROSPECT],
  queue: [APPROVER],
  detail: [APPROVER],
  dashboard: [FOUNDER],
  audit: [APPROVER, FOUNDER],
});

// A prospect may take these actions only on their own entry.
const OWN_ENTRY_ACTIONS = new Set(['invite.redeem', 'onboarding.complete']);

export function can(role, action) {
  return Object.hasOwn(PERMISSIONS, action) && PERMISSIONS[action].includes(role);
}

export function canAccessScreen(role, screen) {
  return Object.hasOwn(SCREENS, screen) && SCREENS[screen].includes(role);
}

function roleLabel(actor) {
  return ROLE_LABELS[actor?.role] ?? 'This role';
}

/** Throws ERR_FORBIDDEN unless the actor may take the action on this entry. */
export function enforce(actor, action, entryId = null) {
  if (!can(actor?.role, action)) {
    throw new LaunchError(ERR.FORBIDDEN, `Unauthorized: ${roleLabel(actor)} cannot perform this action. Nothing was changed.`);
  }
  if (OWN_ENTRY_ACTIONS.has(action) && (!actor.entryId || actor.entryId !== entryId)) {
    throw new LaunchError(ERR.FORBIDDEN, 'Unauthorized: you can only act on your own waitlist entry. Nothing was changed.');
  }
}

/**
 * Runs one action: re-read storage, check the role, run the body, write back.
 * A refusal throws away the body's changes; only the blocked audit event is saved.
 * @returns {{ok: true}|{ok: false, code: string, message: string, fields?: object}}
 */
export function guardedAction({ action, actor, entryId = null }, body) {
  try {
    const state = readState();
    enforce(actor, action, entryId);
    const data = body(state) ?? {};
    writeState(state);
    return { ok: true, ...data };
  } catch (err) {
    if (!(err instanceof LaunchError)) throw err;
    return refuse(err, { action, actor, entryId: err.existingEntryId ?? entryId });
  }
}

function refuse(err, { action, actor, entryId }) {
  const failure = {
    ok: false,
    code: err.code,
    message: err.message,
    fields: err.fields,
    existingEntryId: err.existingEntryId,
  };
  if (!err.audit) return failure;
  try {
    logBlocked({ actor, action, entryId, code: err.code, detail: err.message });
    return failure;
  } catch (logErr) {
    if (!(logErr instanceof LaunchError)) throw logErr;
    return { ok: false, code: logErr.code, message: logErr.message };
  }
}

export function logBlocked({ actor, action, entryId = null, code = ERR.FORBIDDEN, detail = '' }) {
  const state = readState();
  appendAudit(state, { actor, action, entryId, result: AUDIT_RESULT.BLOCKED, code, detail });
  writeState(state);
}

/** Records a refused direct link. The router shows the Unauthorized screen. */
export function logBlockedScreen(actor, screen, entryId = null) {
  logBlocked({
    actor,
    action: `screen.${screen}`,
    entryId,
    detail: `${roleLabel(actor)} tried to open a screen it cannot use.`,
  });
}
