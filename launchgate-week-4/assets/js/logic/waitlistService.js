// Joining the waitlist and listing it for the approver.

import { ROLE, STATUS } from './constants.js';
import { ERR, LaunchError, validationError } from './errors.js';
import { nowIso } from './clock.js';
import { createId } from './ids.js';
import { appendAudit } from './audit.js';
import { guardedAction } from './roleGuard.js';
import { queuePosition, sortOldestFirst } from './funnelService.js';
import { findByEmail, normalizeEmail, validateSignup } from './validators.js';

export const AWAITING_DECISION = 'awaiting';

const AWAITING_STATUSES = new Set([STATUS.WAITLISTED, STATUS.UNDER_REVIEW, STATUS.ON_HOLD]);

export function joinWaitlist(form, actor = { role: ROLE.VISITOR }) {
  return guardedAction({ action: 'entry.join', actor }, (state) => {
    const errors = validateSignup(form);
    if (Object.keys(errors).length > 0) throw validationError(errors);

    const existing = findByEmail(state.entries, form.email);
    if (existing) {
      const message = 'This email is already on the waitlist. Check your status instead.';
      throw new LaunchError(ERR.DUPLICATE_EMAIL, message, {
        fields: { email: message },
        existingEntryId: existing.entryId,
      });
    }

    const timestamp = nowIso();
    const entry = {
      entryId: createId('e'),
      name: String(form.name).trim(),
      email: normalizeEmail(form.email),
      company: String(form.company).trim(),
      jobTitle: String(form.jobTitle).trim(),
      companySize: form.companySize,
      useCase: form.useCase,
      status: STATUS.WAITLISTED,
      batchId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    state.entries.push(entry);
    appendAudit(state, {
      actor: { role: ROLE.PROSPECT, entryId: entry.entryId },
      action: 'entry.join',
      entryId: entry.entryId,
      detail: `Joined the waitlist as ${STATUS.WAITLISTED}.`,
    });
    return { entry, position: queuePosition(state.entries, entry.entryId) };
  });
}

/** Oldest first. All filters apply together; an empty filter matches everything. */
export function filterQueue(entries, { status = '', companySize = '', useCase = '' } = {}) {
  const matchesStatus = (entry) =>
    !status || (status === AWAITING_DECISION ? AWAITING_STATUSES.has(entry.status) : entry.status === status);
  return sortOldestFirst(entries).filter(
    (entry) =>
      matchesStatus(entry) &&
      (!companySize || entry.companySize === companySize) &&
      (!useCase || entry.useCase === useCase),
  );
}
