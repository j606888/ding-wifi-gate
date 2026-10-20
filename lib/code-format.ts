// Client-safe 純函式：密碼時段的文字摘要。server（verify 回傳可用時段）和後台都用。
// 日期一律用台灣時間格式化，server 跑在 UTC 也會顯示一樣的字。
import { getTaipeiDateParts, WEEKDAY_LABELS, weekdayOf, type CodeRow } from "@/lib/schedule";

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

// 分鐘數（本地午夜起算）→ "HH:MM"
export function minToHHMM(m: number): string {
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

// ISO 或 epoch → 台灣時間 "MM/DD HH:MM"
export function fmt(value: string | number): string {
  const ms = typeof value === "number" ? value : Date.parse(value);
  const d = new Date(ms + TAIPEI_OFFSET_MS);
  return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}`;
}

// epoch → 台灣日期 "10/21（二）"
export function fmtDay(ms: number): string {
  const date = getTaipeiDateParts(ms);
  return `${date.month}/${date.day}（${WEEKDAY_LABELS[weekdayOf(date)]}）`;
}

// 週期密碼摘要：每週二、四 19:15–22:30
export function weeklySummary(c: CodeRow): string {
  const weekdays = c.weekdays ?? [];
  const days =
    new Set(weekdays).size === 7
      ? "每天"
      : `每週${weekdays
          .slice()
          .sort((a, b) => a - b)
          .map((d) => WEEKDAY_LABELS[d])
          .join("、")}`;
  return `${days} ${minToHHMM(c.start_minute ?? 0)}–${minToHHMM(
    c.end_minute ?? 0
  )}`;
}

// 一組密碼的時段摘要（單次顯示日期區間，每週顯示固定時段）
export function windowSummary(c: CodeRow): string {
  if (c.recurrence === "weekly") return weeklySummary(c);
  return c.valid_from && c.valid_until
    ? `${fmt(c.valid_from)} – ${fmt(c.valid_until)}`
    : "";
}
