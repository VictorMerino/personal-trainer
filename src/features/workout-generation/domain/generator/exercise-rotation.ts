import { equipmentTier } from '../exercise/catalog';
import { isSuitableFor } from '../exercise/contraindication-policy';
import type { Exercise, MovementPattern } from '../exercise/exercise.schema';
import type { Limitation } from '../limitation.schema';
import type { EquipmentContext } from '../readiness/daily-checkin.schema';

const NEVER_USED = new Date(0);

function isWithinEquipmentContext(exercise: Exercise, context: EquipmentContext): boolean {
  const tier = equipmentTier(exercise);
  if (context === 'none') return tier === 'none';
  if (context === 'basic') return tier === 'none' || tier === 'basic';
  return true;
}

export function candidatesForPattern(
  catalog: readonly Exercise[],
  pattern: MovementPattern,
  equipmentContext: EquipmentContext,
  effectiveLimitations: readonly Limitation[],
): readonly Exercise[] {
  return catalog.filter(
    (exercise) =>
      exercise.pattern === pattern &&
      exercise.kind !== 'mobility' &&
      exercise.roles.some((role) => role === 'main' || role === 'accessory') &&
      isWithinEquipmentContext(exercise, equipmentContext) &&
      isSuitableFor(exercise, effectiveLimitations),
  );
}

// Least-recently-used, never random (ADR-0003 decision 2); ties broken by
// exercise ID so the same input always produces the same output.
export function selectExerciseForPattern(
  catalog: readonly Exercise[],
  pattern: MovementPattern,
  equipmentContext: EquipmentContext,
  effectiveLimitations: readonly Limitation[],
  lastUsedByExerciseId: ReadonlyMap<string, Date>,
): Exercise | undefined {
  const candidates = candidatesForPattern(catalog, pattern, equipmentContext, effectiveLimitations);

  return [...candidates].sort((a, b) => {
    const aLastUsed = lastUsedByExerciseId.get(a.id) ?? NEVER_USED;
    const bLastUsed = lastUsedByExerciseId.get(b.id) ?? NEVER_USED;
    if (aLastUsed.getTime() !== bLastUsed.getTime()) {
      return aLastUsed.getTime() - bLastUsed.getTime();
    }
    return a.id.localeCompare(b.id);
  })[0];
}
