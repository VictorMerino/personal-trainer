import { z } from 'zod';
import { BodyZone } from './exercise/exercise.schema';

export const LimitationSeverity = z.enum(['mild', 'moderate', 'severe']);
export type LimitationSeverity = z.infer<typeof LimitationSeverity>;

export const LimitationSchema = z.object({
  zone: BodyZone,
  severity: LimitationSeverity,
  isActive: z.boolean(),
});

export type Limitation = z.infer<typeof LimitationSchema>;
