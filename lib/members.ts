// LINE 成員：開通 / 停用 / 申請 / 啟動碼兌換。webhook 和後台 API 共用。
import * as crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { setBoundRichMenu } from "@/lib/line";

export type ActivationCodeRow = {
  id: number;
  code: string;
  label: string;
  max_uses: number | null; // null = 不限
  used_count: number;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

/** 啟動碼現在還能不能兌換：沒作廢、沒過期、還有次數。 */
export function isRedeemable(c: ActivationCodeRow, nowMs: number): boolean {
  return (
    !c.revoked_at &&
    Date.parse(c.expires_at) > nowMs &&
    (c.max_uses == null || c.used_count < c.max_uses)
  );
}

export async function activateMember(
  lineUserId: string,
  via: "manual" | "code",
  codeId: number | null = null
): Promise<void> {
  await supabase
    .from("users")
    .update({
      is_active: true,
      activated_via: via,
      activation_code_id: codeId,
      activated_at: new Date().toISOString(),
      requested_at: null,
      requested_via: null,
    })
    .eq("line_user_id", lineUserId);
  await setBoundRichMenu(lineUserId, true).catch(() => {});
}

export async function deactivateMember(lineUserId: string): Promise<void> {
  await supabase.from("users").update({ is_active: false }).eq("line_user_id", lineUserId);
  await setBoundRichMenu(lineUserId, false).catch(() => {});
}

/**
 * 記下「想要使用」（按了申請使用，或沒權限時按開門），出現在後台的等待開通。
 * 回傳 true 代表這是新的申請（或距離上次超過 10 分鐘），呼叫端才發 Bark，避免連按洗版。
 */
export async function markRequested(
  lineUserId: string,
  via: "apply" | "open" | "close" | "stop",
  previousRequestedAt: string | null
): Promise<boolean> {
  const now = Date.now();
  const fresh =
    !previousRequestedAt || now - Date.parse(previousRequestedAt) > 10 * 60 * 1000;
  await supabase
    .from("users")
    .update({
      requested_at: new Date(now).toISOString(),
      requested_via: via,
      dismissed_at: null,
    })
    .eq("line_user_id", lineUserId);
  return fresh;
}

const REDEEM_WINDOW_MS = 10 * 60 * 1000;
const REDEEM_MAX_FAILS = 5;

/** 同一個 LINE 帳號 10 分鐘內輸錯啟動碼 5 次就先擋（沿用 door_attempts 表，ip 欄放 line:<userId>）。 */
export async function redeemBlocked(lineUserId: string): Promise<boolean> {
  const { count } = await supabase
    .from("door_attempts")
    .select("*", { count: "exact", head: true })
    .eq("ip", `line:${lineUserId}`)
    .gte("created_at", new Date(Date.now() - REDEEM_WINDOW_MS).toISOString());
  return (count ?? 0) >= REDEEM_MAX_FAILS;
}

/**
 * 兌換啟動碼：找到可用的就把使用次數 +1 並回傳；找不到（或剛好被別人用完）回 null 並記一次失敗。
 * 次數用「used_count 沒被改過才更新」的方式避免兩人同時兌換最後一次。
 */
export async function redeemActivationCode(
  lineUserId: string,
  code: string
): Promise<ActivationCodeRow | null> {
  const now = Date.now();
  const { data: rows } = await supabase
    .from("activation_codes")
    .select("*")
    .eq("code", code)
    .is("revoked_at", null)
    .gt("expires_at", new Date(now).toISOString())
    .order("created_at", { ascending: false });

  for (const row of (rows ?? []) as ActivationCodeRow[]) {
    if (!isRedeemable(row, now)) continue;
    const { data: updated } = await supabase
      .from("activation_codes")
      .update({ used_count: row.used_count + 1 })
      .eq("id", row.id)
      .eq("used_count", row.used_count)
      .select("id");
    if (updated && updated.length > 0) return { ...row, used_count: row.used_count + 1 };
  }

  await supabase.from("door_attempts").insert({ ip: `line:${lineUserId}` });
  return null;
}

/** 產生一組目前沒有在用的 6 位數啟動碼。 */
export async function generateActivationCode(): Promise<string> {
  const { data } = await supabase
    .from("activation_codes")
    .select("code")
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString());
  const taken = new Set((data ?? []).map((r) => r.code));
  for (;;) {
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    if (!taken.has(code)) return code;
  }
}
