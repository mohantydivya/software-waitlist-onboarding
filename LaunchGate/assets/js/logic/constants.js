// Shared vocabulary for the funnel. No logic and no imports, so every module can use it.

export const STATUS = Object.freeze({
  WAITLISTED: 'Waitlisted',
  UNDER_REVIEW: 'Under Review',
  ON_HOLD: 'On Hold',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  ONBOARDING: 'Onboarding',
  ACTIVATED: 'Activated',
});

export const ALL_STATUSES = Object.freeze(Object.values(STATUS));

export const ROLE = Object.freeze({
  VISITOR: 'visitor',
  PROSPECT: 'prospect',
  APPROVER: 'approver',
  FOUNDER: 'founder',
});

export const ROLE_LABELS = Object.freeze({
  visitor: 'Visitor',
  prospect: 'Prospect',
  approver: 'Operations Approver',
  founder: 'Founder',
});

export const COMPANY_SIZES = Object.freeze(['1-10', '11-50', '51-200', '201-1000', '1000+']);

export const USE_CASES = Object.freeze([
  'Customer support',
  'Sales operations',
  'Project tracking',
  'Internal tools',
  'Reporting and analytics',
]);

export const TEMPLATES = Object.freeze([
  { id: 'support-desk', label: 'Support desk' },
  { id: 'sales-pipeline', label: 'Sales pipeline' },
  { id: 'project-board', label: 'Project board' },
  { id: 'blank', label: 'Blank workspace' },
]);

export const ONBOARDING_STEPS = Object.freeze([
  { id: 'profile', label: 'Create workspace profile' },
  { id: 'template', label: 'Choose use-case template' },
  { id: 'teammates', label: 'Invite teammates' },
  { id: 'tour', label: 'Finish the product tour' },
]);

export const NOTE_MIN_LENGTH = 10;
export const CAPACITY_MAX = 500;
export const INVITE_VALID_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;
