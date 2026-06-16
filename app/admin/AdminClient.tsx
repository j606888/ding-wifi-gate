"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DoorCode = {
  id: number;
  code: string;
  label: string;
  valid_from: string;
  valid_until: string;
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

// datetime-local 的值（本地時區）→ ISO
function localToIso(value: string): string {
  return new Date(value).toISOString();
}

export default function AdminClient() {
  const router = useRouter();
  const [codes, setCodes] = useState<DoorCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nowMs] = useState(() => Date.now());

  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [saving, setSaving] = useState(false);

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

  async function handleCreate() {
    setError("");
    if (!/^\d{6}$/.test(code)) {
      setError("密碼需為 6 位數字");
      return;
    }
    if (!label || !validFrom || !validUntil) {
      setError("請填寫所有欄位");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          label,
          valid_from: localToIso(validFrom),
          valid_until: localToIso(validUntil),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "建立失敗");
        return;
      }
      setCode("");
      setLabel("");
      setValidFrom("");
      setValidUntil("");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c: DoorCode) {
    await fetch(`/api/admin/codes/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !c.is_active }),
    });
    await load();
  }

  async function remove(c: DoorCode) {
    await fetch(`/api/admin/codes/${c.id}`, { method: "DELETE" });
    await load();
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  const inputCls =
    "w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50";

  return (
    <div className="min-h-full bg-zinc-100 px-4 py-8 dark:bg-zinc-950">
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
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6 位數密碼"
                className={inputCls}
              />
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="標籤（例如 媽媽）"
                className={inputCls}
              />
            </div>
            <label className="text-sm text-zinc-500">開始時間</label>
            <input
              type="datetime-local"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className={inputCls}
            />
            <label className="text-sm text-zinc-500">結束時間</label>
            <input
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className={inputCls}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={saving}
              className="rounded-xl bg-zinc-900 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving ? "建立中…" : "建立"}
            </button>
          </div>
        </div>

        {/* 密碼清單 */}
        {loading ? (
          <p className="text-center text-zinc-500">載入中…</p>
        ) : codes.length === 0 ? (
          <p className="text-center text-zinc-500">尚無密碼</p>
        ) : (
          <div className="flex flex-col gap-3">
            {codes.map((c) => {
              const expired = new Date(c.valid_until).getTime() < nowMs;
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
                        {fmt(c.valid_from)} – {fmt(c.valid_until)}
                      </div>
                      <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                        已開門 {c.usage_count} 次
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 text-sm">
                      <button
                        onClick={() => toggleActive(c)}
                        className="rounded-lg border border-zinc-300 px-3 py-1 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {c.is_active ? "停用" : "啟用"}
                      </button>
                      <button
                        onClick={() => remove(c)}
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
    </div>
  );
}
