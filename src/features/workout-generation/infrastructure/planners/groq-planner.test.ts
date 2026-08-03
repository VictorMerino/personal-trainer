import { describe, expect, it, vi } from 'vitest';
import { GroqPlanner } from './groq-planner';
import type { Exercise } from '../../domain/exercise/exercise.schema';
import { MovementPattern } from '../../domain/exercise/exercise.schema';
import type { PerPatternSummary } from '../../domain/history/history-summary';
import type { PlanRequest } from '../../domain/planner/workout-planner.port';
import groqSuccess from './fixtures/groq-success.json';
import groqMalformedJson from './fixtures/groq-malformed-json.json';
import groqRateLimited from './fixtures/groq-rate-limited.json';

// groq-success.json / groq-malformed-json.json are real recorded Groq
// responses (ADR-0012 decision 2), captured via scripts/capture-groq-fixtures.mjs.
// groq-rate-limited.json remains hand-written from Groq's documented error
// envelope shape — forcing a real 429 would burn free-tier quota on every
// recapture, and there's no documented shape difference to verify.

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

function benchPress(): Exercise {
  return exercise({
    id: 'bench-press',
    name: 'Bench Press',
    pattern: 'horizontal-push',
    equipment: ['barbell', 'bench'],
  });
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
    catalog: [exercise(), benchPress()],
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
            role: 'warmup',
            exercises: [
              { exerciseId: 'back-squat', sets: [{ kind: 'reps', reps: { min: 8, max: 12 }, rpeTarget: 5 }] },
            ],
          },
          {
            role: 'main',
            exercises: [
              {
                exerciseId: 'back-squat',
                sets: [
                  { kind: 'load', reps: { min: 8, max: 12 }, loadKg: 60, rpeTarget: 7 },
                  { kind: 'load', reps: { min: 8, max: 12 }, loadKg: 65, rpeTarget: 8 },
                ],
              },
            ],
          },
          {
            role: 'accessory',
            exercises: [
              {
                exerciseId: 'bench-press',
                sets: [
                  { kind: 'reps', reps: { min: 10, max: 15 }, rpeTarget: 7 },
                  { kind: 'reps', reps: { min: 10, max: 15 }, rpeTarget: 8 },
                ],
              },
            ],
          },
          {
            role: 'cooldown',
            exercises: [{ exerciseId: 'back-squat', sets: [{ kind: 'time', seconds: 60, rpeTarget: 3 }] }],
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

  it('maps a token-truncated json_object failure (real Groq behavior: HTTP 400, not a 200 with bad content) to invalid-response', async () => {
    const planner = new GroqPlanner({
      apiKey: 'test-key',
      fetchImpl: fetchReturning(jsonResponse(groqMalformedJson, 400)),
    });

    const result = await planner.tryGenerate(request());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('invalid-response');
  });

  it('maps a 200 response whose content is not valid JSON to invalid-response (defensive: not observed from real Groq, which errors at HTTP level instead)', async () => {
    const notJson = { ...groqSuccess, choices: [{ ...groqSuccess.choices[0], message: { role: 'assistant', content: '{not valid json' } }] };
    const planner = new GroqPlanner({ apiKey: 'test-key', fetchImpl: fetchReturning(jsonResponse(notJson)) });

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
