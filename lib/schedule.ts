// 密碼時段判斷：集中「一組密碼現在是否有效」的邏輯。
// Vercel 跑 UTC，weekly 必須用台灣本地時間判斷星期/時刻。台灣無 DST。

export const TIMEZONE = "Asia/Taipei";
export const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export type CodeRow = {
  recurrence: "once" | "weekly";
  weekdays: number[] | null;
  start_minute: number | null;
  end_minute: number | null;
  valid_from: string | null;
  valid_until: string | null;
};

const SHORT_WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const localFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 取台灣本地的星期（0=日..6=六）與當日分鐘數（0-1439）。 */
export function getLocalParts(nowMs: number): {
  weekday: number;
  minutes: number;
} {
  const parts = localFmt.formatToParts(new Date(nowMs));
  let weekday = 0;
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === "weekday") weekday = SHORT_WEEKDAY[p.value] ?? 0;
    else if (p.type === "hour") hour = parseInt(p.value, 10) % 24; // 24:00 → 0
    else if (p.type === "minute") minute = parseInt(p.value, 10);
  }
  return { weekday, minutes: hour * 60 + minute };
}

/**
 * 判斷一組密碼現在是否有效，並回傳這次時段的結束 epoch（給關門 token TTL 用）。
 * windowEndMs 在無效時為 null。
 */
export function evaluateCode(
  code: CodeRow,
  nowMs: number
): { valid: boolean; windowEndMs: number | null } {
  if (code.recurrence === "weekly") {
    const { weekday, minutes } = getLocalParts(nowMs);
    const weekdays = code.weekdays ?? [];
    const start = code.start_minute ?? 0;
    const end = code.end_minute ?? 0;
    const valid =
      weekdays.includes(weekday) && minutes >= start && minutes < end;
    if (!valid) return { valid: false, windowEndMs: null };
    // 同一本地日內，結束時間 = 現在 + 剩餘分鐘（免處理時區位移）
    return { valid: true, windowEndMs: nowMs + (end - minutes) * 60_000 };
  }

  // once
  if (!code.valid_from || !code.valid_until) {
    return { valid: false, windowEndMs: null };
  }
  const from = Date.parse(code.valid_from);
  const until = Date.parse(code.valid_until);
  const valid = from <= nowMs && nowMs <= until;
  return { valid, windowEndMs: valid ? until : null };
}
