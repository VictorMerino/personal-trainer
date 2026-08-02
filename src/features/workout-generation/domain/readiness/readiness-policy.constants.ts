// ADR-0001 decision 8: consecutive check-ins with pain >= mild in the same
// zone before the app suggests promoting it to a standing Limitation.
export const PAIN_STREAK_PROMOTION_DAYS = 3;

// Available-time tier boundaries (minutes), inclusive upper bounds.
// No ADR fixes an exact cut, so these are named here rather than left as
// magic numbers scattered through decideTrainingMode.
export const AVAILABLE_MINUTES_LOW_MAX = 20;
export const AVAILABLE_MINUTES_MEDIUM_MAX = 45;
