import * as crypto from "crypto";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// Apple Watch 捷徑 token（watch_tokens 表，後台「手錶」分頁管理）。
// 資料庫只存 SHA-256；明文只在建立／刷新時回傳一次。

export type WatchToken = {
  id: number;
  name: string;
  token_hint: string;
  can_close: boolean;
  last_used_at: string | null;
  created_at: string;
};

export const WATCH_TOKEN_COLUMNS = "id, name, token_hint, can_close, last_used_at, created_at";

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

/** 產生一組新 token：明文（給使用者）＋ hash／末 4 碼（存資料庫）。 */
export function newWatchSecret(): { secret: string; token_hash: string; token_hint: string } {
  const secret = `wg_${crypto.randomBytes(32).toString("base64url")}`;
  return { secret, token_hash: hash(secret), token_hint: secret.slice(-4) };
}

/** 從 Authorization: Bearer 找出有效的 token；找不到回 null。 */
export async function findWatchToken(
  req: NextRequest,
  gateId: string
): Promise<Pick<WatchToken, "id" | "name" | "can_close"> | null> {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const { data } = await supabase
    .from("watch_tokens")
    .select("id, name, can_close")
    .eq("gate_id", gateId)
    .eq("token_hash", hash(m[1]))
    .is("revoked_at", null)
    .maybeSingle();
  return data;
}

export async function touchWatchToken(id: number): Promise<void> {
  await supabase
    .from("watch_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", id);
}

/** 捷徑範本的 iCloud 連結（選填），分享訊息會附上。 */
export function watchTemplateUrls(): { open: string; close: string } {
  return {
    open: process.env.WATCH_SHORTCUT_OPEN_URL ?? "",
    close: process.env.WATCH_SHORTCUT_CLOSE_URL ?? "",
  };
}
