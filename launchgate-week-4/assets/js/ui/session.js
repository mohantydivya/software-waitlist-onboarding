// The active demonstration role. It lives in sessionStorage, so two tabs can be
// two roles side by side. This is a demo login, not authentication.

import { ROLE } from '../logic/constants.js';

const SESSION_KEY = 'launchgate.session';
const VISITOR = Object.freeze({ role: ROLE.VISITOR });

let memorySession = null;

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : (memorySession ?? VISITOR);
  } catch {
    return memorySession ?? VISITOR;
  }
}

export function setSession(session) {
  memorySession = session;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Blocked storage: the in-memory copy keeps the demo working for this page load.
  }
}

/** The session as an actor, dropping a prospect whose entry no longer exists. */
export function resolveActor(state) {
  const session = getSession();
  if (session.role !== ROLE.PROSPECT) return session;
  return state.entries.some((entry) => entry.entryId === session.entryId) ? session : VISITOR;
}

export function homeFor(role) {
  if (role === ROLE.PROSPECT) return '#/status';
  if (role === ROLE.APPROVER) return '#/queue';
  if (role === ROLE.FOUNDER) return '#/dashboard';
  return '#/';
}
