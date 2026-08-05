import { z } from 'zod';
import { Goal } from '../generator/generator.constants';
import { EquipmentContext } from '../readiness/daily-checkin.schema';

// Onboarding fields (PROJECT-BRIEF §5) — Limitation[] lives in its own
// table/endpoints (POST/PATCH /api/profile/limitations, ADR-0011 decision
// 5), not nested under UserProfile here.
export const ExperienceLevel = z.enum(['beginner', 'intermediate', 'advanced']);
export type ExperienceLevel = z.infer<typeof ExperienceLevel>;

export const UserProfileSchema = z.object({
  goal: Goal,
  level: ExperienceLevel,
  defaultEquipmentContext: EquipmentContext,
});
export type UserProfile = z.infer<typeof UserProfileSchema>;
