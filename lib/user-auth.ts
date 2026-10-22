// App 帳號（Better Auth）：Email／密碼 + Sign in with Apple。
// 跟 lib/auth.ts 不一樣：那個是後台 ADMIN_PASSWORD cookie 和關門 token 的 HMAC。
// 資料表用 auth_ 開頭（scripts/schema.sql 第 6 段），避免跟 LINE 成員的 users 表搞混
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
import { appleClientSecret, appleEnabled } from "@/lib/apple";
import { pool } from "@/lib/db";

export const MIN_PASSWORD_LENGTH = 8;

// /api/auth/* 由 Better Auth 處理：Email 註冊／登入、Apple 網頁登入的 callback、
// iOS App 用 idToken 登入（POST /api/auth/sign-in/social，回應 header 的 set-auth-token 就是 App 的 bearer token）
export const auth = betterAuth({
  database: pool,
  advanced: { database: { generateId: "uuid" } },
  user: { modelName: "auth_users" },
  verification: { modelName: "auth_verifications" },
  session: {
    modelName: "auth_sessions",
    // App 很少打開（開門就關掉），期限放長，免得常常要重新登入
    expiresIn: 60 * 60 * 24 * 90,
  },
  account: {
    modelName: "auth_accounts",
    // 用 Email 註冊過的人，用同一個 Email 的 Apple 帳號登入時併成同一個帳號。
    // 我們沒做 Email 驗證，所以合併時把原本的密碼清掉（見下面 databaseHooks），
    // 免得別人先用你的 Email 註冊、等你用 Apple 登入被合併後還能用那組密碼進來
    accountLinking: { enabled: true, trustedProviders: ["apple"], requireLocalEmailVerified: false },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
  },
  socialProviders: appleEnabled()
    ? {
        apple: {
          // 網頁用 Services ID；iOS App 的 idToken audience 是 bundle ID，兩個都要接受
          clientId: process.env.APPLE_CLIENT_ID!,
          clientSecret: appleClientSecret(process.env.APPLE_CLIENT_ID!),
          audience: [process.env.APPLE_CLIENT_ID!, process.env.APPLE_APP_BUNDLE_IDENTIFIER].filter(
            (id): id is string => Boolean(id)
          ),
          // Apple 只有第一次登入會給名字，也可以不給；沒有就用 Email 前面那段，
          // 「隱藏我的 Email」的轉寄地址那段是亂碼，就叫「住戶」
          mapProfileToUser: (profile) => {
            if (profile.name) return {};
            const local = profile.email?.endsWith("@privaterelay.appleid.com")
              ? ""
              : profile.email?.split("@")[0];
            return { name: local || "住戶" };
          },
        },
      }
    : {},
  // Apple 網頁登入完是用 form POST 導回來
  trustedOrigins: ["https://appleid.apple.com"],
  databaseHooks: {
    account: {
      create: {
        // Apple 帳號要併進 Email 還沒驗證過的帳號：Apple 證明了信箱是他的，原本的密碼不能相信，
        // 刪掉並登出所有裝置。Apple 新註冊的帳號本來就是已驗證，不會進來
        before: async (data) => {
          if (data.providerId !== "apple") return;
          const { rows } = await pool.query<{ emailVerified: boolean }>(
            `select "emailVerified" from auth_users where id = $1`,
            [data.userId]
          );
          if (!rows[0] || rows[0].emailVerified) return;
          await pool.query(
            `delete from auth_accounts where "userId" = $1 and "providerId" = 'credential'`,
            [data.userId]
          );
          await pool.query(`delete from auth_sessions where "userId" = $1`, [data.userId]);
        },
      },
    },
  },
  // bearer：iOS App 用 Authorization: Bearer 帶 session token。
  // nextCookies 讓 Server Action 裡的 auth.api.* 可以寫 cookie；要放最後一個
  plugins: [bearer(), nextCookies()],
});
