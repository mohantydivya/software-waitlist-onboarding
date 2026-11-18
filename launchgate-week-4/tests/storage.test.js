import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ERR, LaunchError } from '../assets/js/logic/errors.js';
import { approve } from '../assets/js/logic/approvalService.js';
import { DATA_KEY, SCHEMA_VERSION, createEmptyState, memoryBackend, readState, resetState, useBackend, writeState } from '../assets/js/logic/storage.js';
import { FOUNDER, APPROVER, makeEntry, setup, teardown } from './helpers.js';

const isStorageError = (err) => err instanceof LaunchError && err.code === ERR.STORAGE;

describe('storage', () => {
  beforeEach(() => useBackend(memoryBackend()));
  afterEach(teardown);

  it('seeds sample data on first read and persists it', () => {
    const first = readState();
    assert.ok(first.entries.length > 0);
    assert.equal(first.version, SCHEMA_VERSION);
    assert.deepEqual(readState(), first);
  });

  it('round-trips a saved state', () => {
    const state = createEmptyState();
    state.entries.push(makeEntry('e1'));
    writeState(state);
    assert.equal(readState().entries[0].entryId, 'e1');
  });

  it('replaces data from an older schema version', () => {
    useBackend(memoryBackend({ [DATA_KEY]: JSON.stringify({ version: 0, entries: [] }) }));
    assert.equal(readState().version, SCHEMA_VERSION);
    assert.ok(readState().entries.length > 0);
  });

  it('reports damaged JSON instead of crashing', () => {
    useBackend(memoryBackend({ [DATA_KEY]: '{not json' }));
    assert.throws(readState, isStorageError);
  });

  it('reports a damaged structure', () => {
    useBackend(memoryBackend({ [DATA_KEY]: JSON.stringify({ version: SCHEMA_VERSION, entries: 'x' }) }));
    assert.throws(readState, isStorageError);
  });

  it('reset restores sample data even after damage', () => {
    useBackend(memoryBackend({ [DATA_KEY]: '{not json' }));
    const state = resetState(FOUNDER);
    assert.ok(state.entries.length > 0);
    assert.equal(readState().audit.at(-1).action, 'data.reset');
  });

  it('reports a full or failing backend', () => {
    useBackend({
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    });
    assert.throws(() => writeState(createEmptyState()), isStorageError);
  });
});

describe('storage failures during an action', () => {
  afterEach(teardown);

  it('returns ERR_STORAGE rather than throwing', () => {
    setup({ entries: [makeEntry('e1')] });
    const saved = JSON.stringify(readState());
    useBackend({
      getItem: () => saved,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    });
    const result = approve('e1', '', APPROVER);
    assert.equal(result.ok, false);
    assert.equal(result.code, ERR.STORAGE);
  });
});
