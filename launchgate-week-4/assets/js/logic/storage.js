// Versioned JSON persistence. The backend is anything shaped like localStorage,
// so the logic modules run in Node tests with an in-memory backend.

import { storageError } from './errors.js';
import { appendAudit } from './audit.js';
import { buildSampleState } from './sampleData.js';

export const DATA_KEY = 'launchgate.data';
export const SCHEMA_VERSION = 1;

const COLLECTIONS = ['entries', 'decisions', 'batches', 'invites', 'steps', 'audit'];

let backend = null;

export function useBackend(next) {
  backend = next;
}

export function memoryBackend(initial = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => void items.set(key, String(value)),
    removeItem: (key) => void items.delete(key),
  };
}

function getBackend() {
  try {
    const active = backend ?? globalThis.localStorage;
    if (active) return active;
  } catch {
    // Some browsers throw on the localStorage accessor when site data is blocked.
  }
  throw storageError('Browser storage is not available. Allow site data for this page and reload.');
}

export function createEmptyState() {
  return {
    version: SCHEMA_VERSION,
    currentBatchId: null,
    entries: [],
    decisions: [],
    batches: [],
    invites: [],
    steps: [],
    audit: [],
  };
}

function isValidShape(state) {
  return Boolean(state) && COLLECTIONS.every((name) => Array.isArray(state[name]));
}

/** Always re-reads storage, so a decision made in another tab is seen before writing. */
export function readState() {
  const store = getBackend();
  let raw;
  try {
    raw = store.getItem(DATA_KEY);
  } catch {
    throw storageError();
  }
  if (raw === null) return seedState();

  let state;
  try {
    state = JSON.parse(raw);
  } catch {
    throw storageError('The saved data is damaged and could not be read. Reset the sample data to continue.');
  }
  if (state?.version !== SCHEMA_VERSION) return seedState();
  if (!isValidShape(state)) {
    throw storageError('The saved data is damaged and could not be read. Reset the sample data to continue.');
  }
  return state;
}

export function writeState(state) {
  try {
    getBackend().setItem(DATA_KEY, JSON.stringify(state));
  } catch (err) {
    if (err?.code === 'ERR_STORAGE') throw err;
    throw storageError();
  }
}

function freshSample() {
  return { version: SCHEMA_VERSION, ...buildSampleState() };
}

function seedState() {
  const state = freshSample();
  writeState(state);
  return state;
}

/** Works even when the stored data is damaged, because it never reads the old value. */
export function resetState(actor = null) {
  const state = freshSample();
  appendAudit(state, { actor, action: 'data.reset', detail: 'Sample data was reset.' });
  writeState(state);
  return state;
}
