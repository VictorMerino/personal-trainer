import type { APIRoute } from 'astro';
import { UserProfileSchema } from '../../features/workout-generation/domain/profile/user-profile.schema';
import { SupabaseProfileRepository } from '../../features/workout-generation/infrastructure/supabase/supabase-profile-repository';
import { requireUser } from './_shared/require-user';
import { jsonError, jsonOk } from './_shared/api-error';

export const prerender = false;

async function authenticate(request: Request) {
  return requireUser(request, { url: import.meta.env.SUPABASE_URL, anonKey: import.meta.env.SUPABASE_ANON_KEY });
}

export const GET: APIRoute = async ({ request }) => {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const { userId, supabase } = auth;

  const profileRepository = new SupabaseProfileRepository(supabase);
  const [profileResult, limitationsResult] = await Promise.all([
    profileRepository.getProfile(userId),
    profileRepository.getLimitations(userId),
  ]);

  if (!profileResult.ok) return jsonError(404, 'not-found', 'No profile for this user.');
  if (!limitationsResult.ok) return jsonError(500, 'read-failed', 'Could not read limitations.');

  return jsonOk({ profile: profileResult.value, limitations: limitationsResult.value });
};

export const PUT: APIRoute = async ({ request }) => {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const { userId, supabase } = auth;

  const body = await request.json().catch(() => null);
  const parsedBody = UserProfileSchema.safeParse(body);
  if (!parsedBody.success) return jsonError(400, 'invalid-body', 'Profile body failed validation.');

  const profileRepository = new SupabaseProfileRepository(supabase);
  const result = await profileRepository.upsertProfile(userId, parsedBody.data);
  if (!result.ok) return jsonError(500, 'save-failed', 'Could not save profile.');

  return jsonOk({ profile: result.value });
};
