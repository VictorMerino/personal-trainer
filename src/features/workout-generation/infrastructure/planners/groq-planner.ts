import { isBusinessValid } from '../../domain/workout-plan/business-validation';
import type { PlannerError } from '../../domain/planner/planner-error';
import type { PlanRequest, PlannerResult, WorkoutPlanner } from '../../domain/planner/workout-planner.port';
import { buildPromptContext, PROMPT_VERSION } from '../prompt/prompt-context';
import { buildGroqMessages } from './groq-prompt';
import { GroqChatCompletionSchema, GroqErrorEnvelopeSchema } from './groq-response.schema';
import { LlmPlanContentSchema, toWorkoutPlan } from './llm-plan-content.schema';

// Reconfirm against console.groq.com/docs at integration time (PROJECT-BRIEF
// §7: provider models/limits change often).
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 15_000;

const INVALID_RESPONSE = 'invalid-response';

export interface GroqPlannerConfig {
  readonly apiKey: string;
  readonly model?: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  // Injectable for tests; defaults to the global fetch (Node >=22).
  readonly fetchImpl?: typeof fetch;
}

type GroqCallResult = { readonly ok: true; readonly value: unknown } | { readonly ok: false; readonly error: PlannerError };

function plannerError(kind: PlannerError['kind'], message: string): PlannerError {
  return { kind, message };
}

function fail(kind: PlannerError['kind'], message: string): PlannerResult {
  return { ok: false, error: plannerError(kind, message) };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = GroqErrorEnvelopeSchema.parse(await response.json());
    return body.error.message;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

export class GroqPlanner implements WorkoutPlanner {
  readonly name = 'groq' as const;

  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: GroqPlannerConfig) {
    this.model = config.model ?? DEFAULT_MODEL;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async tryGenerate(request: PlanRequest): Promise<PlannerResult> {
    const response = await this.callGroq(request);
    if (!response.ok) return { ok: false, error: response.error };

    return this.parsePlan(response.value, request);
  }

  private async callGroq(request: PlanRequest): Promise<GroqCallResult> {
    const context = buildPromptContext(
      { goal: request.goal, availableMinutes: request.availableMinutes, equipmentContext: request.equipmentContext },
      { kind: request.mode },
      request.catalog,
      request.historySummary.perPattern,
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(this.baseUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: buildGroqMessages(context),
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { ok: false, error: plannerError('timeout', `Groq request exceeded ${this.timeoutMs}ms`) };
      }
      return { ok: false, error: plannerError('network-error', error instanceof Error ? error.message : String(error)) };
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 429) {
      return { ok: false, error: plannerError('rate-limited', await readErrorMessage(response)) };
    }
    if (!response.ok) {
      return { ok: false, error: plannerError(INVALID_RESPONSE, await readErrorMessage(response)) };
    }

    return { ok: true, value: await response.json() };
  }

  private parsePlan(body: unknown, request: PlanRequest): PlannerResult {
    const envelope = GroqChatCompletionSchema.safeParse(body);
    if (!envelope.success) {
      logValidationFailure('groq', envelope.error.issues);
      return fail(INVALID_RESPONSE, 'Response did not match the expected Groq chat completion shape');
    }

    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(envelope.data.choices[0].message.content);
    } catch (error) {
      return fail(INVALID_RESPONSE, `Model response was not valid JSON: ${(error as Error).message}`);
    }

    const content = LlmPlanContentSchema.safeParse(parsedContent);
    if (!content.success) {
      logValidationFailure('groq', content.error.issues);
      return fail(INVALID_RESPONSE, 'Model response did not match the expected plan content shape');
    }

    const plan = toWorkoutPlan(content.data, 'groq', PROMPT_VERSION);
    const permittedIds = new Set(request.catalog.map((exercise) => exercise.id));
    if (!isBusinessValid(plan, permittedIds)) {
      return fail('business-rule-violation', 'Plan referenced an exercise outside the permitted catalog subset');
    }

    return { ok: true, plan };
  }
}

// PROJECT-BRIEF §7: log every Zod validation failure on an LLM response —
// the feedback signal for catalog gaps and prompt tuning.
function logValidationFailure(link: WorkoutPlanner['name'], issues: unknown): void {
  console.warn('[planner] validation failure', { link, issues });
}
