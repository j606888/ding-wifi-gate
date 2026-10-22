// Sign in with Apple 的 client secret 和撤銷授權（沿用 DanceNotes）。
// client secret 是用 Apple 給的私鑰簽的 JWT，最多 6 個月有效；這裡每次啟動時自己簽，不用每半年手動換
import { createPrivateKey, sign } from "node:crypto";

const AUDIENCE = "https://appleid.apple.com";
// Apple 允許的上限是 6 個月，留一點空間
const SECRET_TTL_SEC = 150 * 24 * 60 * 60;

export function appleEnabled(): boolean {
  return Boolean(
    process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY,
  );
}

// 網頁用 Services ID，App 用 bundle ID：兩邊的 token 要用各自的 client id 簽 secret
export function appleClientSecret(clientId: string): string {
  const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: "ES256", kid: process.env.APPLE_KEY_ID });
  const payload = base64url({ iss: process.env.APPLE_TEAM_ID, iat: now, exp: now + SECRET_TTL_SEC, aud: AUDIENCE, sub: clientId });
  // Vercel 的環境變數不能有換行，私鑰的換行存成 \n
  const key = createPrivateKey(process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n"));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${signature.toString("base64url")}`;
}

async function appleTokenRequest(path: string, body: Record<string, string>): Promise<Response> {
  return fetch(`${AUDIENCE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
}

// 撤銷授權（App Store 規定刪除帳號時要做）。失敗只記 log，不擋刪除帳號。
// App 刪除帳號時會重新跟 Apple 拿一次 authorization code 帶過來（App 登入用的是 idToken，伺服器手上沒有 refresh token）；
// 網頁登入的帳號用 Better Auth 存在 account 表的 refresh token
export async function revokeApple(input: { clientId: string } & ({ refreshToken: string } | { authorizationCode: string })) {
  const clientSecret = appleClientSecret(input.clientId);
  try {
    let refreshToken = "refreshToken" in input ? input.refreshToken : null;
    if (!refreshToken && "authorizationCode" in input) {
      const res = await appleTokenRequest("/auth/token", {
        client_id: input.clientId,
        client_secret: clientSecret,
        code: input.authorizationCode,
        grant_type: "authorization_code",
      });
      if (!res.ok) throw new Error(`換 token 失敗 ${res.status} ${await res.text()}`);
      refreshToken = ((await res.json()) as { refresh_token?: string }).refresh_token ?? null;
    }
    if (!refreshToken) throw new Error("沒有 refresh token");
    const res = await appleTokenRequest("/auth/revoke", {
      client_id: input.clientId,
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: "refresh_token",
    });
    if (!res.ok) throw new Error(`撤銷失敗 ${res.status} ${await res.text()}`);
  } catch (error) {
    console.error("[apple] 撤銷授權失敗", error);
  }
}
