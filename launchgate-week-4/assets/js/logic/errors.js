// Every refusal in the logic layer is a LaunchError with one of these codes.

export const ERR = Object.freeze({
  FORBIDDEN: 'ERR_FORBIDDEN',
  VALIDATION: 'ERR_VALIDATION',
  NOT_FOUND: 'ERR_NOT_FOUND',
  DUPLICATE_EMAIL: 'ERR_DUPLICATE_EMAIL',
  INVALID_TRANSITION: 'ERR_INVALID_TRANSITION',
  NOTE_REQUIRED: 'ERR_NOTE_REQUIRED',
  CAPACITY_FULL: 'ERR_CAPACITY_FULL',
  CAPACITY_BELOW_USED: 'ERR_CAPACITY_BELOW_USED',
  CODE_INVALID: 'ERR_CODE_INVALID',
  CODE_FOREIGN: 'ERR_CODE_FOREIGN',
  CODE_USED: 'ERR_CODE_USED',
  CODE_EXPIRED: 'ERR_CODE_EXPIRED',
  CODE_VOID: 'ERR_CODE_VOID',
  CODE_STILL_VALID: 'ERR_CODE_STILL_VALID',
  STEP_ORDER: 'ERR_STEP_ORDER',
  STEP_DONE: 'ERR_STEP_DONE',
  STORAGE: 'ERR_STORAGE',
});

export class LaunchError extends Error {
  /**
   * @param {string} code one of ERR
   * @param {string} message text safe to show to the user
   * @param {object} [extra]
   * @param {Object<string,string>} [extra.fields] per-field messages for inline errors
   * @param {boolean} [extra.audit] false when the refusal is a plain form mistake, not a blocked attempt
   * @param {string} [extra.existingEntryId] the entry a duplicate email belongs to
   */
  constructor(code, message, { fields, audit = true, existingEntryId } = {}) {
    super(message);
    this.name = 'LaunchError';
    this.code = code;
    this.fields = fields;
    this.audit = audit;
    this.existingEntryId = existingEntryId;
  }
}

export function storageError(message) {
  return new LaunchError(
    ERR.STORAGE,
    message ?? 'Your data could not be saved or read. Reset the sample data to continue.',
    { audit: false },
  );
}

export function validationError(fields) {
  return new LaunchError(ERR.VALIDATION, 'Check the highlighted fields and try again.', {
    fields,
    audit: false,
  });
}
