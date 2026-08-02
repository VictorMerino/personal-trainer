import { describe, expect, it } from 'vitest';
import { EQUIPMENT_TIERS, EXERCISE_CATALOG, equipmentTier } from './catalog';
import { isSuitableFor } from './contraindication-policy';
import { BodyZone, MovementPattern, type StressLevel } from './exercise.schema';
import type { Limitation } from '../limitation.schema';

const PATTERNS = MovementPattern.options;
const ZONES = BodyZone.options;

const MIN_VIABLE_SESSION_SIZE = 5;

describe('exercise catalog integrity', () => {
  it('has unique IDs for every entry', () => {
    const ids = EXERCISE_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(PATTERNS)('has a no-equipment, basic and gym option for pattern "%s"', (pattern) => {
    const exercisesForPattern = EXERCISE_CATALOG.filter(
      (e) => e.pattern === pattern && e.kind !== 'mobility',
    );
    const tiersAvailable = new Set(exercisesForPattern.map(equipmentTier));

    for (const tier of EQUIPMENT_TIERS) {
      expect(tiersAvailable.has(tier)).toBe(true);
    }
  });

  it.each(PATTERNS)('has at least one beginner-level exercise for pattern "%s"', (pattern) => {
    const hasBeginner = EXERCISE_CATALOG.some(
      (e) => e.pattern === pattern && e.level === 'beginner',
    );
    expect(hasBeginner).toBe(true);
  });

  it.each(PATTERNS)('has a cooldown/mobility exercise for pattern "%s"', (pattern) => {
    const hasCooldown = EXERCISE_CATALOG.some(
      (e) => e.pattern === pattern && e.kind === 'mobility' && e.roles.includes('cooldown'),
    );
    expect(hasCooldown).toBe(true);
  });

  it.each(ZONES)('leaves a viable session under a severe "%s" limitation (no dead zone)', (zone) => {
    const limitations: Limitation[] = [{ zone, severity: 'severe', isActive: true }];
    const viable = EXERCISE_CATALOG.filter((e) => isSuitableFor(e, limitations));
    expect(viable.length).toBeGreaterThanOrEqual(MIN_VIABLE_SESSION_SIZE);
  });

  it('every jointStress zone/level referenced is a valid enum pair', () => {
    for (const exercise of EXERCISE_CATALOG) {
      for (const [zone, level] of Object.entries(exercise.jointStress)) {
        expect(ZONES).toContain(zone);
        expect(['none', 'low', 'moderate', 'high'] satisfies StressLevel[]).toContain(level);
      }
    }
  });
});
