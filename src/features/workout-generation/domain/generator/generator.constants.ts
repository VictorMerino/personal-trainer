import { z } from 'zod';
import type { MovementPattern } from '../exercise/exercise.schema';

export const Goal = z.enum(['strength', 'hypertrophy', 'general_fitness']);
export type Goal = z.infer<typeof Goal>;

// Fixed pattern-priority order for a full-body session (ADR-0003 decision 1).
export const CORE_PATTERN_PRIORITY: readonly MovementPattern[] = [
  'knee-dominant',
  'hip-dominant',
  'horizontal-push',
  'horizontal-pull',
  'core-antiextension',
];

export const ACCESSORY_PATTERN_PRIORITY: readonly MovementPattern[] = [
  'unilateral-leg',
  'vertical-push',
  'vertical-pull',
  'core-antirotation',
  'locomotion',
];

// Budgets how many pattern slots fit in the available time.
export const ESTIMATED_MINUTES_PER_EXERCISE = 8;

export const REP_RANGE_BY_GOAL = {
  strength: { min: 4, max: 6 },
  hypertrophy: { min: 8, max: 12 },
  general_fitness: { min: 10, max: 15 },
} as const satisfies Record<Goal, { min: number; max: number }>;

export const NORMAL_SET_COUNT = 3;
export const DELOAD_SET_COUNT_FLOOR = 2;

export const NORMAL_RPE_TARGET = 8;
export const DELOAD_RPE_TARGET = 6;
export const ACTIVE_RECOVERY_RPE_TARGET = 3;

// First-ever prescription of an exercise, before any progression history
// exists (ADR-0004 tracks load changes from here, not a starting point).
export const DEFAULT_STARTING_LOAD_KG = 20;
