// ADR-0004 decision 2: autoregulation compares actual RPE to target and
// adjusts next session's load by a fixed step.
export const RPE_UNDERSHOOT_THRESHOLD = 1.5;
export const RPE_OVERSHOOT_THRESHOLD = 1.5;
export const LOAD_INCREMENT_PCT = 0.025;

// ADR-0004 decision 3: stall detection and its one-session backoff.
export const STALL_SESSIONS_THRESHOLD = 3;
// Same mechanical shape as readiness-DELOAD's per-exercise effect, but its
// own constant — a session-level DELOAD and a per-exercise stall backoff
// are independent mechanisms (ADR-0004 decision 1) and shouldn't be coupled
// to the same numeric value by accident.
export const STALL_BACKOFF_RPE_TARGET = 6;

// ADR-0004 decision 4: conservative restart after a resolved limitation.
export const REINTRODUCTION_LOAD_FACTOR = 0.8;
export const REINTRODUCTION_RPE_CAP = 6;
