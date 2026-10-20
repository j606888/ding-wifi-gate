"use client";

import { CalDate, WEEKDAY_LABELS } from "@/lib/schedule";
import { minToHHMM } from "../shared";
import { DayEntry } from "./types";
import { colorFor } from "./colors";
import { formatDuration, isPastEntry, relativeLabel } from "./format";

// 預設從中午開始畫；有更早的時段才往前延伸。
const DEFAULT_START_HOUR = 12;

// 每小時高度用 CSS 變數，手機 40px、電腦 56px，不用 JS 判斷螢幕寬度。
const HOUR_VAR = "[--hour:40px] lg:[--hour:56px]";
const at = (hours: number) => `calc(var(--hour) * ${hours})`;
const GRID_LINES =
  "repeating-linear-gradient(to bottom, var(--color-line-soft) 0 1px, transparent 1px var(--hour))";
const STRIPES =
  "repeating-linear-gradient(135deg, #f7f6f3 0 6px, #f2f0ec 6px 12px)";
const COLS =
  "grid grid-cols-[30px_repeat(7,minmax(0,1fr))] lg:grid-cols-[52px_repeat(7,minmax(0,1fr))]";

export type WeekDay = {
  date: CalDate;
  isToday: boolean;
  dayOffset: number; // 距今天幾天，負數為過去
  entries: DayEntry[];
};

/** 這週要從幾點開始畫：12 點，或最早時段所在的整點（取較早者）。 */
export function autoStartHour(days: WeekDay[]): number {
  const earliest = Math.min(
    ...days.flatMap((d) => d.entries.map((e) => e.startMinute))
  );
  return Math.min(DEFAULT_START_HOUR, Math.floor(earliest / 60));
}

// 同一欄內重疊的時段切成多 lane，避免疊在一起。
function assignLanes(entries: DayEntry[]) {
  const sorted = [...entries].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute
  );
  const laneEnds: number[] = [];
  const placed = sorted.map((e) => {
    let lane = laneEnds.findIndex((end) => end <= e.startMinute);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e.endMinute);
    } else {
      laneEnds[lane] = e.endMinute;
    }
    return { e, lane };
  });
  return { placed, laneCount: Math.max(1, laneEnds.length) };
}

export default function WeekView({
  days,
  nowMinute,
  showAllDay,
  onToggleAllDay,
  onTapEntry,
}: {
  days: WeekDay[];
  nowMinute: number;
  showAllDay: boolean;
  onToggleAllDay: () => void;
  onTapEntry: (e: DayEntry) => void;
}) {
  const autoStart = autoStartHour(days);
  const startHour = showAllDay ? 0 : autoStart;
  const hours = 24 - startHour;
  const hiddenLabel = `00:00 – ${String(autoStart).padStart(2, "0")}:00`;

  const labelHours: number[] = [];
  for (let h = startHour; h < 24; h += 2) labelHours.push(h);

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-line bg-surface dark:bg-zinc-900 ${HOUR_VAR}`}
    >
      {/* 表頭：星期 + 日期 */}
      <div className={`${COLS} border-b border-line-soft dark:border-zinc-800`}>
        <div />
        {days.map((d) => {
          const wd =
            WEEKDAY_LABELS[
              new Date(
                Date.UTC(d.date.year, d.date.month - 1, d.date.day)
              ).getUTCDay()
            ];
          return (
            <div
              key={d.date.day}
              className={`py-1.5 text-center lg:py-2.5 ${
                d.isToday ? "bg-zinc-50 dark:bg-zinc-800/50" : ""
              }`}
            >
              <div
                className={`text-[11px] lg:text-xs ${
                  d.isToday ? "font-bold text-ink" : "text-muted"
                }`}
              >
                <span className="hidden lg:inline">週</span>
                {wd}
                {d.isToday && <span className="hidden lg:inline"> · 今天</span>}
              </div>
              <div
                className={`text-sm lg:text-lg ${
                  d.isToday
                    ? "font-semibold text-zinc-900 dark:text-zinc-50"
                    : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {d.date.day}
              </div>
            </div>
          );
        })}
      </div>

      {/* 收起/展開上午 */}
      {autoStart > 0 && (
        <button
          onClick={onToggleAllDay}
          className={`flex h-8 w-full items-center justify-center gap-1.5 text-xs text-subtle lg:h-9 lg:text-[13px] ${
            showAllDay
              ? "border-b border-line-soft bg-zinc-50"
              : "border-b border-dashed border-line"
          }`}
          style={showAllDay ? undefined : { backgroundImage: STRIPES }}
        >
          {showAllDay ? (
            `收起 ${hiddenLabel}`
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
              {hiddenLabel} 沒有時段 · 展開
            </>
          )}
        </button>
      )}

      {/* 時間網格 */}
      <div className={COLS} style={{ height: at(hours) }}>
        {/* 左側時間軸，每 2 小時 */}
        <div className="relative">
          {labelHours.map((h) => (
            <div
              key={h}
              className="absolute right-1 pt-0.5 text-[11px] text-muted lg:right-2.5 lg:text-xs"
              style={{ top: at(h - startHour) }}
            >
              {String(h).padStart(2, "0")}
              <span className="hidden lg:inline">:00</span>
            </div>
          ))}
        </div>

        {/* 7 欄 */}
        {days.map((d) => {
          const { placed, laneCount } = assignLanes(d.entries);
          return (
            <div
              key={d.date.day}
              className={`relative border-l border-line-soft dark:border-zinc-800 ${
                d.isToday ? "bg-zinc-50/60 dark:bg-zinc-800/30" : ""
              }`}
              style={{ backgroundImage: GRID_LINES }}
            >
              {placed.map(({ e, lane }, i) => {
                const duration = e.endMinute - e.startMinute;
                const past = isPastEntry(e, d.dayOffset, nowMinute);
                const color = colorFor(e.code.id);
                return (
                  <button
                    key={i}
                    onClick={() => onTapEntry(e)}
                    className={`absolute flex min-h-5 flex-col gap-0.5 overflow-hidden rounded-md px-1 py-1 text-left text-[11px] leading-tight lg:gap-1 lg:rounded-[10px] lg:p-2.5 lg:text-[13px] ${color.block} ${
                      past ? "opacity-60" : ""
                    }`}
                    style={{
                      top: at(e.startMinute / 60 - startHour),
                      height: at(duration / 60),
                      left: `calc(${(lane / laneCount) * 100}% + 2px)`,
                      width: `calc(${(1 / laneCount) * 100}% - 4px)`,
                    }}
                  >
                    <span className="block truncate font-bold lg:whitespace-normal lg:text-sm">
                      {e.code.label || e.code.code}
                    </span>
                    {duration >= 40 && (
                      <span className="block truncate lg:whitespace-normal">
                        {minToHHMM(e.startMinute)}
                        <span className="hidden lg:inline">
                          {" "}
                          – {minToHHMM(e.endMinute)}
                        </span>
                      </span>
                    )}
                    {duration >= 90 && (
                      <span className="hidden text-xs lg:block">
                        {formatDuration(duration)} ·{" "}
                        {relativeLabel(e, d.dayOffset, nowMinute)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
