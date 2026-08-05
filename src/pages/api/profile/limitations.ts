import type { APIRoute } from 'astro';
import { z } from 'zod';
import { BodyZone } from '../../../features/workout-generation/domain/exercise/exercise.schema';
import { LimitationSeverity } from '../../../features/workout-generation/domain/limitation.schema';
import { SupabaseProfileRepository } from '../../../features/workout-generation/infrastructure/supabase/supabase-profile-repository';
import { requireUser } from '../_shared/require-user';
import { jsonError, jsonOk } from '../_shared/api-error';

export const prerender = false;

const AddLimitationBodySchema = z.object({ zone: BodyZone, severity: LimitationSeverity });

export const POST: APIRoute = async ({ request }) => {
  const auth = await requireUser(request, { url: import.meta.env.SUPABASE_URL, anonKey: import.meta.env.SUPABASE_ANON_KEY });
  if (auth instanceof Response) return auth;
  const { userId, supabase } = auth;

  const body = await request.json().catch(() => null);
  const parsedBody = AddLimitationBodySchema.safeParse(body);
  if (!parsedBody.success) return jsonError(400, 'invalid-body', 'Limitation body failed validation.');

  const profileRepository = new SupabaseProfileRepository(supabase);
  const result = await profileRepository.addLimitation(userId, parsedBody.data.zone, parsedBody.data.severity);
  if (!result.ok) return jsonError(500, 'save-failed', 'Could not save limitation.');

  return jsonOk({ limitation: result.value }, 201);
};
