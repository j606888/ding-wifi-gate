// 常用密碼快捷：存在使用者自己裝置的 localStorage，讓掃 QR 開頁後可一鍵開門。
// 密碼明文只留在本機（等同「記住我」），畫面上只顯示 label。

const STORAGE_KEY = "ding-gate-shortcuts";
const MAX_SHORTCUTS = 3;

export type Shortcut = {
  code: string;
  label: string;
  lastUsed: number; // epoch ms
};

/** 讀取快捷清單；SSR 或壞資料一律回空陣列。 */
export function loadShortcuts(): Shortcut[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (s): s is Shortcut =>
          s &&
          typeof s.code === "string" &&
          typeof s.label === "string" &&
          typeof s.lastUsed === "number"
      )
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, MAX_SHORTCUTS);
  } catch {
    return [];
  }
}

function persist(list: Shortcut[]): Shortcut[] {
  const trimmed = list
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, MAX_SHORTCUTS);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // localStorage 不可用（隱私模式/一次性 webview）→ 靜默略過
    }
  }
  return trimmed;
}

/** 新增或更新一組快捷（以 code 去重），回傳更新後的清單。 */
export function saveShortcut(code: string, label: string): Shortcut[] {
  const now = Date.now();
  const others = loadShortcuts().filter((s) => s.code !== code);
  return persist([{ code, label, lastUsed: now }, ...others]);
}

/** 移除一組快捷，回傳更新後的清單。 */
export function removeShortcut(code: string): Shortcut[] {
  return persist(loadShortcuts().filter((s) => s.code !== code));
}

/** 相對時間：剛剛 / N 分鐘前 / N 小時前 / N 天前。 */
export function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "剛剛";
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  return `${day} 天前`;
}
