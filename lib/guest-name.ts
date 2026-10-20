// 訪客名字：共用密碼（例如舞蹈課）多人在用時，用來分辨是誰開的門。
// 名字是訪客自己填的，只存在那支手機的 localStorage，填一次之後都會帶上。
// 純函式 client-safe，server（verify / close）也用 cleanGuestName 清理輸入。

const STORAGE_KEY = "ding-gate-guest-name";
export const GUEST_NAME_MAX = 20;

/** 去掉控制字元、零寬空白與方向控制字元（保留 ZWJ 讓組合 emoji 正常）、多餘空白，限制長度；空字串代表沒填。 */
export function cleanGuestName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return Array.from(
    raw.replace(/[\p{Cc}\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu, "").replace(/\s+/g, " ").trim()
  )
    .slice(0, GUEST_NAME_MAX)
    .join("")
    .trim();
}

/** 紀錄 / 推播用的名稱：「🔑 小明（週二 Bachata 課）」，沒填名字就只有標籤。 */
export function guestDisplayName(label: string, name: string): string {
  return name ? `🔑 ${name}（${label}）` : `🔑 ${label}`;
}

export function loadGuestName(): string {
  if (typeof window === "undefined") return "";
  try {
    return cleanGuestName(window.localStorage.getItem(STORAGE_KEY) ?? "");
  } catch {
    return "";
  }
}

export function saveGuestName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // localStorage 不可用（隱私模式/一次性 webview）→ 這次照樣帶名字，只是下次要再填
  }
}
