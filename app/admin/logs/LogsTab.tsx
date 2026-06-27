"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ACTION_LABEL, formatAccessTime } from "@/lib/access-format";

type LogRow = {
  id: number;
  display_name: string;
  action: string;
  status: "success" | "denied";
  source: "line" | "web";
  code_id: number | null;
  created_at: string;
};

type Filters = { action: string; status: string; source: string };

const ACTION_OPTS = [
  { value: "", label: "全部" },
  { value: "open", label: "開門" },
  { value: "close", label: "關門" },
  { value: "stop", label: "停止" },
];
const STATUS_OPTS = [
  { value: "", label: "全部" },
  { value: "success", label: "成功" },
  { value: "denied", label: "被拒" },
];
const SOURCE_OPTS = [
  { value: "", label: "全部" },
  { value: "line", label: "LINE" },
  { value: "web", label: "網頁" },
];

function FilterRow({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`shrink-0 rounded-full px-3 py-1 text-sm transition-colors ${
            value === o.value
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "border border-zinc-300 text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function LogsTab() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [filters, setFilters] = useState<Filters>({
    action: "",
    status: "",
    source: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filters.action) qs.set("action", filters.action);
    if (filters.status) qs.set("status", filters.status);
    if (filters.source) qs.set("source", filters.source);
    const res = await fetch(`/api/admin/logs?${qs.toString()}`);
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    setNowMs(Date.now());
    setLogs(data.logs ?? []);
    setLoading(false);
  }, [filters, router]);

  useEffect(() => {
    // 篩選變動就重新抓（取資料後才 setState）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <FilterRow
          options={ACTION_OPTS}
          value={filters.action}
          onChange={(v) => setFilters((f) => ({ ...f, action: v }))}
        />
        <FilterRow
          options={STATUS_OPTS}
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
        />
        <FilterRow
          options={SOURCE_OPTS}
          value={filters.source}
          onChange={(v) => setFilters((f) => ({ ...f, source: v }))}
        />
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-white dark:bg-zinc-900"
            />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="text-center text-zinc-500">尚無紀錄</p>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm dark:bg-zinc-900"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                    {log.display_name || "（未知）"}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {ACTION_LABEL[log.action] ?? log.action}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  {log.status === "denied" ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600 dark:bg-red-950/40 dark:text-red-300">
                      被拒
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      成功
                    </span>
                  )}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {log.source === "web" ? "網頁" : "LINE"}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-xs text-zinc-400">
                {formatAccessTime(log.created_at, nowMs)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
