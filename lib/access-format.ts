// Client-safe 純函式（不依賴 Supabase / server-only env）。
// 給 client component（如後台 LogsTab）安全 import，避免把 supabase client 打進瀏覽器 bundle。

export const ACTION_LABEL: Record<string, string> = {
  open: "開門",
  close: "關門",
  stop: "停止",
};

// 開門紀錄時間：1 天內顯示相對時間，更久顯示台灣的 MM/DD HH:MM。
// nowMs 可由 client 傳入穩定值（避免每列重算）。
export function formatAccessTime(isoString: string, nowMs?: number): string {
  const now = nowMs ?? Date.now();
  const ts = new Date(isoString).getTime();
  const diffSec = Math.floor((now - ts) / 1000);

  if (diffSec < 60) return `${diffSec} 秒前`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分鐘前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小時前`;

  const taipeiDate = new Date(ts + 8 * 60 * 60 * 1000);
  const m = String(taipeiDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(taipeiDate.getUTCDate()).padStart(2, "0");
  const h = String(taipeiDate.getUTCHours()).padStart(2, "0");
  const min = String(taipeiDate.getUTCMinutes()).padStart(2, "0");
  return `${m}/${d} ${h}:${min}`;
}
