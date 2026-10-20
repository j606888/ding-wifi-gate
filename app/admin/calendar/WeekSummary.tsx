"use client";

import { CalDate, WEEKDAY_LABELS, weekdayOf } from "@/lib/schedule";
import { minToHHMM } from "../shared";
import { DayEntry } from "./types";
import { colorFor } from "./colors";
import { isPastEntry, relativeLabel } from "./format";

export type DatedEntry = {
  date: CalDate;
  dayOffset: number;
  entry: DayEntry;
};

const dateText = (d: CalDate) =>
  `${d.month}/${d.day}（${WEEKDAY_LABELS[weekdayOf(d)]}）`;
const rangeText = (e: DayEntry) =>
  `${minToHHMM(e.startMinute)} – ${minToHHMM(e.endMinute)}`;

/** 下一個（或進行中的）時段卡片。手機版放週曆下方，電腦版放右側欄。 */
export function NextSlotCard({
  next,
  nowMinute,
  onTap,
}: {
  next: DatedEntry | null;
  nowMinute: number;
  onTap: (e: DayEntry) => void;
}) {
  if (!next) return null;
  const { entry: e, dayOffset } = next;
  const rel = relativeLabel(e, dayOffset, nowMinute);
  const ongoing = rel === "進行中";
  return (
    <button
      onClick={() => onTap(e)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-left text-white lg:flex-col lg:items-start lg:gap-1.5 lg:p-5"
    >
      <div className="min-w-0">
        <div className="text-xs text-zinc-300 lg:text-[13px]">
          {ongoing ? "進行中" : "下一個時段"}
        </div>
        <div className="truncate text-[15px] font-bold lg:hidden">
          {ongoing ? `到 ${minToHHMM(e.endMinute)}` : `${rel} ${minToHHMM(e.startMinute)}`}{" "}
          · {e.code.label || e.code.code}
        </div>
        <div className="hidden text-xl font-bold lg:block">
          {ongoing ? `到 ${minToHHMM(e.endMinute)}` : `${rel} ${minToHHMM(e.startMinute)}`}
        </div>
      </div>
      <div className="hidden text-[15px] lg:block">
        {e.code.label || e.code.code}
        {!ongoing && ` · 到 ${minToHHMM(e.endMinute)}`}
      </div>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
        className="shrink-0 lg:hidden"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/** 電腦版右側欄：本週時段清單 + 顯示時間切換。 */
export function WeekSummary({
  items,
  nowMinute,
  showAllDay,
  onToggleAllDay,
  onTap,
}: {
  items: DatedEntry[];
  nowMinute: number;
  showAllDay: boolean;
  onToggleAllDay: () => void;
  onTap: (e: DayEntry) => void;
}) {
  return (
    <>
      <div className="rounded-2xl border border-line bg-surface py-2">
        <div className="px-5 pb-2 pt-3 text-sm font-bold">
          本週 {items.length} 個時段
        </div>
        {items.length === 0 && (
          <p className="border-t border-line-soft px-5 py-3 text-sm text-muted">
            這週沒有開放時段
          </p>
        )}
        {items.map(({ date, dayOffset, entry: e }, i) => {
          const past = isPastEntry(e, dayOffset, nowMinute);
          const rel = relativeLabel(e, dayOffset, nowMinute);
          return (
            <button
              key={i}
              onClick={() => onTap(e)}
              className="flex w-full items-center gap-3 border-t border-line-soft px-5 py-3 text-left hover:bg-zinc-50"
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${colorFor(e.code.id).dot}`}
              />
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-sm ${
                    past ? "text-muted" : "font-medium text-ink"
                  }`}
                >
                  {e.code.label || e.code.code}
                </div>
                <div className="text-[13px] text-muted">
                  {dateText(date)} {rangeText(e)}
                </div>
              </div>
              <span
                className={`shrink-0 text-xs ${
                  rel === "進行中" || rel === "今天" || rel === "明天"
                    ? "font-bold text-ok"
                    : "text-muted"
                }`}
              >
                {rel}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface px-5 py-4">
        <div className="text-sm font-bold">顯示時間</div>
        <div className="flex rounded-[10px] bg-sunken p-[3px]">
          {[false, true].map((all) => (
            <button
              key={String(all)}
              aria-pressed={showAllDay === all}
              onClick={() => showAllDay !== all && onToggleAllDay()}
              className={`h-9 flex-1 rounded-lg text-[13px] ${
                showAllDay === all
                  ? "bg-surface font-bold text-ink"
                  : "text-subtle hover:text-ink"
              }`}
            >
              {all ? "全天" : "12:00 – 24:00"}
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-muted">
          有時段落在中午前時，會自動往前延伸到那個時段。
        </p>
      </div>
    </>
  );
}
