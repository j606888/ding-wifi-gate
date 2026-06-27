"use client";

import { useState } from "react";
import { WEEKDAY_LABELS } from "@/lib/schedule";
import {
  DoorCode,
  hhmmToMin,
  inputCls,
  isoToLocal,
  localToIso,
  minToHHMM,
} from "./shared";

export type FormState = {
  code: string;
  label: string;
  mode: "once" | "weekly";
  validFrom: string;
  validUntil: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
};

export const EMPTY_FORM: FormState = {
  code: "",
  label: "",
  mode: "once",
  validFrom: "",
  validUntil: "",
  weekdays: [],
  startTime: "",
  endTime: "",
};

export function codeToForm(c: DoorCode): FormState {
  return {
    code: c.code,
    label: c.label,
    mode: c.recurrence,
    validFrom: c.valid_from ? isoToLocal(c.valid_from) : "",
    validUntil: c.valid_until ? isoToLocal(c.valid_until) : "",
    weekdays: c.weekdays ?? [],
    startTime: c.start_minute != null ? minToHHMM(c.start_minute) : "",
    endTime: c.end_minute != null ? minToHHMM(c.end_minute) : "",
  };
}

// 驗證並組出送給 API 的 body（含切換模式時清掉另一組欄位）
export function buildBody(
  f: FormState
): { body?: Record<string, unknown>; error?: string } {
  if (!/^\d{6}$/.test(f.code)) return { error: "密碼需為 6 位數字" };
  if (!f.label) return { error: "請填寫標籤" };

  if (f.mode === "weekly") {
    if (f.weekdays.length === 0) return { error: "請至少選一個星期" };
    if (!f.startTime || !f.endTime)
      return { error: "請填寫開始與結束時間" };
    if (hhmmToMin(f.startTime) >= hhmmToMin(f.endTime))
      return { error: "結束時間需晚於開始時間" };
    return {
      body: {
        code: f.code,
        label: f.label,
        recurrence: "weekly",
        weekdays: f.weekdays,
        start_minute: hhmmToMin(f.startTime),
        end_minute: hhmmToMin(f.endTime),
        valid_from: null,
        valid_until: null,
      },
    };
  }

  if (!f.validFrom || !f.validUntil)
    return { error: "請填寫開始與結束時間" };
  return {
    body: {
      code: f.code,
      label: f.label,
      recurrence: "once",
      valid_from: localToIso(f.validFrom),
      valid_until: localToIso(f.validUntil),
      weekdays: null,
      start_minute: null,
      end_minute: null,
    },
  };
}

export default function CodeForm({
  initial,
  submitLabel,
  savingLabel,
  resetOnSuccess = false,
  onSubmit,
}: {
  initial: FormState;
  submitLabel: string;
  savingLabel: string;
  resetOnSuccess?: boolean;
  onSubmit: (body: Record<string, unknown>) => Promise<string | null>;
}) {
  const [f, setF] = useState<FormState>(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<FormState>) =>
    setF((prev) => ({ ...prev, ...patch }));

  function toggleWeekday(d: number) {
    setF((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(d)
        ? prev.weekdays.filter((x) => x !== d)
        : [...prev.weekdays, d],
    }));
  }

  async function submit() {
    setError("");
    const { body, error: err } = buildBody(f);
    if (err || !body) {
      setError(err ?? "資料有誤");
      return;
    }
    setSaving(true);
    try {
      const e = await onSubmit(body);
      if (e) {
        setError(e);
        return;
      }
      if (resetOnSuccess) setF(initial);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="tel"
          inputMode="numeric"
          maxLength={6}
          value={f.code}
          onChange={(e) =>
            update({ code: e.target.value.replace(/\D/g, "").slice(0, 6) })
          }
          placeholder="6 位數密碼"
          className={inputCls}
        />
        <input
          value={f.label}
          onChange={(e) => update({ label: e.target.value })}
          placeholder="標籤（例如 媽媽）"
          className={inputCls}
        />
      </div>
      {/* 模式切換：單次 / 每週 */}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
        {(["once", "weekly"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => update({ mode: m })}
            className={`rounded-lg py-1.5 text-sm font-medium transition-colors ${
              f.mode === m
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {m === "once" ? "單次" : "每週"}
          </button>
        ))}
      </div>

      {f.mode === "once" ? (
        <>
          <label className="text-sm text-zinc-500">開始時間</label>
          <input
            type="datetime-local"
            value={f.validFrom}
            onChange={(e) => update({ validFrom: e.target.value })}
            className={inputCls}
          />
          <label className="text-sm text-zinc-500">結束時間</label>
          <input
            type="datetime-local"
            value={f.validUntil}
            onChange={(e) => update({ validUntil: e.target.value })}
            className={inputCls}
          />
        </>
      ) : (
        <>
          <label className="text-sm text-zinc-500">星期（可多選）</label>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((lbl, d) => {
              const on = f.weekdays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleWeekday(d)}
                  className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                    on
                      ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                      : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {lbl}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-zinc-500">開始時間</label>
              <input
                type="time"
                value={f.startTime}
                onChange={(e) => update({ startTime: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-zinc-500">結束時間</label>
              <input
                type="time"
                value={f.endTime}
                onChange={(e) => update({ endTime: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <p className="text-xs text-zinc-400">
            每週固定時段，永久有效直到手動停用。
          </p>
        </>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        onClick={submit}
        disabled={saving}
        className="rounded-xl bg-zinc-900 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {saving ? savingLabel : submitLabel}
      </button>
    </div>
  );
}
