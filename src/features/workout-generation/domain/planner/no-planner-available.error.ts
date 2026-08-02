// Every link, including the network-free deterministic generator, failed —
// a genuine bug or incident, not a routine outcome (ADR-0005 decision 2).
export class NoPlannerAvailableError extends Error {
  constructor() {
    super('All planners in the fallback chain failed, including the deterministic generator.');
    this.name = 'NoPlannerAvailableError';
  }
}
