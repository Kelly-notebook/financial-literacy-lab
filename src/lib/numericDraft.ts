import { parseNumericInput } from "./numberInput";
export interface NumericRule {
  min: number;
  max: number;
  integer?: boolean;
}
export function validNumber(value: number, rule: NumericRule) {
  return (
    Number.isFinite(value) &&
    value >= rule.min &&
    value <= rule.max &&
    (!rule.integer || Number.isInteger(value))
  );
}
export function resolveNumber(
  text: string | undefined,
  previous: number | undefined,
  initial: string | undefined,
  rule: NumericRule,
) {
  const n = parseNumericInput(text);
  if (validNumber(n, rule)) return n;
  if (previous !== undefined && validNumber(previous, rule)) return previous;
  const fallback = parseNumericInput(initial);
  return validNumber(fallback, rule) ? fallback : NaN;
}
