import { z } from 'zod';

export const BodyZone = z.enum([
  'knee', 'hip', 'lower-back', 'shoulder', 'elbow', 'wrist', 'ankle', 'neck',
]);
export type BodyZone = z.infer<typeof BodyZone>;

export const StressLevel = z.enum(['none', 'low', 'moderate', 'high']);
export type StressLevel = z.infer<typeof StressLevel>;

export const MovementPattern = z.enum([
  'knee-dominant',        // squat, leg press
  'hip-dominant',         // deadlift, hip thrust
  'unilateral-leg',       // lunges, Bulgarian split squat
  'horizontal-push',      // bench press, push-ups
  'vertical-push',        // overhead press
  'horizontal-pull',      // row
  'vertical-pull',        // pull-ups, lat pulldown
  'core-antiextension',   // plank
  'core-antirotation',    // Pallof press
  'locomotion',           // run, row, bike
]);
export type MovementPattern = z.infer<typeof MovementPattern>;

export const Equipment = z.enum([
  'none', 'dumbbells', 'barbell', 'kettlebell', 'band',
  'machine', 'cable', 'bench', 'pull-up-bar', 'mat',
]);
export type Equipment = z.infer<typeof Equipment>;

export const MuscleGroup = z.enum([
  'quadriceps', 'hamstrings', 'glutes', 'calves',
  'chest', 'back', 'lats', 'shoulders', 'triceps', 'biceps', 'forearms',
  'core', 'lower-back', 'hip-flexors', 'adductors', 'abductors',
]);
export type MuscleGroup = z.infer<typeof MuscleGroup>;

export const ExerciseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(3),
  kind: z.enum(['strength', 'mobility', 'cardio']),
  pattern: MovementPattern,
  roles: z.array(z.enum(['warmup', 'main', 'accessory', 'cooldown'])).min(1),

  primaryMuscles: z.array(MuscleGroup).min(1),
  secondaryMuscles: z.array(MuscleGroup).default([]),
  equipment: z.array(Equipment).min(1),
  level: z.enum(['beginner', 'intermediate', 'advanced']),

  // The field the entire thesis rests on:
  jointStress: z.partialRecord(BodyZone, StressLevel).default({}),
  impact: StressLevel,          // landings, plyometrics, running
  unilateral: z.boolean(),

  progression: z.enum(['load', 'reps', 'time']),
  defaultRepRange: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  }),
  defaultRestSeconds: z.number().int().positive(),

  cues: z.array(z.string()).max(3),   // 2–3 technique cues for the UI
});

export type Exercise = z.infer<typeof ExerciseSchema>;
