import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, STATUS } from '../assets/js/logic/constants.js';
import { ERR } from '../assets/js/logic/errors.js';
import { approve } from '../assets/js/logic/approvalService.js';
import { activeInvite, redeemInvite, reissueInvite } from '../assets/js/logic/inviteService.js';
import { createInviteCode } from '../assets/js/logic/ids.js';
import { readState } from '../assets/js/logic/storage.js';
import { APPROVER, FOUNDER, advanceClock, dataSnapshot, entryStatus, lastAudit, makeEntry, prospect, setup, teardown } from './helpers.js';

const { APPROVED, ONBOARDING } = STATUS;

describe('invite codes', () => {
  let code;
  let otherCode;

  beforeEach(() => {
    setup({ capacity: 5, entries: [makeEntry('e1'), makeEntry('e2')] });
    code = approve('e1', '', APPROVER).invite.code;
    otherCode = approve('e2', '', APPROVER).invite.code;
  });
  afterEach(teardown);

  it('issues a code that expires exactly 7 days later', () => {
    const invite = activeInvite(readState(), 'e1');
    const lifetime = new Date(invite.expiresAt) - new Date(invite.issuedAt);
    assert.equal(lifetime, 7 * DAY_MS);
    assert.equal(invite.usedAt, null);
  });

  it('moves the prospect to Onboarding and creates the checklist', () => {
    const result = redeemInvite('e1', code, prospect('e1'));
    assert.equal(result.ok, true);
    assert.equal(entryStatus('e1'), ONBOARDING);
    assert.ok(activeInvite(readState(), 'e1').usedAt);
    assert.equal(readState().steps.filter((step) => step.entryId === 'e1').length, 4);
  });

  it('accepts lower case and surrounding spaces', () => {
    assert.equal(redeemInvite('e1', `  ${code.toLowerCase()} `, prospect('e1')).ok, true);
  });

  it('refuses a code used twice', () => {
    redeemInvite('e1', code, prospect('e1'));
    const result = redeemInvite('e1', code, prospect('e1'));
    assert.equal(result.code, ERR.CODE_USED);
    assert.equal(lastAudit().result, 'blocked');
  });

  it('accepts a code one millisecond before expiry', () => {
    advanceClock(7 * DAY_MS - 1);
    assert.equal(redeemInvite('e1', code, prospect('e1')).ok, true);
  });

  it('refuses a code at the moment of expiry and leaves the prospect Approved', () => {
    advanceClock(7 * DAY_MS);
    const before = dataSnapshot();
    const result = redeemInvite('e1', code, prospect('e1'));
    assert.equal(result.code, ERR.CODE_EXPIRED);
    assert.equal(entryStatus('e1'), APPROVED);
    assert.equal(dataSnapshot(), before);
  });

  it("refuses another prospect's code", () => {
    const before = dataSnapshot();
    assert.equal(redeemInvite('e1', otherCode, prospect('e1')).code, ERR.CODE_FOREIGN);
    assert.equal(dataSnapshot(), before);
    assert.equal(lastAudit().code, ERR.CODE_FOREIGN);
  });

  it('refuses an unknown code', () => {
    assert.equal(redeemInvite('e1', 'LG-NOPE-NOPE', prospect('e1')).code, ERR.CODE_INVALID);
  });

  it('asks for a code when the box is empty, without logging a blocked attempt', () => {
    const eventsBefore = readState().audit.length;
    const result = redeemInvite('e1', '   ', prospect('e1'));
    assert.equal(result.code, ERR.VALIDATION);
    assert.ok(result.fields.code);
    assert.equal(readState().audit.length, eventsBefore);
  });

  it("blocks redeeming on someone else's entry", () => {
    assert.equal(redeemInvite('e1', code, prospect('e2')).code, ERR.FORBIDDEN);
    assert.equal(entryStatus('e1'), APPROVED);
  });

  it('blocks the approver and founder from redeeming', () => {
    assert.equal(redeemInvite('e1', code, APPROVER).code, ERR.FORBIDDEN);
    assert.equal(redeemInvite('e1', code, FOUNDER).code, ERR.FORBIDDEN);
  });

  describe('reissue', () => {
    it('refuses while the code is still valid', () => {
      assert.equal(reissueInvite('e1', APPROVER).code, ERR.CODE_STILL_VALID);
    });

    it('replaces an expired, unused code and voids the old one', () => {
      advanceClock(7 * DAY_MS);
      const result = reissueInvite('e1', APPROVER);
      assert.equal(result.ok, true);
      assert.notEqual(result.invite.code, code);
      assert.equal(redeemInvite('e1', code, prospect('e1')).code, ERR.CODE_VOID);
      assert.equal(redeemInvite('e1', result.invite.code, prospect('e1')).ok, true);
    });

    it('keeps exactly one live code per prospect', () => {
      advanceClock(7 * DAY_MS);
      reissueInvite('e1', APPROVER);
      const live = readState().invites.filter((invite) => invite.entryId === 'e1' && !invite.voidedAt);
      assert.equal(live.length, 1);
    });

    it('refuses once the prospect has moved on', () => {
      redeemInvite('e1', code, prospect('e1'));
      assert.equal(reissueInvite('e1', APPROVER).code, ERR.INVALID_TRANSITION);
    });

    it('is only for the approver', () => {
      advanceClock(7 * DAY_MS);
      assert.equal(reissueInvite('e1', FOUNDER).code, ERR.FORBIDDEN);
      assert.equal(reissueInvite('e1', prospect('e1')).code, ERR.FORBIDDEN);
    });
  });

  it('generates codes in the expected format without repeats', () => {
    const codes = new Set(Array.from({ length: 500 }, createInviteCode));
    assert.equal(codes.size, 500);
    codes.forEach((value) => assert.match(value, /^LG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/));
  });
});
