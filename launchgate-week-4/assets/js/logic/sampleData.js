// Fictional demo data: prospects at every stage, a full batch, an empty batch and
// an expired invite. Dates are relative to now, so the demo works whenever it is reset.

import { DAY_MS, INVITE_VALID_DAYS, ONBOARDING_STEPS, ROLE, STATUS } from './constants.js';
import { now } from './clock.js';

const { WAITLISTED, UNDER_REVIEW, ON_HOLD, APPROVED, REJECTED, ONBOARDING, ACTIVATED } = STATUS;

export const SAMPLE_CODES = Object.freeze({
  valid: 'LG-DEMO-VALD',
  expired: 'LG-DEMO-EXPD',
  used: 'LG-DEMO-USED',
  fullBatch: 'LG-DEMO-ALFA',
});

const BATCHES = [
  { batchId: 'b-alpha', label: 'Alpha (full)', capacity: 4, opensInDays: -40 },
  { batchId: 'b-beta', label: 'Beta', capacity: 6, opensInDays: -14 },
  { batchId: 'b-general', label: 'General release (empty)', capacity: 10, opensInDays: 21 },
];

// id, name, company, job title, size, use case, status, batch, joined N days ago
const PEOPLE = [
  ['e-001', 'Maya Lindqvist', 'Brightfern Labs', 'Head of Support', '11-50', 'Customer support', ACTIVATED, 'b-alpha', 46],
  ['e-002', 'Tomas Okafor', 'Harbor and Pine', 'Operations Lead', '51-200', 'Project tracking', ACTIVATED, 'b-alpha', 45],
  ['e-003', 'Priya Raman', 'Quillstack', 'Product Manager', '11-50', 'Internal tools', ONBOARDING, 'b-alpha', 44],
  ['e-004', 'Daniel Reyes', 'Copperline', 'Sales Director', '201-1000', 'Sales operations', APPROVED, 'b-alpha', 43],
  ['e-005', 'Lena Fischer', 'Northgate Logistics', 'IT Manager', '1000+', 'Reporting and analytics', ACTIVATED, 'b-beta', 30],
  ['e-006', 'Kofi Mensah', 'Tallyworks', 'Founder', '1-10', 'Project tracking', ONBOARDING, 'b-beta', 28],
  ['e-007', 'Sara Haddad', 'Meadowbank Clinics', 'Practice Manager', '51-200', 'Customer support', APPROVED, 'b-beta', 26],
  ['e-008', 'Jun Park', 'Lumen Forge', 'Engineering Manager', '11-50', 'Internal tools', APPROVED, 'b-beta', 25],
  ['e-009', 'Oliver Grant', 'Solo Consulting', 'Consultant', '1-10', 'Sales operations', REJECTED, null, 24],
  ['e-010', 'Nadia Petrova', 'Fernhill Media', 'Marketing Analyst', '11-50', 'Reporting and analytics', REJECTED, null, 22],
  ['e-011', 'Rafael Costa', 'Bluewater Freight', 'Fleet Coordinator', '201-1000', 'Project tracking', ON_HOLD, null, 20],
  ['e-012', 'Ingrid Solberg', 'Aurora Dental Group', 'Office Manager', '51-200', 'Customer support', ON_HOLD, null, 18],
  ['e-013', 'Aisha Bello', 'Greenlight Finance', 'Compliance Lead', '201-1000', 'Internal tools', UNDER_REVIEW, null, 15],
  ['e-014', 'Marco Bianchi', 'Trattoria Systems', 'CTO', '11-50', 'Sales operations', UNDER_REVIEW, null, 12],
  ['e-015', 'Emily Tran', 'Papercrane Studio', 'Studio Manager', '1-10', 'Project tracking', WAITLISTED, null, 9],
  ['e-016', 'Hiro Tanaka', 'Kestrel Robotics', 'Support Engineer', '51-200', 'Customer support', WAITLISTED, null, 7],
  ['e-017', 'Zanele Dube', 'Baobab Retail', 'Regional Manager', '1000+', 'Sales operations', WAITLISTED, null, 5],
  ['e-018', 'Arjun Mehta', 'Stackfield Data', 'Data Lead', '11-50', 'Reporting and analytics', WAITLISTED, null, 3],
  ['e-019', 'Clara Novak', 'Linden Education', 'Program Director', '201-1000', 'Internal tools', WAITLISTED, null, 1],
];

const NOTES = {
  'e-009': 'Single-person consultancy, outside the launch audience.',
  'e-010': 'Use case is covered by an existing partner tool.',
  'e-011': 'Waiting for their security review to finish.',
  'e-012': 'Asked to revisit once their new office opens.',
};

