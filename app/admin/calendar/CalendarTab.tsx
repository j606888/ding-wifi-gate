"use client";

import { useState } from "react";
import {
  CalDate,
  getLocalParts,
  getTaipeiDateParts,
  weekdayOf,
  windowsForDate,
} from "@/lib/schedule";
import { DoorCode, minToHHMM, shareText } from "../shared";
import { DayEntry } from "./types";
import { colorFor } from "./colors";
import WeekView, { WeekDay } from "./WeekView";
import MonthView, { MonthDay } from "./MonthView";
import { isPastEntry } from "./format";
import { DatedEntry, NextSlotCard, WeekSummary } from "./WeekSummary";

function addDays(date: CalDate, n: number): CalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + n));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function addMonths(date: CalDate, n: number): CalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1 + n, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: 1 };
}

function sameDate(a: CalDate, b: CalDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

// b 減 a 差幾天
function diffDays(a: CalDate, b: CalDate): number {
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) /
      86_400_000
  );
}

// 週一為一週起點：距離週一幾天
function mondayOffset(date: CalDate): number {
  return (weekdayOf(date) + 6) % 7;
}

const navBtn =
  "flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-800";

export default function CalendarTab({
  codes,
  nowMs,
  showToast,
}: {
  codes: DoorCode[];
  nowMs: number;
  showToast: (msg: string) => void;
}) {
  const today = getTaipeiDateParts(nowMs);
  const nowMinute = getLocalParts(nowMs).minutes;
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState<CalDate>(today);
  const [showAllDay, setShowAllDay] = useState(false);
  const toggleAllDay = () => setShowAllDay((v) => !v);
  const [detail, setDetail] = useState<{
    title: string;
    entries: DayEntry[];
  } | null>(null);

  const active = codes.filter((c) => c.is_active);
  const entriesForDate = (date: CalDate): DayEntry[] =>
    active.flatMap((c) =>
      windowsForDate(c, date).map((w) => ({ code: c, ...w }))
    );

  const dateLabel = (d: CalDate) => `${d.month}/${d.day}`;

  // ---- 週檢視資料 ----
  const weekStart = addDays(anchor, -mondayOffset(anchor));
  const weekDays: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return {
      date,
      isToday: sameDate(date, today),
      dayOffset: diffDays(today, date),
      entries: entriesForDate(date),
    };
  });
  const weekEnd = weekDays[6].date;
  const byStart = (a: DayEntry, b: DayEntry) => a.startMinute - b.startMinute;
  const weekItems: DatedEntry[] = weekDays.flatMap((d) =>
    [...d.entries]
      .sort(byStart)
      .map((entry) => ({ date: d.date, dayOffset: d.dayOffset, entry }))
  );

  // ---- 下一個時段（含進行中），往後找兩週 ----
  let nextSlot: DatedEntry | null = null;
  for (let i = 0; i < 14 && !nextSlot; i++) {
    const date = addDays(today, i);
    const entry = entriesForDate(date)
      .sort(byStart)
      .find((e) => !isPastEntry(e, i, nowMinute));
    if (entry) nextSlot = { date, dayOffset: i, entry };
  }

  // ---- 月檢視資料 ----
  const firstOfMonth: CalDate = { ...anchor, day: 1 };
  const gridStart = addDays(firstOfMonth, -mondayOffset(firstOfMonth));
  const monthCells: MonthDay[] = Array.from({ length: 42 }, (_, i) => {
    const date = addDays(gridStart, i);
    return {
      date,
      isToday: sameDate(date, today),
      inMonth: date.month === anchor.month && date.year === anchor.year,
      entries: entriesForDate(date),
    };
  });

  function prev() {
    setAnchor((a) => (view === "week" ? addDays(a, -7) : addMonths(a, -1)));
  }
  function next() {
    setAnchor((a) => (view === "week" ? addDays(a, 7) : addMonths(a, 1)));
  }

  function tapEntry(e: DayEntry) {
    setDetail({ title: "", entries: [e] });
  }
  function tapDay(d: MonthDay) {
    setDetail({ title: `${d.date.month}/${d.date.day}`, entries: d.entries });
  }

  const rangeLabel =
    view === "week"
      ? `${dateLabel(weekStart)} – ${dateLabel(weekEnd)}`
      : `${anchor.year}年${anchor.month}月`;

  return (
    <div className="flex flex-col gap-3">
      {/* 週/月切換 */}
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-sunken p-1 dark:bg-zinc-800">
        {(["week", "month"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-lg py-1.5 text-sm font-medium transition-colors ${
              view === v
                ? "bg-surface font-bold text-ink dark:bg-zinc-950 dark:text-zinc-50"
                : "text-subtle hover:text-ink dark:hover:text-zinc-300"
            }`}
          >
            {v === "week" ? "週" : "月"}
          </button>
        ))}
      </div>

      {/* 導覽 */}
      <div className="flex items-center justify-between">
        <button onClick={prev} className={navBtn} aria-label="上一頁">
          ‹
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {rangeLabel}
          </span>
          <button
            onClick={() => setAnchor(today)}
            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            今天
          </button>
        </div>
        <button onClick={next} className={navBtn} aria-label="下一頁">
          ›
        </button>
      </div>

      {view === "week" ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-5">
          <div className="min-w-0 lg:flex-1">
            <WeekView
              days={weekDays}
              nowMinute={nowMinute}
              showAllDay={showAllDay}
              onToggleAllDay={toggleAllDay}
              onTapEntry={tapEntry}
            />
          </div>
          <aside className="flex flex-col gap-4 lg:w-80 lg:shrink-0">
            <NextSlotCard next={nextSlot} nowMinute={nowMinute} onTap={tapEntry} />
            <div className="hidden flex-col gap-4 lg:flex">
              <WeekSummary
                items={weekItems}
                nowMinute={nowMinute}
                showAllDay={showAllDay}
                onToggleAllDay={toggleAllDay}
                onTap={tapEntry}
              />
            </div>
          </aside>
        </div>
      ) : (
        <MonthView cells={monthCells} onTapDay={tapDay} />
      )}

      {active.length === 0 && (
        <p className="text-center text-sm text-zinc-400">
          目前沒有啟用中的密碼
        </p>
      )}

      {/* 詳情 */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => setDetail(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            {detail.title && (
              <h3 className="mb-3 font-medium text-zinc-900 dark:text-zinc-50">
                {detail.title}
              </h3>
            )}
            {detail.entries.length === 0 ? (
              <p className="text-sm text-zinc-500">這天沒有開放時段</p>
            ) : (
              <div className="flex flex-col gap-2">
                {detail.entries.map((e, i) => {
                  const color = colorFor(e.code.id);
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${color.dot}`}
                          />
                          <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-50">
                            {e.code.code}
                          </span>
                          <span className="truncate text-sm text-zinc-500">
                            {e.code.label}
                          </span>
                        </div>
                        <div className="mt-0.5 text-sm text-zinc-500">
                          {minToHHMM(e.startMinute)}–{minToHHMM(e.endMinute)}
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              shareText(e.code)
                            );
                            showToast("已複製分享訊息");
                          } catch {
                            showToast("複製失敗，請手動複製");
                          }
                        }}
                        className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        分享
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => setDetail(null)}
              className="mt-4 w-full rounded-xl border border-zinc-300 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
