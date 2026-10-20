import { DayEntry } from "./types";

/** 時段長度：「3 小時」「4 小時 15 分」「45 分」 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} 分`;
  return m === 0 ? `${h} 小時` : `${h} 小時 ${m} 分`;
}

/** 時段是否已結束。dayOffset：該日距今天幾天（負數為過去）。 */
export function isPastEntry(
  e: DayEntry,
  dayOffset: number,
  nowMinute: number
): boolean {
  return dayOffset < 0 || (dayOffset === 0 && e.endMinute <= nowMinute);
}

/** 相對狀態：已結束 / 進行中 / 今天 / 明天 / N 天後 */
export function relativeLabel(
  e: DayEntry,
  dayOffset: number,
  nowMinute: number
): string {
  if (isPastEntry(e, dayOffset, nowMinute)) return "已結束";
  if (dayOffset === 0)
    return e.startMinute <= nowMinute ? "進行中" : "今天";
  if (dayOffset === 1) return "明天";
  return `${dayOffset} 天後`;
}
