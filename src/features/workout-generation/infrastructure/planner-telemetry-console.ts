import type { PlannerError } from '../domain/planner/planner-error';
import type { PlannerName } from '../domain/planner/workout-planner.port';
import type { PlannerTelemetry } from '../domain/planner/planner-telemetry';

// Records tier-1 failures only (ADR-0005 decision 3) — a failure-rate
// threshold alert is separate infrastructure, built independently over
// this same data, deliberately not attempted here.
export class ConsolePlannerTelemetry implements PlannerTelemetry {
  record(plannerName: PlannerName, error: PlannerError): void {
    console.warn('[planner] fell through', { plannerName, error });
  }
}
