// LINE 成員頁的型別與純函式（client 用）。
import { fmt } from "@/lib/code-format";

export type Member = {
  line_user_id: string;
  display_name: string;
  is_active: boolean;
  is_admin: boolean;
  requested_at: string | null;
  requested_via: "apply" | "open" | "close" | "stop" | null;
  dismissed_at: string | null;
  activated_via: "manual" | "code" | null;
  activated_at: string | null;
  created_at: string;
  last_used_at: string | null;
  activation_code: string | null;
};

export type ActivationCode = {
  id: number;
  code: string;
  label: string;
  max_uses: number | null;
  used_count: number;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export type CodeState = "active" | "used_up" | "expired" | "revoked";

/** 申請過、還沒開通、申請之後沒被忽略 → 等待開通 */
export function isPending(m: Member): boolean {
  return (
    !m.is_active &&
    m.requested_at != null &&
    (m.dismissed_at == null || Date.parse(m.dismissed_at) < Date.parse(m.requested_at))
  );
}

export function codeState(c: ActivationCode, nowMs: number): CodeState {
  if (c.revoked_at) return "revoked";
  if (c.max_uses != null && c.used_count >= c.max_uses) return "used_up";
  if (Date.parse(c.expires_at) <= nowMs) return "expired";
  return "active";
}

export const CODE_STATE_LABEL: Record<CodeState, string> = {
  active: "有效",
  used_up: "已用完",
  expired: "已過期",
  revoked: "已作廢",
};

export const splitCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

function remaining(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `剩 ${min} 分鐘`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `剩 ${hr} 小時`;
  return `剩 ${Math.round(hr / 24)} 天`;
}

/** 「Bachata 同學 · 已用 2／5 次 · 剩 23 小時」 */
export function codeMeta(c: ActivationCode, nowMs: number): string {
  const uses =
    c.max_uses == null ? `已用 ${c.used_count} 次（不限）` : `已用 ${c.used_count}／${c.max_uses} 次`;
  const state = codeState(c, nowMs);
  const tail = state === "active" ? remaining(Date.parse(c.expires_at) - nowMs) : CODE_STATE_LABEL[state];
  return [c.label, uses, tail].filter(Boolean).join(" · ");
}

/** 分享出去的訊息：加好友連結＋怎麼輸入＋期限與人數 */
export function activationShareText(c: ActivationCode, addFriendUrl: string): string {
  const uses = c.max_uses == null ? "人數不限" : `限 ${c.max_uses} 人使用`;
  return [
    addFriendUrl ? `加「丁宅鐵捲門」LINE 好友：${addFriendUrl}` : "加「丁宅鐵捲門」LINE 好友",
    `加好友後按選單的「輸入啟動碼」，輸入 ${c.code} 就能用 LINE 開門。`,
    `（${fmt(c.expires_at)} 前有效，${uses}）`,
  ].join("\n");
}

const REQUEST_LABEL: Record<string, string> = {
  apply: "按了「申請使用」",
  open: "在 LINE 按了開門",
  close: "在 LINE 按了關門",
  stop: "在 LINE 按了停止",
};

export function requestMeta(m: Member, timeText: string): string {
  return `${timeText}${REQUEST_LABEL[m.requested_via ?? "apply"]}`;
}

/** 名單第二行：怎麼加入的（手機版；電腦版拆成欄位） */
export function joinedVia(m: Member): string {
  if (m.is_admin) return "管理員";
  if (m.activated_via === "code") return m.activation_code ? `啟動碼 ${splitCode(m.activation_code)}` : "啟動碼";
  if (m.activated_via === "manual") return "手動開通";
  return m.is_active ? "手動開通" : "還沒開通";
}

const AVATAR_BG = ["bg-[#fde2cf]", "bg-[#dbe4f0]", "bg-[#e2ecd9]", "bg-[#efe0ef]", "bg-[#f1e6c8]"];

/** 依 userId 固定一個頭像底色 */
export function avatarBg(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_BG[h % AVATAR_BG.length];
}
