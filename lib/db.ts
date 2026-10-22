import { Pool } from "pg";

// 直接連 Postgres：Better Auth 要用（supabase-js 走 PostgREST，Better Auth 接不上）。
// DATABASE_URL 用 Supabase pooler 的 transaction mode（port 6543），serverless 每個 instance 只開少量連線
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  ssl: { rejectUnauthorized: false },
});
