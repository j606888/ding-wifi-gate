// Admin 共用：DoorCode 型別 + 格式化 helper + 小元件。
// 密碼 tab 與日曆 tab 都會用到。
import { windowSummary } from "@/lib/code-format";

// 時段摘要搬到 lib/code-format（server 也要用），這裡 re-export 給既有 import。
export { fmt, minToHHMM, weeklySummary, windowSummary } from "@/lib/code-format";

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

// "HH:MM" → 分鐘數
export function hhmmToMin(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
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

// 可一鍵複製貼到群組的分享訊息
export function shareText(c: DoorCode): string {
  return [
    "🔑 鐵捲門開門密碼",
    `密碼：${c.code}`,
    `開放時段：${windowSummary(c)}`,
  ].join("\n");
}

export const inputCls =
  "h-13 w-full min-w-0 appearance-none rounded-2xl border border-line-strong bg-surface px-4 text-[17px] text-ink outline-none focus:border-ink";

export function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]" />
  );
}
