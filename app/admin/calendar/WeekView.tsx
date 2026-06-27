"use client";

import { CalDate, WEEKDAY_LABELS } from "@/lib/schedule";
import { minToHHMM } from "../shared";
import { DayEntry } from "./types";
import { colorFor } from "./colors";

const HOUR_PX = 36; // 每小時高度
const PX_PER_MIN = HOUR_PX / 60;
const DAY_HEIGHT = 24 * HOUR_PX;

export type WeekDay = {
  date: CalDate;
  isToday: boolean;
  entries: DayEntry[];
};

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
  onTapEntry,
}: {
  days: WeekDay[];
  onTapEntry: (e: DayEntry) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
      {/* 表頭：星期 + 日期 */}
      <div className="flex border-b border-zinc-100 dark:border-zinc-800">
        <div className="w-9 shrink-0" />
        {days.map((d) => (
          <div
            key={d.date.day}
            className={`flex-1 py-2 text-center ${
              d.isToday ? "bg-zinc-50 dark:bg-zinc-800/50" : ""
            }`}
          >
            <div className="text-xs text-zinc-400">
              {WEEKDAY_LABELS[new Date(
                Date.UTC(d.date.year, d.date.month - 1, d.date.day)
              ).getUTCDay()]}
            </div>
            <div
              className={`text-sm ${
                d.isToday
                  ? "font-semibold text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {d.date.day}
            </div>
          </div>
        ))}
      </div>

      {/* 時間網格 */}
      <div className="flex" style={{ height: DAY_HEIGHT }}>
        {/* 左側時間軸 */}
        <div className="relative w-9 shrink-0">
          {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
            <div
              key={h}
              className="absolute right-1 -translate-y-1/2 text-[10px] text-zinc-400"
              style={{ top: h * HOUR_PX }}
            >
              {h === 24 ? "" : String(h).padStart(2, "0")}
            </div>
          ))}
        </div>

        {/* 7 欄 */}
        {days.map((d) => {
          const { placed, laneCount } = assignLanes(d.entries);
          return (
            <div
              key={d.date.day}
              className={`relative flex-1 border-l border-zinc-100 dark:border-zinc-800 ${
                d.isToday ? "bg-zinc-50/60 dark:bg-zinc-800/30" : ""
              }`}
            >
              {/* 每 3 小時格線 */}
              {Array.from({ length: 8 }, (_, i) => (i + 1) * 3).map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-zinc-100 dark:border-zinc-800/70"
                  style={{ top: h * HOUR_PX }}
                />
              ))}

              {placed.map(({ e, lane }, i) => {
                const top = e.startMinute * PX_PER_MIN;
                const height = Math.max(
                  16,
                  (e.endMinute - e.startMinute) * PX_PER_MIN
                );
                const color = colorFor(e.code.id);
                return (
                  <button
                    key={i}
                    onClick={() => onTapEntry(e)}
                    className={`absolute overflow-hidden rounded-md px-1 py-0.5 text-left text-[10px] leading-tight ${color.block}`}
                    style={{
                      top,
                      height,
                      left: `${(lane / laneCount) * 100}%`,
                      width: `${(1 / laneCount) * 100}%`,
                    }}
                  >
                    <span className="block truncate font-medium">
                      {e.code.label || e.code.code}
                    </span>
                    {height >= 28 && (
                      <span className="block truncate opacity-90">
                        {minToHHMM(e.startMinute)}
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
