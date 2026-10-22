// App 帳號的共用邏輯：iOS App API 的身分驗證、刪除帳號
import { appleEnabled, revokeApple } from "@/lib/apple";
import { pool } from "@/lib/db";
import { auth } from "@/lib/user-auth";

export type AppUser = { id: string; name: string; email: string };

/**
 * iOS App API（app/api/app/v1/*）用：App 帶 Authorization: Bearer <session token>，
 * bearer plugin 會把它當成 session cookie 處理。沒登入回 401，App 收到就登出。
 */
export async function requireAppUser(req: Request): Promise<AppUser | Response> {
  const result = await auth.api.getSession({ headers: req.headers });
  if (!result) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id, name, email } = result.user;
  return { id, name, email };
}

/** 這個帳號用哪些方式登入（'credential' = Email／密碼、'apple'）。 */
export async function loginProviders(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ providerId: string }>(
    `select "providerId" from auth_accounts where "userId" = $1 order by "createdAt"`,
    [userId]
  );
  return rows.map((r) => r.providerId);
}

/**
 * 刪除帳號（App Store 規定 App 內要能刪）。用 Apple 登入過的要撤銷授權：
 * App 會重新跟 Apple 拿一次 authorization code 帶過來（App 用 idToken 登入，伺服器沒有 refresh token）；
 * 網頁登入的用 auth_accounts 存的 refresh token。session、登入方式都是 on delete cascade
 */
export async function deleteAccount(userId: string, appleAuthorizationCode?: string): Promise<void> {
  if (appleEnabled()) {
    const { rows } = await pool.query<{ refreshToken: string | null }>(
      `select "refreshToken" from auth_accounts where "userId" = $1 and "providerId" = 'apple'`,
      [userId]
    );
    const apple = rows[0];
    const bundleId = process.env.APPLE_APP_BUNDLE_IDENTIFIER;
    if (apple && appleAuthorizationCode && bundleId) {
      await revokeApple({ clientId: bundleId, authorizationCode: appleAuthorizationCode });
    } else if (apple?.refreshToken) {
      await revokeApple({ clientId: process.env.APPLE_CLIENT_ID!, refreshToken: apple.refreshToken });
    }
  }
  await pool.query(`delete from auth_users where id = $1`, [userId]);
}
