// The one clock in the app. Tests replace it to check invite expiry boundaries.

const systemClock = () => Date.now();
let clock = systemClock;

export function now() {
  return clock();
}

export function nowIso() {
  return new Date(clock()).toISOString();
}

export function setClock(fn) {
  clock = fn;
}

export function resetClock() {
  clock = systemClock;
}
