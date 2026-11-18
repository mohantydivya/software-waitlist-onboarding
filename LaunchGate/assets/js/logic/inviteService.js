// Single-use, expiring invite codes.

import { DAY_MS, INVITE_VALID_DAYS, STATUS } from './constants.js';
import { ERR, LaunchError, validationError } from './errors.js';
import { now, nowIso } from './clock.js';
import { createInviteCode } from './ids.js';
import { appendAudit } from './audit.js';
import { guardedAction } from './roleGuard.js';
import { getEntry, transition } from './funnelService.js';
import { createChecklist } from './onboardingService.js';
import { validateInviteCodeInput } from './validators.js';

export function isExpired(invite, atMs = now()) {
  return atMs >= new Date(invite.expiresAt).getTime();
}

/** The entry's one live code (never a voided one), or null. */
export function activeInvite(state, entryId) {
  return state.invites.find((invite) => invite.entryId === entryId && !invite.voidedAt) ?? null;
}

function uniqueCode(state) {
  let code;
  do {
    code = createInviteCode();
  } while (state.invites.some((invite) => invite.code === code));
  return code;
}

/** Called by approvalService inside its guarded action; not a public entry point. */
export function issueInvite(state, entryId, actor) {
  const invite = {
    code: uniqueCode(state),
    entryId,
    issuedAt: nowIso(),
    expiresAt: new Date(now() + INVITE_VALID_DAYS * DAY_MS).toISOString(),
    usedAt: null,
    voidedAt: null,
  };
  state.invites.push(invite);
  appendAudit(state, {
    actor,
    action: 'invite.issue',
    entryId,
    detail: `Invite issued, valid for ${INVITE_VALID_DAYS} days. Invitation simulated on screen.`,
  });
  return invite;
}

export function redeemInvite(entryId, code, actor) {
  return guardedAction({ action: 'invite.redeem', actor, entryId }, (state) => {
    const errors = validateInviteCodeInput(code);
    if (Object.keys(errors).length > 0) throw validationError(errors);

    const wanted = String(code).trim().toUpperCase();
    const invite = state.invites.find((candidate) => candidate.code === wanted);
    if (!invite) {
      throw new LaunchError(ERR.CODE_INVALID, 'That code is not recognised. Check it against your invitation and try again.');
    }
    if (invite.entryId !== entryId) {
      throw new LaunchError(ERR.CODE_FOREIGN, 'That code belongs to someone else. Enter the code from your own invitation.');
    }
    if (invite.voidedAt) {
      throw new LaunchError(ERR.CODE_VOID, 'That code was replaced by a newer one. Use the code from your latest invitation.');
    }
    if (invite.usedAt) {
      throw new LaunchError(ERR.CODE_USED, 'That code has already been used. Each invite code works once.');
    }
    if (isExpired(invite)) {
      throw new LaunchError(ERR.CODE_EXPIRED, 'That code has expired. Ask the operations team to send you a new one.');
    }

    invite.usedAt = nowIso();
    const entry = transition(state, entryId, STATUS.ONBOARDING, actor);
    createChecklist(state, entryId);
    appendAudit(state, { actor, action: 'invite.redeem', entryId, detail: 'Invite code redeemed.' });
    return { entry };
  });
}

/** Replaces an expired, unused code and voids the old one. */
export function reissueInvite(entryId, actor) {
  return guardedAction({ action: 'invite.reissue', actor, entryId }, (state) => {
    const entry = getEntry(state, entryId);
    if (entry.status !== STATUS.APPROVED) {
      throw new LaunchError(ERR.INVALID_TRANSITION, `A code cannot be reissued while the prospect is ${entry.status}.`);
    }
    const old = activeInvite(state, entryId);
    if (old?.usedAt) throw new LaunchError(ERR.CODE_USED, 'That code was already used, so it cannot be reissued.');
    if (old && !isExpired(old)) {
      throw new LaunchError(ERR.CODE_STILL_VALID, 'The current code has not expired yet, so it cannot be reissued.');
    }
    if (old) old.voidedAt = nowIso();
    return { invite: issueInvite(state, entryId, actor) };
  });
}
