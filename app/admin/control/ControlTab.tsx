"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GarageScene, { useDoorPhase, useThief } from "@/app/components/GarageScene";
import { ArrowDownIcon, ArrowUpIcon, KeyIcon, StopIcon } from "@/app/components/icons";
import { ACTION_LABEL, formatAccessTime, stripKeyPrefix } from "@/lib/access-format";
import { codeStatus } from "@/lib/schedule";
import type { LogRow } from "../logs/LogsTab";
import { DoorCode, windowSummary } from "../shared";
import { isDead, StatusChip } from "../codes/CodeCard";

type Action = "open" | "close" | "stop";

const GATE_NAME = "丁宅鐵捲門";

export default function ControlTab({
  codes,
  codesLoading,
  nowMs: pageNowMs,
  onShowLogs,
  onShowCodes,
}: {
  codes: DoorCode[];
  codesLoading: boolean;
  nowMs: number;
  onShowLogs: () => void;
  onShowCodes: () => void;
}) {
  const router = useRouter();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  const door = useDoorPhase();
  const thief = useThief(door.phase, door.openedAt);
  const { setInstant } = door;

  const load = useCallback(
    async (syncDoor: boolean) => {
      const res = await fetch("/api/admin/logs?status=success");
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      const rows: LogRow[] = data.logs ?? [];
      setLogs(rows);
      setNowMs(Date.now());
      setLoaded(true);
      // 沒有門位置感測器：最後一個成功指令不是「關門」就當作門開著
      if (syncDoor && rows[0]) {
        setInstant(rows[0].action !== "close", Date.parse(rows[0].created_at));
      }
    },
    [router, setInstant]
  );

  useEffect(() => {
    // 進分頁時載入紀錄並推算門的狀態（取資料後才 setState）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(true);
  }, [load]);

  // 「門開著 X 分鐘了」每 30 秒更新
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function send(action: Action) {
    setError("");
    setSending(action);
    try {
      const res = await fetch("/api/admin/door", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "發送失敗");
        return;
      }
      if (action === "open") door.startOpening();
      else if (action === "close") door.startClosing();
      else door.stop();
      await load(false);
    } catch {
      setError("連線失敗，請稍後再試");
    } finally {
      setSending(null);
    }
  }

  const last = logs[0];
  const lastLine = last
    ? `${stripKeyPrefix(last.display_name)} ${ACTION_LABEL[last.action] ?? last.action} · ${formatAccessTime(last.created_at, nowMs)}`
    : "還沒有紀錄";
  const openMinutes =
    door.openedAt != null ? Math.floor((nowMs - door.openedAt) / 60_000) : 0;

  let title = "門關著";
  let subtitle = `最後指令：${lastLine}`;
  let warn = false;
  if (door.phase === "opening") {
    title = "門正在打開…";
    subtitle = lastLine;
  } else if (door.phase === "closing") {
    title = "門正在關上…";
    subtitle = lastLine;
  } else if (door.phase === "open") {
    title = openMinutes >= 1 ? `門開著 ${openMinutes} 分鐘了` : "門開著";
    subtitle = thief ? "有人在偷看，用完記得關門" : `最後指令：${lastLine}`;
    warn = thief;
  }

  // 電腦版三顆並排：門開著時「關門」變成黑底主要按鈕、「開門」退成外框（手機版維持開門在上）
  const doorUp = door.phase === "open" || door.phase === "opening";
  const liveCodes = codes.filter((c) => !isDead(c, pageNowMs)).slice(0, 4);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-6">
      <h1 className="text-xl font-bold leading-[44px] lg:hidden">{GATE_NAME}</h1>
      <div className="col-span-full mb-1 hidden lg:block">
        <h1 className="text-[32px] font-bold leading-[44px]">控制</h1>
        <p className="text-[15px] text-muted">門的狀態是用最新一筆紀錄推算的，沒有感測器</p>
      </div>

      <div className="flex flex-col gap-4 lg:gap-7 lg:rounded-3xl lg:border lg:border-line lg:bg-surface lg:p-8">
        <section className="flex flex-col items-center gap-3.5 rounded-[20px] border border-line bg-surface p-5 lg:gap-6 lg:border-0 lg:p-0">
          <div className="flex w-full justify-center lg:rounded-[18px] lg:bg-ground lg:px-6 lg:pt-7">
            <GarageScene
              phase={door.phase}
              instant={door.instant}
              thief={thief}
              className="lg:max-w-[560px]"
            />
          </div>
          <div aria-live="polite" className="flex flex-col gap-1 text-center lg:self-start lg:text-left">
            {loaded ? (
              <>
                <div className={`text-lg font-bold lg:text-[28px] ${warn ? "text-accent-hover" : ""}`}>
                  {title}
                </div>
                <div className="text-[13px] text-muted lg:text-[15px]">{subtitle}</div>
              </>
            ) : (
              <div className="h-12 w-48 animate-pulse rounded-lg bg-ground" />
            )}
          </div>
        </section>

        {error && (
          <p role="alert" className="text-center text-sm text-danger">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <button
            onClick={() => send("open")}
            disabled={sending !== null}
            className={`col-span-2 flex h-18 items-center justify-center gap-2.5 rounded-[18px] bg-accent text-[22px] font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-45 lg:col-span-1 lg:h-16 lg:text-[19px] ${
              doorUp
                ? "lg:border-2 lg:border-ink lg:bg-surface lg:text-ink lg:hover:bg-ground"
                : ""
            }`}
          >
            <ArrowUpIcon size={24} />
            {sending === "open" ? "傳送中…" : "開門"}
          </button>
          <button
            onClick={() => send("stop")}
            disabled={sending !== null}
            className="flex h-15 items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-surface text-lg font-bold disabled:opacity-45 lg:h-16 lg:rounded-[18px] lg:text-[19px]"
          >
            <StopIcon />
            {sending === "stop" ? "傳送中…" : "停止"}
          </button>
          <button
            onClick={() => send("close")}
            disabled={sending !== null}
            className={`flex h-15 items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-surface text-lg font-bold disabled:opacity-45 lg:h-16 lg:rounded-[18px] lg:text-[19px] ${
              doorUp ? "lg:border-0 lg:bg-ink lg:text-white" : ""
            }`}
          >
            <ArrowDownIcon />
            {sending === "close" ? "傳送中…" : "關門"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:gap-6">
        <section className="mt-1 flex flex-col gap-1 lg:mt-0 lg:gap-0 lg:overflow-hidden lg:rounded-3xl lg:border lg:border-line lg:bg-surface">
          <div className="flex items-baseline justify-between lg:items-center lg:px-6 lg:pb-2 lg:pt-4">
            <h2 className="text-[15px] font-bold lg:text-[17px]">最近</h2>
            <button onClick={onShowLogs} className="py-2.5 text-sm font-medium hover:text-accent lg:text-accent-hover">
              查看全部
            </button>
          </div>
          <div className="rounded-2xl border border-line bg-surface lg:rounded-none lg:border-0 lg:border-t lg:border-line-soft">
            {!loaded ? (
              <div className="h-36 animate-pulse rounded-2xl" />
            ) : logs.length === 0 ? (
              <p className="p-4 text-center text-[15px] text-muted">還沒有紀錄</p>
            ) : (
              // 手機 3 筆、電腦 6 筆
              logs.slice(0, 6).map((log, i) => (
                <div
                  key={log.id}
                  className={`justify-between gap-2 px-4 py-3 text-[15px] lg:px-6 ${
                    i > 0 ? "border-t border-line-soft" : ""
                  } ${i >= 3 ? "hidden lg:flex" : "flex"}`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {log.code_id != null && (
                      <KeyIcon size={15} className="shrink-0 text-accent" />
                    )}
                    <span className="truncate">
                      {stripKeyPrefix(log.display_name) || "（未知）"} · {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted">
                    {formatAccessTime(log.created_at, nowMs)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* 電腦版才有：密碼一覽，不用切頁就看得到哪組現在能用 */}
        <section className="hidden overflow-hidden rounded-3xl border border-line bg-surface lg:block">
          <div className="flex items-center justify-between px-6 pb-2 pt-4">
            <h2 className="text-[17px] font-bold">訪客密碼</h2>
            <button onClick={onShowCodes} className="py-2.5 text-sm font-medium text-accent-hover">
              管理
            </button>
          </div>
          {codesLoading ? (
            <div className="h-24 animate-pulse border-t border-line-soft" />
          ) : liveCodes.length === 0 ? (
            <p className="border-t border-line-soft p-5 text-center text-[15px] text-muted">
              沒有可用的密碼
            </p>
          ) : (
            liveCodes.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-t border-line-soft px-6 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-bold">{c.label}</span>
                  <span className="truncate text-[13px] text-muted">{windowSummary(c)}</span>
                </div>
                <StatusChip status={codeStatus(c, pageNowMs)} />
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
