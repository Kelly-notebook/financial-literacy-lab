import { useRef } from "react";
import { resolveNumber, type NumericRule } from "../lib/numericDraft";
export function useNumericDrafts(
  values: Record<string, string>,
  initial: Record<string, string>,
) {
  const defaults = useRef(initial),
    rules = useRef<Record<string, NumericRule>>({}),
    last = useRef<Record<string, number>>({});
  return {
    registerNumber: (key: string, rule: NumericRule) => {
      rules.current[key] = rule;
    },
    n: (key: string) => {
      const n = resolveNumber(
        values[key],
        last.current[key],
        defaults.current[key],
        rules.current[key] ?? { min: 0, max: 1e12 },
      );
      if (Number.isFinite(n)) last.current[key] = n;
      return n;
    },
    resetNumbers: () => {
      last.current = {};
    },
  };
}
export function useLastValidResult<T>(
  attempt: { data?: T; error?: string },
  revision = 0,
) {
  const last = useRef<{ revision: number; data?: T }>({ revision });
  if (last.current.revision !== revision) last.current = { revision };
  if (attempt.data !== undefined) last.current.data = attempt.data;
  return attempt.data ?? last.current.data;
}
