import type { PlannerError } from './planner-error';
import type { PlannerName } from './workout-planner.port';

// A single call's failure is tier 1 (routine); a failure-rate threshold over
// recorded calls is tier 3, built independently over this data (ADR-0005
// decision 3) — this interface only captures the tier-1 recording point.
export interface PlannerTelemetry {
  record(plannerName: PlannerName, error: PlannerError): void;
}
