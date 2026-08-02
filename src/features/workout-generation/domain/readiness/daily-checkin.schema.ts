import { z } from 'zod';
import { BodyZone } from '../exercise/exercise.schema';

export const EnergyLevel = z.enum(['low', 'medium', 'high']);
export type EnergyLevel = z.infer<typeof EnergyLevel>;

// Reuses Limitation.severity's vocabulary plus 'none' (ADR-0001 decision 2).
export const PainLevel = z.enum(['none', 'mild', 'moderate', 'severe']);
export type PainLevel = z.infer<typeof PainLevel>;

export const PainReportSchema = z.object({
  zone: BodyZone,
  level: PainLevel,
});
export type PainReport = z.infer<typeof PainReportSchema>;

// Same three tiers as the exercise catalog's equipment tiers (none/basic/gym).
export const EquipmentContext = z.enum(['none', 'basic', 'gym']);
export type EquipmentContext = z.infer<typeof EquipmentContext>;

export const DailyCheckInSchema = z.object({
  energy: EnergyLevel,
  painReports: z.array(PainReportSchema),
  availableMinutes: z.number().int().positive(),
  equipmentContext: EquipmentContext,
});
export type DailyCheckIn = z.infer<typeof DailyCheckInSchema>;
