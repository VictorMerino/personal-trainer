import { z } from 'zod';
import rawCatalog from './catalog.json' with { type: 'json' };
import { ExerciseSchema, type Exercise } from './exercise.schema';

export const EQUIPMENT_TIERS = ['none', 'basic', 'gym'] as const;
export type EquipmentTier = (typeof EQUIPMENT_TIERS)[number];

const GYM_ONLY_EQUIPMENT = new Set(['barbell', 'machine', 'cable', 'pull-up-bar']);
const NO_EQUIPMENT_ONLY = new Set(['none', 'mat']);

export function equipmentTier(exercise: Exercise): EquipmentTier {
  if (exercise.equipment.some((e) => GYM_ONLY_EQUIPMENT.has(e))) return 'gym';
  if (exercise.equipment.every((e) => NO_EQUIPMENT_ONLY.has(e))) return 'none';
  return 'basic';
}

export const EXERCISE_CATALOG: readonly Exercise[] = z
  .array(ExerciseSchema)
  .parse(rawCatalog);
