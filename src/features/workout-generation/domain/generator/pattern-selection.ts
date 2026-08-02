import type { MovementPattern } from '../exercise/exercise.schema';
import {
  ACCESSORY_PATTERN_PRIORITY,
  CORE_PATTERN_PRIORITY,
  ESTIMATED_MINUTES_PER_EXERCISE,
} from './generator.constants';

const TOTAL_PATTERN_COUNT = CORE_PATTERN_PRIORITY.length + ACCESSORY_PATTERN_PRIORITY.length;

// Core patterns first (fixed priority order); accessories only fill slots
// left over after the core list (ADR-0003 decision 1).
export function selectPatternsForSession(availableMinutes: number): readonly MovementPattern[] {
  const slots = Math.min(
    TOTAL_PATTERN_COUNT,
    Math.max(1, Math.floor(availableMinutes / ESTIMATED_MINUTES_PER_EXERCISE)),
  );

  const core = CORE_PATTERN_PRIORITY.slice(0, slots);
  const accessories = ACCESSORY_PATTERN_PRIORITY.slice(0, slots - core.length);

  return [...core, ...accessories];
}
