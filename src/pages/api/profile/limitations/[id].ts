import type { APIRoute } from 'astro';
import { z } from 'zod';
import { SupabaseProfileRepository } from '../../../../features/workout-generation/infrastructure/supabase/supabase-profile-repository';
import { requireUser } from '../../_shared/require-user';
import { jsonError, jsonOk } from '../../_shared/api-error';

export const prerender = false;

const SetLimitationStatusBodySchema = z.object({ status: z.enum(['active', 'resolved']) });

export const PATCH: APIRoute = async ({ request, params }) => {
  const limitationId = params.id;
  if (!limitationId) return jsonError(400, 'invalid-body', 'Missing limitation id.');

  const auth = await requireUser(request, { url: import.meta.env.SUPABASE_URL, anonKey: import.meta.env.SUPABASE_ANON_KEY });
  if (auth instanceof Response) return auth;
  const { userId, supabase } = auth;

  const body = await request.json().catch(() => null);
  const parsedBody = SetLimitationStatusBodySchema.safeParse(body);
  if (!parsedBody.success) return jsonError(400, 'invalid-body', 'Status body failed validation.');

  const profileRepository = new SupabaseProfileRepository(supabase);
  const result = await profileRepository.setLimitationStatus(userId, limitationId, parsedBody.data.status);
  if (!result.ok) {
    if (result.error.kind === 'not-found') return jsonError(404, 'not-found', 'No limitation with that id.');
    return jsonError(500, 'save-failed', 'Could not update limitation.');
  }

  return jsonOk({ limitation: result.value });
};
