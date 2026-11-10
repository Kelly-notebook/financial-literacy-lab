import { useState, useRef, useEffect } from "react";
import { useNumericDrafts } from "./useNumericDrafts";
import {
  BUDGET_STORAGE_KEY,
  restoreBudget,
  sanitiseBudgetValues,
} from "../lib/budgetStorage";
import type { Values } from "../components/ui";
export function useBudgetForm(initial: Values) {
  const defaults = useRef(initial);
  const [loaded] = useState(() => {
    try {
      return restoreBudget(window.localStorage, initial);
    } catch {
      return { values: initial, restored: false, error: true };
    }
  });
  const [values, setValues] = useState<Values>(loaded.values),
    [dirty, setDirty] = useState(false);
  const [storageStatus, setStorageStatus] = useState(
    loaded.error
      ? "無法讀取本機暫存，仍可繼續試算。"
      : loaded.restored
        ? "migrated" in loaded && loaded.migrated
          ? "已保留舊表單，快速總額已另存換算；原始金額與明細均保留，請確認來源。"
          : "已恢復此瀏覽器的家庭資料。"
        : "編輯後會自動暫存於此瀏覽器。",
  );
  const saved = useRef(loaded.values);
  const numbers = useNumericDrafts(values, defaults.current);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!dirty) return;
    const snapshot = sanitiseBudgetValues(
      values,
      defaults.current,
      saved.current,
    );
    saved.current = snapshot;
    try {
      window.localStorage.setItem(
        BUDGET_STORAGE_KEY,
        JSON.stringify({ version: 1, values: snapshot }),
      );
      setStorageStatus("家庭資料已暫存於此瀏覽器。");
    } catch {
      setStorageStatus(
        "此瀏覽器無法儲存資料；目前試算不受影響，重新整理可能無法恢復。",
      );
    }
  }, [values, dirty]);
  return {
    values,
    set: (key: string, value: string) => {
      setDirty(true);
      setValues((v) => ({ ...v, [key]: value }));
    },
    patch: (patch: Values) => {
      setDirty(true);
      setValues((v) => ({ ...v, ...patch }));
    },
    reset: () => {
      setDirty(true);
      numbers.resetNumbers();
      setRevision((n) => n + 1);
      setValues(defaults.current);
    },
    n: numbers.n,
    registerNumber: numbers.registerNumber,
    revision,
    etfForCalculation: numbers.n("etfMonthly"),
    storageStatus,
    clearSaved: () => {
      setDirty(false);
      numbers.resetNumbers();
      setRevision((n) => n + 1);
      setValues(defaults.current);
      saved.current = defaults.current;
      try {
        window.localStorage.removeItem(BUDGET_STORAGE_KEY);
        setStorageStatus("已清除已儲存資料並重設表單；再次編輯時會重新暫存。");
      } catch {
        setStorageStatus(
          "此瀏覽器無法清除暫存；表單已重設，請透過瀏覽器的網站資料設定清除。",
        );
      }
    },
  };
}
