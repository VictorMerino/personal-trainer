import type { APIRoute } from 'astro';
import { jsonError } from '../_shared/api-error';

export const prerender = false;

// Temporary route to verify Sentry delivery for ADR-0019 (decisions 2, 4, 5).
// Delete after confirming a non-zero accepted count on Sentry's Stats page.
export const GET: APIRoute = async () => jsonError(500, 'sentry-verify', 'Deliberate test error for Sentry delivery verification.');
