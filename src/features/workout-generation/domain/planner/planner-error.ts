export type PlannerErrorKind =
  | 'rate-limited'
  | 'timeout'
  | 'network-error'
  | 'invalid-response'
  | 'business-rule-violation';

export interface PlannerError {
  readonly kind: PlannerErrorKind;
  readonly message: string;
}
