"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WEEKDAY_LABELS } from "@/lib/schedule";

type DoorCode = {
  id: number;
  code: string;
  label: string;
  recurrence: "once" | "weekly";
  weekdays: number[] | null;
  start_minute: number | null;
  end_minute: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  usage_count: number;
};

function fmt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}

// 分鐘數（本地午夜起算）→ "HH:MM"
function minToHHMM(m: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(m / 60))}:${p(m % 60)}`;
}

// "HH:MM" → 分鐘數
function hhmmToMin(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

// 週期密碼摘要：每週二、四 19:15–22:30
function weeklySummary(c: DoorCode): string {
  const days = (c.weekdays ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join("、");
  return `每週${days} ${minToHHMM(c.start_minute ?? 0)}–${minToHHMM(
    c.end_minute ?? 0
  )}`;
}

// datetime-local 的值（本地時區）→ ISO
function localToIso(value: string): string {
  return new Date(value).toISOString();
}

// ISO → datetime-local 的值（本地時區，"YYYY-MM-DDTHH:MM"）
function isoToLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

// 一組密碼的時段摘要（單次顯示日期區間，每週顯示固定時段）
function windowSummary(c: DoorCode): string {
  if (c.recurrence === "weekly") return weeklySummary(c);
  return c.valid_from && c.valid_until
    ? `${fmt(c.valid_from)} – ${fmt(c.valid_until)}`
    : "";
}

// 可一鍵複製貼到群組的分享訊息
function shareText(c: DoorCode): string {
  return [
    "🔑 鐵捲門開門密碼",
    `密碼：${c.code}`,
    `開放時段：${windowSummary(c)}`,
  ].join("\n");
}

const inputCls =
  "w-full min-w-0 appearance-none rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50";

// ---- 共用表單 ----

type FormState = {
  code: string;
  label: string;
  mode: "once" | "weekly";
  validFrom: string;
  validUntil: string;
  weekdays: number[];
  startTime: string;
  endTime: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  label: "",
  mode: "once",
  validFrom: "",
  validUntil: "",
  weekdays: [],
  startTime: "",
  endTime: "",
};

function codeToForm(c: DoorCode): FormState {
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
function buildBody(
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

function CodeForm({
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

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]" />
  );
}

export default function AdminClient() {
  const router = useRouter();
  const [codes, setCodes] = useState<DoorCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs] = useState(() => Date.now());

  const [confirmTarget, setConfirmTarget] = useState<DoorCode | null>(null);
  const [editTarget, setEditTarget] = useState<DoorCode | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/codes");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    setCodes(data.codes ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    // 進頁面時載入一次密碼清單（取資料後才 setState）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleCreate(
    body: Record<string, unknown>
  ): Promise<string | null> {
    const res = await fetch("/api/admin/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "建立失敗";
    await load();
    return null;
  }

  async function handleUpdate(
    id: number,
    body: Record<string, unknown>
  ): Promise<string | null> {
    const res = await fetch(`/api/admin/codes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "更新失敗";
    await load();
    return null;
  }

  async function toggleActive(c: DoorCode) {
    setTogglingId(c.id);
    try {
      await fetch(`/api/admin/codes/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !c.is_active }),
      });
      await load();
    } finally {
      setTogglingId(null);
    }
  }

  async function remove(c: DoorCode) {
    await fetch(`/api/admin/codes/${c.id}`, { method: "DELETE" });
    setConfirmTarget(null);
    await load();
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? "" : t)), 2000);
  }

  async function share(c: DoorCode) {
    try {
      await navigator.clipboard.writeText(shareText(c));
      showToast("已複製分享訊息");
    } catch {
      showToast("複製失敗，請手動複製");
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  const actionBtnCls =
    "rounded-lg border border-zinc-300 px-3 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

  return (
    <div className="min-h-full bg-zinc-100 px-4 py-8 dark:bg-zinc-950">
      {/* 通知 toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-900">
            {toast}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            密碼管理
          </h1>
          <button
            onClick={logout}
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            登出
          </button>
        </div>

        {/* 新增密碼 */}
        <div className="mb-8 rounded-2xl bg-white p-5 shadow-sm dark:bg-zinc-900">
          <h2 className="mb-4 font-medium text-zinc-900 dark:text-zinc-50">
            新增密碼
          </h2>
          <CodeForm
            initial={EMPTY_FORM}
            submitLabel="建立"
            savingLabel="建立中…"
            resetOnSuccess
            onSubmit={handleCreate}
          />
        </div>

        {/* 密碼清單 */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="h-5 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="mt-2 h-4 w-52 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    <div className="mt-2 h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {[0, 1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="h-7 w-14 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : codes.length === 0 ? (
          <p className="text-center text-zinc-500">尚無密碼</p>
        ) : (
          <div className="flex flex-col gap-3">
            {codes.map((c) => {
              const expired =
                c.recurrence === "once" &&
                !!c.valid_until &&
                new Date(c.valid_until).getTime() < nowMs;
              const toggling = togglingId === c.id;
              return (
                <div
                  key={c.id}
                  className="rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                          {c.code}
                        </span>
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {c.label}
                        </span>
                        {!c.is_active && (
                          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                            已停用
                          </span>
                        )}
                        {c.is_active && expired && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            已過期
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-zinc-500">
                        {windowSummary(c)}
                      </div>
                      <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                        已開門 {c.usage_count} 次
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 text-sm">
                      <button onClick={() => share(c)} className={actionBtnCls}>
                        分享
                      </button>
                      <button
                        onClick={() => setEditTarget(c)}
                        className={actionBtnCls}
                      >
                        編輯
                      </button>
                      <button
                        onClick={() => toggleActive(c)}
                        disabled={toggling}
                        className={`flex min-w-[3.5rem] items-center justify-center ${actionBtnCls} disabled:opacity-60`}
                      >
                        {toggling ? <Spinner /> : c.is_active ? "停用" : "啟用"}
                      </button>
                      <button
                        onClick={() => setConfirmTarget(c)}
                        className="rounded-lg border border-red-200 px-3 py-1 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 編輯密碼 */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setEditTarget(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                編輯密碼
              </h3>
              <button
                onClick={() => setEditTarget(null)}
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
              >
                取消
              </button>
            </div>
            <CodeForm
              initial={codeToForm(editTarget)}
              submitLabel="儲存"
              savingLabel="儲存中…"
              onSubmit={async (body) => {
                const e = await handleUpdate(editTarget.id, body);
                if (!e) setEditTarget(null);
                return e;
              }}
            />
          </div>
        </div>
      )}

      {/* 刪除確認 */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirmTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              確定刪除這組密碼？
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              <span className="font-mono">{confirmTarget.code}</span>
              {confirmTarget.label ? `（${confirmTarget.label}）` : ""}
              將被永久刪除，無法復原。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmTarget(null)}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                取消
              </button>
              <button
                onClick={() => remove(confirmTarget)}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              >
                刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
