"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorCode } from "./shared";
import CodesTab from "./codes/CodesTab";
import CalendarTab from "./calendar/CalendarTab";
import LogsTab from "./logs/LogsTab";

type Tab = "codes" | "calendar" | "logs";

const TABS: { key: Tab; label: string }[] = [
  { key: "codes", label: "密碼" },
  { key: "calendar", label: "日曆" },
  { key: "logs", label: "紀錄" },
];

export default function AdminClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("codes");
  const [codes, setCodes] = useState<DoorCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs] = useState(() => Date.now());
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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? "" : t)), 2000);
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-full bg-zinc-100 dark:bg-zinc-950">
      {/* 通知 toast */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-900">
            {toast}
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="mb-5 flex items-center justify-between">
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

        {/* 分頁切換 */}
        <div className="sticky top-0 z-30 -mx-4 mb-6 bg-zinc-100/90 px-4 py-2 backdrop-blur dark:bg-zinc-950/90">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-800">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                  tab === t.key
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                    : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "codes" && (
          <CodesTab
            codes={codes}
            loading={loading}
            load={load}
            nowMs={nowMs}
            showToast={showToast}
          />
        )}
        {tab === "calendar" && (
          <CalendarTab codes={codes} nowMs={nowMs} showToast={showToast} />
        )}
        {tab === "logs" && <LogsTab />}
      </div>
    </div>
  );
}
