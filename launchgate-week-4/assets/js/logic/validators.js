// Pure form validation. Each validator returns field -> message; an empty object means valid.

import { CAPACITY_MAX, COMPANY_SIZES, NOTE_MIN_LENGTH, TEMPLATES, USE_CASES } from './constants.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function isValidEmail(email) {
  return EMAIL_PATTERN.test(normalizeEmail(email));
}

export function findByEmail(entries, email) {
  const wanted = normalizeEmail(email);
  return entries.find((entry) => normalizeEmail(entry.email) === wanted) ?? null;
}

function text(value) {
  return String(value ?? '').trim();
}

export function validateSignup(form) {
  const errors = {};
  if (text(form.name).length < 2) errors.name = 'Enter your full name.';
  if (!text(form.email)) errors.email = 'Enter your work email.';
  else if (!isValidEmail(form.email)) errors.email = 'Enter an email like name@company.example.';
  if (!text(form.company)) errors.company = 'Enter your company name.';
  if (!text(form.jobTitle)) errors.jobTitle = 'Enter your job title.';
  if (!COMPANY_SIZES.includes(form.companySize)) errors.companySize = 'Choose a company size.';
  if (!USE_CASES.includes(form.useCase)) errors.useCase = 'Choose how you plan to use the product.';
  return errors;
}

/** Reject and hold need a note; an approval note is optional. */
export function validateNote(note) {
  const length = text(note).length;
  if (length >= NOTE_MIN_LENGTH) return {};
  return { note: `Write a note of at least ${NOTE_MIN_LENGTH} characters (${length} so far).` };
}

/** Accepts only plain whole numbers, so "5.5", "1e2" and "" are all refused. */
export function parseCapacity(value) {
  const raw = text(value);
  if (!/^\d+$/.test(raw)) return null;
  return Number(raw);
}

export function validateCapacity(value) {
  const capacity = parseCapacity(value);
  if (capacity === null || capacity < 1) return { capacity: 'Enter a positive whole number, such as 25.' };
  if (capacity > CAPACITY_MAX) return { capacity: `Capacity cannot be more than ${CAPACITY_MAX}.` };
  return {};
}

export function validateInviteCodeInput(code) {
  return text(code) ? {} : { code: 'Enter the invite code from your invitation.' };
}

export function parseEmailList(value) {
  return text(value)
    .split(/[\s,;]+/)
    .filter(Boolean);
}

export function validateStepData(stepId, data = {}) {
  if (stepId === 'profile') {
    const name = text(data.workspaceName);
    return name.length >= 2 && name.length <= 60
      ? {}
      : { workspaceName: 'Enter a workspace name of 2 to 60 characters.' };
  }
  if (stepId === 'template') {
    return TEMPLATES.some((template) => template.id === data.templateId)
      ? {}
      : { templateId: 'Choose a template to continue.' };
  }
  if (stepId === 'teammates') {
    const invalid = parseEmailList(data.teammates).filter((email) => !isValidEmail(email));
    return invalid.length === 0
      ? {}
      : { teammates: `Fix or remove: ${invalid.join(', ')}. Separate addresses with commas.` };
  }
  if (stepId === 'tour') {
    return data.tourDone === true ? {} : { tourDone: 'Tick the box once you have read the tour.' };
  }
  return {};
}
