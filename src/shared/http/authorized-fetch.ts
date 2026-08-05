import { getAccessToken } from '../supabase/browser-client';

export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(input, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
}
