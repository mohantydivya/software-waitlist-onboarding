import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ROLE, STATUS } from '../assets/js/logic/constants.js';
import { ERR, LaunchError } from '../assets/js/logic/errors.js';
import { PERMISSIONS, can, canAccessScreen, enforce, guardedAction, logBlockedScreen } from '../assets/js/logic/roleGuard.js';
import { readState } from '../assets/js/logic/storage.js';
import { APPROVER, FOUNDER, VISITOR, dataSnapshot, lastAudit, makeEntry, prospect, setup, teardown } from './helpers.js';

const { VISITOR: V, PROSPECT: P, APPROVER: A, FOUNDER: F } = ROLE;

// The full permission matrix, written out by hand.
const EXPECTED = {
  'entry.join': [V, P],
  'entry.review': [A],
  'entry.approve': [A],
  'entry.reject': [A],
  'entry.hold': [A],
  'invite.reissue': [A],
  'invite.redeem': [P],
  'onboarding.complete': [P],
  'capacity.set': [F],
  'batch.setCurrent': [F],
};

describe('permissions', () => {
  it('covers every action', () => {
    assert.deepEqual(Object.keys(PERMISSIONS).sort(), Object.keys(EXPECTED).sort());
  });

  for (const [action, roles] of Object.entries(EXPECTED)) {
    for (const role of [V, P, A, F]) {
      const allowed = roles.includes(role);
      it(`${role} ${allowed ? 'may' : 'may not'} ${action}`, () => {
        assert.equal(can(role, action), allowed);
      });
    }
  }

  it('refuses unknown actions and roles', () => {
    assert.equal(can(A, 'entry.delete'), false);
    assert.equal(can('admin', 'entry.approve'), false);
    assert.equal(can(undefined, 'entry.approve'), false);
    assert.equal(can(A, 'constructor'), false);
  });
});

describe('screens', () => {
  it('limits each role-specific screen', () => {
    assert.equal(canAccessScreen(A, 'queue'), true);
    assert.equal(canAccessScreen(F, 'queue'), false);
    assert.equal(canAccessScreen(P, 'detail'), false);
    assert.equal(canAccessScreen(F, 'dashboard'), true);
    assert.equal(canAccessScreen(A, 'dashboard'), false);
    assert.equal(canAccessScreen(P, 'status'), true);
    assert.equal(canAccessScreen(V, 'status'), false);
    assert.equal(canAccessScreen(P, 'audit'), false);
  });

  it('shows the audit trail to approver and founder', () => {
    assert.equal(canAccessScreen(A, 'audit'), true);
    assert.equal(canAccessScreen(F, 'audit'), true);
  });

  it('leaves public screens open', () => {
    for (const role of [V, P, A, F]) {
      assert.equal(canAccessScreen(role, 'landing'), true);
      assert.equal(canAccessScreen(role, 'settings'), true);
    }
  });

  it('refuses unknown screens', () => {
    assert.equal(canAccessScreen(A, 'nope'), false);
  });
});

describe('enforce', () => {
  it('passes allowed actors', () => {
    assert.doesNotThrow(() => enforce(APPROVER, 'entry.approve', 'e1'));
    assert.doesNotThrow(() => enforce(prospect('e1'), 'invite.redeem', 'e1'));
  });

  it('keeps a prospect to their own entry', () => {
    assert.throws(() => enforce(prospect('e1'), 'invite.redeem', 'e2'), (err) => err.code === ERR.FORBIDDEN);
    assert.throws(() => enforce({ role: P }, 'invite.redeem', 'e1'), (err) => err.code === ERR.FORBIDDEN);
  });

  it('refuses a missing actor', () => {
    assert.throws(() => enforce(null, 'entry.approve'), (err) => err.code === ERR.FORBIDDEN);
    assert.throws(() => enforce(VISITOR, 'entry.approve'), (err) => err.code === ERR.FORBIDDEN);
  });
});

describe('guardedAction', () => {
  beforeEach(() => setup({ entries: [makeEntry('e1')] }));
  afterEach(teardown);

  it('never runs the body for a forbidden actor', () => {
    let ran = false;
    const result = guardedAction({ action: 'entry.approve', actor: FOUNDER, entryId: 'e1' }, () => {
      ran = true;
    });
    assert.equal(ran, false);
    assert.equal(result.code, ERR.FORBIDDEN);
  });

  it('writes a blocked attempt to the audit trail with who, what and when', () => {
    const before = dataSnapshot();
    guardedAction({ action: 'entry.approve', actor: FOUNDER, entryId: 'e1' }, () => {});
    assert.equal(dataSnapshot(), before);
    const event = lastAudit();
    assert.equal(event.result, 'blocked');
    assert.equal(event.actorRole, F);
    assert.equal(event.action, 'entry.approve');
    assert.equal(event.entryId, 'e1');
    assert.ok(event.createdAt);
  });

  it('discards partial changes when the body refuses', () => {
    const result = guardedAction({ action: 'entry.approve', actor: APPROVER, entryId: 'e1' }, (state) => {
      state.entries[0].status = STATUS.ACTIVATED;
      throw new LaunchError(ERR.CAPACITY_FULL, 'No seats left.');
    });
    assert.equal(result.code, ERR.CAPACITY_FULL);
    assert.equal(readState().entries[0].status, STATUS.WAITLISTED);
  });

  it('saves the body changes on success', () => {
    const result = guardedAction({ action: 'entry.approve', actor: APPROVER, entryId: 'e1' }, (state) => {
      state.entries[0].company = 'Changed';
      return { touched: true };
    });
    assert.deepEqual(result, { ok: true, touched: true });
    assert.equal(readState().entries[0].company, 'Changed');
  });

  it('does not hide programming errors', () => {
    assert.throws(() => guardedAction({ action: 'entry.approve', actor: APPROVER }, () => {
      throw new TypeError('bug');
    }), TypeError);
  });

  it('logs a blocked direct link to a screen', () => {
    logBlockedScreen(FOUNDER, 'queue');
    assert.equal(lastAudit().action, 'screen.queue');
    assert.equal(lastAudit().result, 'blocked');
  });
});
