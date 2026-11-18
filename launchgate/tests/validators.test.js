import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  findByEmail,
  isValidEmail,
  parseCapacity,
  validateCapacity,
  validateInviteCodeInput,
  validateNote,
  validateSignup,
  validateStepData,
} from '../assets/js/logic/validators.js';
import { SIGNUP, makeEntry } from './helpers.js';

describe('validateSignup', () => {
  it('passes a complete form', () => {
    assert.deepEqual(validateSignup(SIGNUP), {});
  });

  it('reports every empty field', () => {
    assert.deepEqual(Object.keys(validateSignup({})).sort(), [
      'company', 'companySize', 'email', 'jobTitle', 'name', 'useCase',
    ]);
  });

  it('treats whitespace as empty', () => {
    assert.ok(validateSignup({ ...SIGNUP, company: '   ' }).company);
  });

  it('refuses options outside the list', () => {
    assert.ok(validateSignup({ ...SIGNUP, companySize: 'huge' }).companySize);
    assert.ok(validateSignup({ ...SIGNUP, useCase: 'other' }).useCase);
  });
});

describe('email rules', () => {
  for (const good of ['a@b.co', ' Name@Company.Example ', 'first.last+tag@sub.example.org']) {
    it(`accepts "${good}"`, () => assert.equal(isValidEmail(good), true));
  }
  for (const bad of ['', 'plain', 'a@b', '@b.co', 'a b@c.co', 'a@b c.co', 'a@@b.co']) {
    it(`refuses "${bad}"`, () => assert.equal(isValidEmail(bad), false));
  }

  it('matches existing emails case-insensitively', () => {
    const entries = [makeEntry('e1', undefined, { email: 'Sam@Acme.example' })];
    assert.equal(findByEmail(entries, ' sam@ACME.EXAMPLE ').entryId, 'e1');
    assert.equal(findByEmail(entries, 'other@acme.example'), null);
  });
});

describe('notes and capacity', () => {
  it('needs 10 characters after trimming', () => {
    assert.ok(validateNote('123456789').note);
    assert.ok(validateNote('   123456789   ').note);
    assert.deepEqual(validateNote('1234567890'), {});
  });

  it('parses only plain whole numbers', () => {
    assert.equal(parseCapacity('42'), 42);
    assert.equal(parseCapacity(' 42 '), 42);
    assert.equal(parseCapacity(42), 42);
    for (const bad of ['4.2', '-4', '1e3', '', 'abc', null, undefined]) {
      assert.equal(parseCapacity(bad), null);
    }
  });

  it('applies the 1 to 500 range', () => {
    assert.ok(validateCapacity('0').capacity);
    assert.deepEqual(validateCapacity('1'), {});
    assert.deepEqual(validateCapacity('500'), {});
    assert.ok(validateCapacity('501').capacity);
  });

  it('requires a non-empty invite code', () => {
    assert.ok(validateInviteCodeInput(' ').code);
    assert.deepEqual(validateInviteCodeInput('LG-AAAA-BBBB'), {});
  });
});

describe('validateStepData', () => {
  it('checks the workspace name length', () => {
    assert.ok(validateStepData('profile', { workspaceName: 'x' }).workspaceName);
    assert.ok(validateStepData('profile', { workspaceName: 'x'.repeat(61) }).workspaceName);
    assert.deepEqual(validateStepData('profile', { workspaceName: 'Acme' }), {});
  });

  it('checks the template is a real option', () => {
    assert.ok(validateStepData('template', { templateId: 'nope' }).templateId);
    assert.deepEqual(validateStepData('template', { templateId: 'blank' }), {});
  });

  it('allows no teammates but refuses bad addresses and names them', () => {
    assert.deepEqual(validateStepData('teammates', { teammates: '' }), {});
    assert.deepEqual(validateStepData('teammates', { teammates: 'a@b.co; c@d.co' }), {});
    assert.match(validateStepData('teammates', { teammates: 'a@b.co, oops' }).teammates, /oops/);
  });

  it('needs the tour to be confirmed', () => {
    assert.ok(validateStepData('tour', {}).tourDone);
    assert.deepEqual(validateStepData('tour', { tourDone: true }), {});
  });
});
