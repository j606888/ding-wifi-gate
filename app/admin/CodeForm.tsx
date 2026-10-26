"use client";

import { useState } from "react";
import { nextWindowStartMs, WEEKDAY_LABELS, type CodeRow } from "@/lib/schedule";
import { fmtDay } from "@/lib/code-format";
import { RefreshIcon } from "@/app/components/icons";
import {
  DoorCode,
  hhmmToMin,
  inputCls,
  isoToLocal,
  localToIso,
  minToHHMM,
  windowSummary,
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

// 隨機 6 位數密碼（「換一組」用）
function randomCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}

// 用一句話描述目前的設定，例如「清潔阿姨每週二、五 09:00–12:00 可以用 482913 開門。」
function previewText(f: FormState, nowMs: number): string | null {
  const { body } = buildBody(f);
  if (!body) return null;
  const row = body as unknown as CodeRow;
  const base = `${f.label}在${windowSummary(row)} 可以用 ${f.code} 開門。`;
  const next = nextWindowStartMs(row, nowMs);
  if (next == null) return `${base}這個時段已經過了。`;
  if (next <= nowMs) return `${base}現在就能用。`;
  return `${base}下一次是 ${fmtDay(next)}。`;
}

const labelCls = "text-sm font-bold";
const segmentCls = (on: boolean) =>
  `h-10 rounded-[9px] text-[15px] transition-colors ${
    on ? "bg-surface font-bold text-ink" : "text-subtle hover:text-ink"
  }`;

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
  const [f, setF] = useState<FormState>(() =>
    initial.code ? initial : { ...initial, code: randomCode() }
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [nowMs] = useState(() => Date.now());

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

  const preview = previewText(f, nowMs);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-[22px] px-5 pb-4 pt-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="cf-label" className={labelCls}>
            給誰用
          </label>
          <input
            id="cf-label"
            value={f.label}
            onChange={(e) => update({ label: e.target.value })}
            placeholder="例如 清潔阿姨"
            className={inputCls}
          />
          <span className="text-[13px] text-muted">
            會顯示在紀錄和通知裡，例如「清潔阿姨 開門」
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="cf-code" className={labelCls}>
            密碼
          </label>
          <div className="flex gap-2">
            <input
              id="cf-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={f.code}
              onChange={(e) =>
                update({ code: e.target.value.replace(/\D/g, "").slice(0, 6) })
              }
              className={`${inputCls} flex-1 font-mono text-[22px] font-semibold tracking-[0.2em]`}
            />
            <button
              type="button"
              onClick={() => update({ code: randomCode() })}
              className="flex h-13 shrink-0 items-center gap-1.5 rounded-2xl border border-line-strong bg-surface px-3.5 text-[15px]"
            >
              <RefreshIcon size={16} />
              換一組
            </button>
          </div>
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className={`${labelCls} mb-2`}>什麼時候可以用</legend>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1">
            <button
              type="button"
              aria-pressed={f.mode === "once"}
              onClick={() => update({ mode: "once" })}
              className={segmentCls(f.mode === "once")}
            >
              一段時間
            </button>
            <button
              type="button"
              aria-pressed={f.mode === "weekly"}
              onClick={() => update({ mode: "weekly" })}
              className={segmentCls(f.mode === "weekly")}
            >
              每週固定
            </button>
          </div>

          {f.mode === "once" ? (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cf-from" className="text-[13px] text-muted">
                  從
                </label>
                <input
                  id="cf-from"
                  type="datetime-local"
                  value={f.validFrom}
                  onChange={(e) => update({ validFrom: e.target.value })}
                  className={`${inputCls} font-mono text-base`}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cf-until" className="text-[13px] text-muted">
                  到
                </label>
                <input
                  id="cf-until"
                  type="datetime-local"
                  value={f.validUntil}
                  onChange={(e) => update({ validUntil: e.target.value })}
                  className={`${inputCls} font-mono text-base`}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="星期">
                {WEEKDAY_LABELS.map((lbl, d) => {
                  const on = f.weekdays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleWeekday(d)}
                      className={`h-11 rounded-xl text-[15px] transition-colors ${
                        on
                          ? "bg-ink font-bold text-white"
                          : "border border-line-strong bg-surface text-ink"
                      }`}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cf-start" className="text-[13px] text-muted">
                    從
                  </label>
                  <input
                    id="cf-start"
                    type="time"
                    value={f.startTime}
                    onChange={(e) => update({ startTime: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cf-end" className="text-[13px] text-muted">
                    到
                  </label>
                  <input
                    id="cf-end"
                    type="time"
                    value={f.endTime}
                    onChange={(e) => update({ endTime: e.target.value })}
                    className={`${inputCls} font-mono`}
                  />
                </div>
              </div>
              <p className="text-[13px] text-muted">每週固定時段，一直有效到你停用為止。</p>
            </>
          )}
        </fieldset>

        <div
          aria-live="polite"
          className="rounded-2xl border border-line bg-surface px-4 py-3.5 text-[15px] leading-relaxed"
        >
          {preview ?? (
            <span className="text-muted">填好上面的欄位，這裡會用一句話確認設定。</span>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-line bg-ground px-5 pb-[max(env(safe-area-inset-bottom),32px)] pt-3">
        {error && (
          <p role="alert" className="text-center text-sm text-danger">
            {error}
          </p>
        )}
        <button
          onClick={submit}
          disabled={saving}
          className="h-14 w-full rounded-2xl bg-accent text-lg font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-45"
        >
          {saving ? savingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
}
