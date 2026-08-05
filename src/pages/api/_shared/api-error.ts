// ADR-0011 decision 6: uniform error shape across every endpoint.
export interface ApiError {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export function jsonError(status: number, code: string, message: string): Response {
  const body: ApiError = { error: { code, message } };
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function jsonOk<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
