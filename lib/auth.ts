import * as crypto from "crypto";
import type { NextRequest } from "next/server";

const SECRET = process.env.APP_SECRET!;

export const ADMIN_COOKIE = "admin_session";

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(data: string): string {
  return base64url(crypto.createHmac("sha256", SECRET).update(data).digest());
}

/**
 * 簽一個 HMAC token：base64url(payload).signature。
 * payload 內含 exp（毫秒 epoch），verifyToken 會檢查過期。
 */
export function signToken(
  payload: Record<string, unknown>,
  ttlMs: number,
  nowMs: number = Date.now()
): string {
  const body = { ...payload, exp: nowMs + ttlMs };
  const encoded = base64url(JSON.stringify(body));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyToken(
  token: string | undefined | null,
  nowMs: number = Date.now()
): Record<string, unknown> | null {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  const expected = sign(encoded);
  // 等長才做 timingSafeEqual，否則直接判失敗
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64").toString());
    if (typeof payload.exp !== "number" || payload.exp < nowMs) return null;
    return payload;
  } catch {
    return null;
  }
}

/** 從 API route 的 request 檢查管理員 cookie 是否有效。 */
export function requireAdmin(req: NextRequest, nowMs: number = Date.now()): boolean {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const payload = verifyToken(token, nowMs);
  return payload?.role === "admin";
}

/** 來源 IP（Vercel 會帶 x-forwarded-for）。 */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * 手錶捷徑的 Bearer token。SHORTCUT_TOKENS 格式：`名字:token,名字:token`。
 * 對上就回名字（寫進紀錄），對不上回 null。
 * 兩邊先做 SHA-256 再 timingSafeEqual，且每組都比完，不從回應時間洩漏資訊。
 */
export function matchShortcutToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const given = crypto.createHash("sha256").update(m[1]).digest();

  let matched: string | null = null;
  for (const entry of (process.env.SHORTCUT_TOKENS ?? "").split(",")) {
    const i = entry.indexOf(":");
    if (i <= 0) continue;
    const name = entry.slice(0, i).trim();
    const token = entry.slice(i + 1).trim();
    if (!name || !token) continue;
    const expected = crypto.createHash("sha256").update(token).digest();
    if (crypto.timingSafeEqual(given, expected) && matched === null) matched = name;
  }
  return matched;
}