const INVITES = {
  'e-001': { code: 'LG-DEMO-MAYA', issuedDaysAgo: 40, usedDaysAgo: 39 },
  'e-002': { code: 'LG-DEMO-TOMS', issuedDaysAgo: 40, usedDaysAgo: 38 },
  'e-003': { code: SAMPLE_CODES.used, issuedDaysAgo: 5, usedDaysAgo: 4 },
  'e-004': { code: SAMPLE_CODES.fullBatch, issuedDaysAgo: 2, usedDaysAgo: null },
  'e-005': { code: 'LG-DEMO-LENA', issuedDaysAgo: 14, usedDaysAgo: 13 },
  'e-006': { code: 'LG-DEMO-KOFI', issuedDaysAgo: 4, usedDaysAgo: 3 },
  'e-007': { code: SAMPLE_CODES.valid, issuedDaysAgo: 1, usedDaysAgo: null },
  'e-008': { code: SAMPLE_CODES.expired, issuedDaysAgo: 10, usedDaysAgo: null },
};

// Completed onboarding steps per entry that is not yet activated.
const STEPS_DONE = { 'e-003': 0, 'e-006': 2 };

const SAMPLE_STEP_DATA = {
  profile: { workspaceName: 'Demo Workspace' },
  template: { templateId: 'project-board' },
  teammates: { teammates: '' },
  tour: { tourDone: true },
};

const DECISION_BY_STATUS = {
  [APPROVED]: 'approve',
  [ONBOARDING]: 'approve',
  [ACTIVATED]: 'approve',
  [REJECTED]: 'reject',
  [ON_HOLD]: 'hold',
};

const DECISION_ACTION = { approve: 'entry.approve', reject: 'entry.reject', hold: 'entry.hold' };

const APPROVER_ACTOR = { actorRole: ROLE.APPROVER, actorId: ROLE.APPROVER };

export function buildSampleState(nowMs = now()) {
  const daysAgo = (days) => new Date(nowMs - days * DAY_MS).toISOString();
  const state = {
    currentBatchId: 'b-beta',
    entries: [],
    decisions: [],
    batches: BATCHES.map(({ opensInDays, ...batch }) => ({
      ...batch,
      opensOn: new Date(nowMs + opensInDays * DAY_MS).toISOString().slice(0, 10),
    })),
    invites: [],
    steps: [],
    audit: [],
  };

  let eventNumber = 0;
  const audit = (fields) => {
    eventNumber += 1;
    state.audit.push({
      eventId: `evt-sample-${eventNumber}`,
      entryId: null,
      result: 'success',
      code: null,
      detail: '',
      ...fields,
    });
  };

  PEOPLE.forEach(([entryId, name, company, jobTitle, companySize, useCase, status, batchId, joinedDaysAgo], index) => {
    const createdAt = daysAgo(joinedDaysAgo);
    const email = `${name.split(' ')[0].toLowerCase()}@${company.split(' ')[0].toLowerCase()}.example`;
    state.entries.push({
      entryId, name, email, company, jobTitle, companySize, useCase, status, batchId,
      createdAt,
      updatedAt: createdAt,
    });
    audit({
      actorRole: ROLE.PROSPECT,
      actorId: entryId,
      action: 'entry.join',
      entryId,
      detail: `Joined the waitlist as ${WAITLISTED}.`,
      createdAt,
    });

    const decision = DECISION_BY_STATUS[status];
    if (decision) {
      const decidedAt = daysAgo(INVITES[entryId]?.issuedDaysAgo ?? joinedDaysAgo - 1);
      const note = NOTES[entryId] ?? '';
      state.decisions.push({
        decisionId: `dec-sample-${index + 1}`,
        entryId,
        approverId: ROLE.APPROVER,
        decision,
        note,
        decidedAt,
      });
      audit({
        ...APPROVER_ACTOR,
        action: DECISION_ACTION[decision],
        entryId,
        detail: note ? `${decision} recorded. Note: ${note}` : `${decision} recorded.`,
        createdAt: decidedAt,
      });
      state.entries[index].updatedAt = decidedAt;
    }

    const invite = INVITES[entryId];
    if (invite) {
      const issuedAt = daysAgo(invite.issuedDaysAgo);
      state.invites.push({
        code: invite.code,
        entryId,
        issuedAt,
        expiresAt: new Date(new Date(issuedAt).getTime() + INVITE_VALID_DAYS * DAY_MS).toISOString(),
        usedAt: invite.usedDaysAgo === null ? null : daysAgo(invite.usedDaysAgo),
        voidedAt: null,
      });
    }

    if (status === ONBOARDING || status === ACTIVATED) {
      const done = status === ACTIVATED ? ONBOARDING_STEPS.length : STEPS_DONE[entryId];
      ONBOARDING_STEPS.forEach(({ id }, stepIndex) => {
        const complete = stepIndex < done;
        state.steps.push({
          entryId,
          stepId: id,
          status: complete ? 'complete' : 'pending',
          completedAt: complete ? daysAgo(invite.usedDaysAgo) : null,
          data: complete ? SAMPLE_STEP_DATA[id] : null,
        });
      });
    }
  });

  audit({
    actorRole: ROLE.FOUNDER,
    actorId: ROLE.FOUNDER,
    action: 'entry.approve',
    entryId: 'e-016',
    result: 'blocked',
    code: 'ERR_FORBIDDEN',
    detail: 'Unauthorized: Founder cannot perform this action. Nothing was changed.',
    createdAt: daysAgo(2),
  });

  state.audit.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return state;
}
