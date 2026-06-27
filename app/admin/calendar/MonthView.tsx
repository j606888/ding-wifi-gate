"use client";

import { CalDate } from "@/lib/schedule";
import { minToHHMM } from "../shared";
import { DayEntry } from "./types";
import { colorFor } from "./colors";

const WEEK_HEADER = ["一", "二", "三", "四", "五", "六", "日"];

export type MonthDay = {
  date: CalDate;
  isToday: boolean;
  inMonth: boolean;
  entries: DayEntry[];
};

export default function MonthView({
  cells,
  onTapDay,
}: {
  cells: MonthDay[];
  onTapDay: (d: MonthDay) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-zinc-900">
      <div className="grid grid-cols-7 border-b border-zinc-100 text-center text-xs text-zinc-400 dark:border-zinc-800">
        {WEEK_HEADER.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const shown = cell.entries.slice(0, 2);
          const more = cell.entries.length - shown.length;
          return (
            <button
              key={i}
              onClick={() => onTapDay(cell)}
              className={`flex min-h-[68px] flex-col gap-0.5 border-b border-l border-zinc-100 p-1 text-left dark:border-zinc-800 ${
                i % 7 === 0 ? "border-l-0" : ""
              } ${cell.inMonth ? "" : "bg-zinc-50/50 dark:bg-zinc-950/30"}`}
            >
              <span
                className={`text-xs ${
                  cell.isToday
                    ? "flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 font-semibold text-white dark:bg-zinc-50 dark:text-zinc-900"
                    : cell.inMonth
                    ? "text-zinc-700 dark:text-zinc-300"
                    : "text-zinc-300 dark:text-zinc-600"
                }`}
              >
                {cell.date.day}
              </span>
              {shown.map((e, j) => {
                const color = colorFor(e.code.id);
                return (
                  <span
                    key={j}
                    className={`truncate rounded px-1 text-[10px] leading-tight ${color.chip}`}
                  >
                    {minToHHMM(e.startMinute)} {e.code.label || e.code.code}
                  </span>
                );
              })}
              {more > 0 && (
                <span className="px-1 text-[10px] text-zinc-400">+{more}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
