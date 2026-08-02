import type { WorkoutPlan } from '../workout-plan/workout-plan.schema';
import { NoPlannerAvailableError } from './no-planner-available.error';
import type { PlannerTelemetry } from './planner-telemetry';
import type { PlanRequest, WorkoutPlanner } from './workout-planner.port';

export class FallbackChainPlanner {
  constructor(
    private readonly chain: readonly WorkoutPlanner[],
    private readonly telemetry: PlannerTelemetry,
  ) {}

  async generate(request: PlanRequest): Promise<WorkoutPlan> {
    for (const planner of this.chain) {
      const result = await planner.tryGenerate(request);
      if (result.ok) return result.plan;
      this.telemetry.record(planner.name, result.error);
    }
    throw new NoPlannerAvailableError();
  }
}
