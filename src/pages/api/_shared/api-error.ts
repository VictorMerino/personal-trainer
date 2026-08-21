import * as Sentry from '@sentry/astro';

// ADR-0011 decision 6: uniform error shape across every endpoint.
export interface ApiError {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

// ADR-0019 decision 2: a request that fails fast can have its execution
// context frozen before Sentry's automatic serverless flush is scheduled,
// silently dropping the event. Every 5xx response is a capture site, so
// this is centralized here rather than left to each call site to remember.
export async function jsonError(status: number, code: string, message: string): Promise<Response> {
  if (status >= 500) {
    Sentry.captureMessage(`${code}: ${message}`, { level: 'error', tags: { code } });
    await Sentry.flush(5000);
  }
  const body: ApiError = { error: { code, message } };
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function jsonOk<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
