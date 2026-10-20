"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ACTION_LABEL, splitAccessName, stripKeyPrefix } from "@/lib/access-format";
import { getTaipeiDateParts, WEEKDAY_LABELS, weekdayOf } from "@/lib/schedule";
import { KeyIcon } from "@/app/components/icons";

export type LogRow = {
  id: number;
  display_name: string;
  action: string;
  status: "success" | "denied";
  source: "line" | "web";
  code_id: number | null;
  created_at: string;
};

type Filter = "all" | "line" | "web" | "denied";

const FILTERS: { key: Filter; label: string; query: string }[] = [
  { key: "all", label: "全部", query: "" },
  { key: "line", label: "LINE", query: "source=line" },
  { key: "web", label: "網頁", query: "source=web" },
  { key: "denied", label: "被拒絕", query: "status=denied" },
];

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

// 台灣時間的日期 key（YYYY-MM-DD）與 HH:MM
function taipeiDayKey(ms: number): string {
  const d = getTaipeiDateParts(ms);
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}
function taipeiHHMM(ms: number): string {
  const d = new Date(ms + TAIPEI_OFFSET_MS);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function dayHeading(ms: number, nowMs: number): string {
  const key = taipeiDayKey(ms);
  if (key === taipeiDayKey(nowMs)) return "今天";
  if (key === taipeiDayKey(nowMs - DAY_MS)) return "昨天";
  const d = getTaipeiDateParts(ms);
  return `${d.month}/${d.day}（${WEEKDAY_LABELS[weekdayOf(d)]}）`;
}

function sourceBadge(log: LogRow): string {
  if (log.source === "line") return "LINE";
  return log.code_id != null ? "密碼" : "後台";
}

export default function LogsTab() {
  const router = useRouter();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const query = FILTERS.find((f) => f.key === filter)?.query ?? "";
    const res = await fetch(`/api/admin/logs?${query}`);
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    setNowMs(Date.now());
    setLogs(data.logs ?? []);
    setLoading(false);
  }, [filter, router]);

  useEffect(() => {
    // 篩選變動就重新抓（取資料後才 setState）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // 依台灣日期分組（API 已照時間新到舊排好）
  const groups: { heading: string; rows: LogRow[] }[] = [];
  for (const log of logs) {
    const ms = Date.parse(log.created_at);
    const heading = dayHeading(ms, nowMs);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup?.heading === heading) lastGroup.rows.push(log);
    else groups.push({ heading, rows: [log] });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="篩選">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`h-9 rounded-full px-3.5 text-sm transition-colors ${
              filter === f.key
                ? "bg-ink font-bold text-white lg:h-11 lg:px-5 lg:text-[15px]"
                : "border border-line-strong bg-surface text-ink hover:bg-ground lg:h-11 lg:px-5 lg:text-[15px]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-2 flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p className="py-8 text-center text-muted">沒有紀錄</p>
      ) : (
        <>
          {/* 電腦版：表格，「誰」和「用哪組密碼」分開兩欄 */}
          <div className="mt-2 hidden overflow-x-auto rounded-[20px] border border-line bg-surface lg:block">
            <table className="w-full min-w-[640px] border-collapse text-[15px]">
              <thead>
                <tr className="text-left text-[13px] text-muted">
                  <th scope="col" className="w-24 px-6 py-3.5 font-medium">時間</th>
                  <th scope="col" className="px-3 py-3.5 font-medium">誰</th>
                  <th scope="col" className="px-3 py-3.5 font-medium">用哪組密碼</th>
                  <th scope="col" className="w-28 px-3 py-3.5 font-medium">動作</th>
                  <th scope="col" className="w-24 px-6 py-3.5 font-medium">來源</th>
                </tr>
              </thead>
              {groups.map((g) => (
                <tbody key={g.heading}>
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={5}
                      className="border-t border-line bg-ground px-6 pb-2 pt-4 text-left text-sm font-bold text-subtle"
                    >
                      {g.heading}
                    </th>
                  </tr>
                  {g.rows.map((log) => {
                    const denied = log.status === "denied";
                    const action = ACTION_LABEL[log.action] ?? log.action;
                    const { who, via } = splitAccessName(log.display_name, log.code_id != null);
                    return (
                      <tr key={log.id} className="border-t border-line-soft">
                        <td className="px-6 py-3 font-mono text-sm text-muted">
                          {taipeiHHMM(Date.parse(log.created_at))}
                        </td>
                        <td className={`px-3 py-3 font-bold ${denied ? "text-danger" : ""}`}>
                          {who || <span className="font-normal text-muted">沒留名字</span>}
                        </td>
                        <td className="px-3 py-3 text-muted">{via || "—"}</td>
                        <td className={`px-3 py-3 ${denied ? "text-danger" : ""}`}>
                          {denied ? `${action}被拒絕` : action}
                        </td>
                        <td className="px-6 py-3">
                          <span className="whitespace-nowrap rounded-md border border-line-strong px-2 py-0.5 text-xs text-subtle">
                            {sourceBadge(log)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>

          {groups.map((g) => (
            <section key={g.heading} className="mt-1 flex flex-col gap-2.5 lg:hidden">
              <h2 className="text-sm font-bold text-muted">{g.heading}</h2>
              <div className="rounded-2xl border border-line bg-surface">
                {g.rows.map((log, i) => {
                  const denied = log.status === "denied";
                  const action = ACTION_LABEL[log.action] ?? log.action;
                  return (
                    <div
                      key={log.id}
                      className={`grid grid-cols-[52px_1fr_auto] items-center gap-2.5 px-4 py-3 ${
                        i > 0 ? "border-t border-line-soft" : ""
                      }`}
                    >
                      <span className="font-mono text-sm text-muted">
                        {taipeiHHMM(Date.parse(log.created_at))}
                      </span>
                      <span
                        className={`flex min-w-0 items-center gap-1.5 ${
                          denied ? "text-danger" : ""
                        }`}
                      >
                        {log.code_id != null && (
                          <KeyIcon size={15} className="shrink-0 text-accent" />
                        )}
                        <span className="truncate">
                          <strong>{stripKeyPrefix(log.display_name) || "（未知）"}</strong>{" "}
                          {denied ? `${action}被拒絕` : action}
                        </span>
                      </span>
                      <span className="rounded-md border border-line px-1.5 py-0.5 text-xs text-muted">
                        {sourceBadge(log)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
