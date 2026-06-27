// Admin 共用：DoorCode 型別 + 格式化 helper + 小元件。
// 密碼 tab 與日曆 tab 都會用到。
import { WEEKDAY_LABELS } from "@/lib/schedule";

export type DoorCode = {
  id: number;
  code: string;
  label: string;
  recurrence: "once" | "weekly";
  weekdays: number[] | null;
  start_minute: number | null;
  end_minute: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  usage_count: number;
};

// ISO → "MM/DD HH:MM"（瀏覽器本地時區）
export function fmt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes()
  )}`;
}

// 分鐘數（本地午夜起算）→ "HH:MM"
export function minToHHMM(m: number): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(m / 60))}:${p(m % 60)}`;
}

// "HH:MM" → 分鐘數
export function hhmmToMin(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

// 週期密碼摘要：每週二、四 19:15–22:30
export function weeklySummary(c: DoorCode): string {
  const days = (c.weekdays ?? [])
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join("、");
  return `每週${days} ${minToHHMM(c.start_minute ?? 0)}–${minToHHMM(
    c.end_minute ?? 0
  )}`;
}

// datetime-local 的值（本地時區）→ ISO
export function localToIso(value: string): string {
  return new Date(value).toISOString();
}

// ISO → datetime-local 的值（本地時區，"YYYY-MM-DDTHH:MM"）
export function isoToLocal(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

// 一組密碼的時段摘要（單次顯示日期區間，每週顯示固定時段）
export function windowSummary(c: DoorCode): string {
  if (c.recurrence === "weekly") return weeklySummary(c);
  return c.valid_from && c.valid_until
    ? `${fmt(c.valid_from)} – ${fmt(c.valid_until)}`
    : "";
}

// 可一鍵複製貼到群組的分享訊息
export function shareText(c: DoorCode): string {
  return [
    "🔑 鐵捲門開門密碼",
    `密碼：${c.code}`,
    `開放時段：${windowSummary(c)}`,
  ].join("\n");
}

export const inputCls =
  "w-full min-w-0 appearance-none rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2 text-base text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50";

export function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]" />
  );
}
