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
