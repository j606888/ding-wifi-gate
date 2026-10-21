import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { getDefaultGate } from "@/lib/gates";

// 後台 LINE 成員頁：所有加過好友的人 + 上次成功操作時間 + 最近的啟動碼
export async function GET(req: NextRequest) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  // users 表（LINE 成員）目前只對應預設 gate
  const gate = await getDefaultGate();

  const [{ data: users, error }, { data: logs }, { data: codes }] = await Promise.all([
    supabase
      .from("users")
      .select(
        "line_user_id, display_name, is_active, is_admin, requested_at, requested_via, dismissed_at, activated_via, activation_code_id, activated_at, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("access_logs")
      .select("line_user_id, created_at")
      .eq("gate_id", gate.id)
      .eq("status", "success")
      .not("line_user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("activation_codes")
      .select("*")
      .eq("gate_id", gate.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // logs 已新到舊，第一筆就是最後一次
  const lastUsed = new Map<string, string>();
  for (const row of logs ?? []) {
    if (!lastUsed.has(row.line_user_id)) lastUsed.set(row.line_user_id, row.created_at);
  }
  const codeById = new Map((codes ?? []).map((c) => [c.id, c.code]));

  return NextResponse.json({
    members: (users ?? []).map((u) => ({
      ...u,
      last_used_at: lastUsed.get(u.line_user_id) ?? null,
      activation_code: u.activation_code_id ? (codeById.get(u.activation_code_id) ?? null) : null,
    })),
    codes: codes ?? [],
    addFriendUrl: process.env.LINE_ADD_FRIEND_URL ?? "",
  });
}
