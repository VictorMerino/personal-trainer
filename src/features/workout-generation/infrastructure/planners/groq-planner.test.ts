import { describe, expect, it, vi } from 'vitest';
import { GroqPlanner } from './groq-planner';
import type { Exercise } from '../../domain/exercise/exercise.schema';
import { MovementPattern } from '../../domain/exercise/exercise.schema';
import type { PerPatternSummary } from '../../domain/history/history-summary';
import type { PlanRequest } from '../../domain/planner/workout-planner.port';
import groqSuccess from './fixtures/groq-success.json';
import groqMalformedJson from './fixtures/groq-malformed-json.json';
import groqRateLimited from './fixtures/groq-rate-limited.json';

// Hand-written placeholders, not real provider captures — no GROQ_API_KEY is
// available in this environment. ADR-0012 decision 2 wants real recordings;
// swapping these for a real capture is tracked as a follow-up, not done here.

function exercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'back-squat',
    name: 'Back Squat',
    kind: 'strength',
    pattern: 'knee-dominant',
    roles: ['main'],
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: [],
    equipment: ['barbell'],
    level: 'intermediate',
    jointStress: {},
    impact: 'none',
    unilateral: false,
    progression: 'load',
    defaultRepRange: { min: 6, max: 8 },
    defaultRestSeconds: 120,
    cues: ['brace before descending'],
    ...overrides,
  };
}

const EMPTY_PATTERN_SUMMARY: PerPatternSummary = { daysSinceTrained: null, recentMeanRpe: null, volume: 0 };

function historySummary(): PlanRequest['historySummary'] {
  const perPattern = {} as Record<MovementPattern, PerPatternSummary>;
  for (const pattern of MovementPattern.options) {
    perPattern[pattern] = EMPTY_PATTERN_SUMMARY;
  }
  return { perExercise: {}, perPattern };
}

function request(overrides: Partial<PlanRequest> = {}): PlanRequest {
  return {
    mode: 'NORMAL',
    goal: 'hypertrophy',
    availableMinutes: 45,
    equipmentContext: 'gym',
    effectiveLimitations: [],
    catalog: [exercise()],
    historySummary: historySummary(),
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function fetchReturning(response: Response): typeof fetch {
  return vi.fn().mockResolvedValue(response) as unknown as typeof fetch;
}

describe('GroqPlanner', () => {
  it('returns the parsed, business-valid plan on a successful response', async () => {
    const planner = new GroqPlanner({ apiKey: 'test-key', fetchImpl: fetchReturning(jsonResponse(groqSuccess)) });

    const result = await planner.tryGenerate(request());

    expect(result).toEqual({
      ok: true,
      plan: {
        mode: 'NORMAL',
        blocks: [
          {
            role: 'main',
            exercises: [
              {
                exerciseId: 'back-squat',
                sets: [{ kind: 'load', reps: { min: 6, max: 8 }, loadKg: 60, rpeTarget: 7 }],
              },
            ],
          },
        ],
        generatedBy: 'groq',
        schemaVersion: 1,
        promptVersion: 1,
      },
    });
  });

  it('maps a 429 response to a rate-limited failure', async () => {
    const planner = new GroqPlanner({
      apiKey: 'test-key',
      fetchImpl: fetchReturning(jsonResponse(groqRateLimited, 429)),
    });

    const result = await planner.tryGenerate(request());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('rate-limited');
  });

  it('maps a truncated (invalid JSON) completion to an invalid-response failure', async () => {
    const planner = new GroqPlanner({
      apiKey: 'test-key',
      fetchImpl: fetchReturning(jsonResponse(groqMalformedJson)),
    });

    const result = await planner.tryGenerate(request());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-response');
  });

  it('maps a plan referencing an exercise outside the permitted catalog to business-rule-violation', async () => {
    const offCatalogSuccess = {
      ...groqSuccess,
      choices: [
        {
          ...groqSuccess.choices[0],
          message: {
            role: 'assistant',
            content: JSON.stringify({
              mode: 'NORMAL',
              blocks: [
                {
                  role: 'main',
                  exercises: [
                    {
                      exerciseId: 'not-in-catalog',
                      sets: [{ kind: 'load', reps: { min: 6, max: 8 }, loadKg: 60, rpeTarget: 7 }],
                    },
                  ],
                },
              ],
            }),
          },
        },
      ],
    };
    const planner = new GroqPlanner({ apiKey: 'test-key', fetchImpl: fetchReturning(jsonResponse(offCatalogSuccess)) });

    const result = await planner.tryGenerate(request());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('business-rule-violation');
  });

  it('maps an envelope missing the expected chat completion shape to invalid-response', async () => {
    const planner = new GroqPlanner({
      apiKey: 'test-key',
      fetchImpl: fetchReturning(jsonResponse({ unexpected: 'shape' })),
    });

    const result = await planner.tryGenerate(request());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-response');
  });

  it('maps a rejected fetch to a network-error failure', async () => {
    const planner = new GroqPlanner({
      apiKey: 'test-key',
      fetchImpl: vi.fn().mockRejectedValue(new TypeError('fetch failed')) as unknown as typeof fetch,
    });

    const result = await planner.tryGenerate(request());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('network-error');
  });

  it('maps an aborted (timed out) request to a timeout failure', async () => {
    const neverSettles: typeof fetch = vi.fn((_url, init) => {
      const signal = (init as RequestInit | undefined)?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    }) as unknown as typeof fetch;
    const planner = new GroqPlanner({ apiKey: 'test-key', timeoutMs: 5, fetchImpl: neverSettles });

    const result = await planner.tryGenerate(request());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('timeout');
  });

  it('sends the API key and JSON-mode response format in the request', async () => {
    const fetchMock = fetchReturning(jsonResponse(groqSuccess));
    const planner = new GroqPlanner({ apiKey: 'secret-123', fetchImpl: fetchMock });

    await planner.tryGenerate(request());

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer secret-123' }),
      }),
    );
    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });
});
