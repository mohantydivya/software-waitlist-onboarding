// Random identifiers and invite codes, using the platform's secure random source.

// 32 characters without look-alikes (no 0/O or 1/I), so `byte & 31` has no bias.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomChars(length) {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte & 31]).join('');
}

export function createId(prefix) {
  return `${prefix}-${randomChars(10).toLowerCase()}`;
}

export function createInviteCode() {
  return `LG-${randomChars(4)}-${randomChars(4)}`;
}
