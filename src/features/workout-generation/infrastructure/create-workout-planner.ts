import { FallbackChainPlanner } from '../domain/planner/fallback-chain-planner';
import { DeterministicPlanner } from '../domain/planner/deterministic-planner';
import { GroqPlanner, type GroqPlannerConfig } from './planners/groq-planner';
import { OpenRouterPlanner, type OpenRouterPlannerConfig } from './planners/openrouter-planner';
import { ConsolePlannerTelemetry } from './planner-telemetry-console';

export interface WorkoutPlannerConfig {
  readonly groq: GroqPlannerConfig;
  readonly openrouter: OpenRouterPlannerConfig;
}

// The degradation chain from docs/PROJECT-BRIEF.md §7: Groq -> OpenRouter ->
// deterministic. Config is injected, not read from env here — same
// convention as the individual adapters (groq-planner.ts,
// openrouter-planner.ts) — so whatever calls this (the not-yet-built
// `generate` endpoint) owns reading import.meta.env.
export function createWorkoutPlanner(config: WorkoutPlannerConfig): FallbackChainPlanner {
  return new FallbackChainPlanner(
    [new GroqPlanner(config.groq), new OpenRouterPlanner(config.openrouter), new DeterministicPlanner()],
    new ConsolePlannerTelemetry(),
  );
}
