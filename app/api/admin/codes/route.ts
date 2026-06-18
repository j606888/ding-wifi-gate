import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { data: codes } = await supabase
    .from("door_codes")
    .select(
      "id, code, label, recurrence, weekdays, start_minute, end_minute, valid_from, valid_until, is_active, created_at"
    )
    .order("created_at", { ascending: false });

  // 統計每組密碼成功開門次數
  const { data: logs } = await supabase
    .from("access_logs")
    .select("code_id")
    .eq("source", "web")
    .eq("action", "open")
    .eq("status", "success")
    .not("code_id", "is", null);

  const usage = new Map<number, number>();
  for (const row of logs ?? []) {
    usage.set(row.code_id, (usage.get(row.code_id) ?? 0) + 1);
  }

  const result = (codes ?? []).map((c) => ({
    ...c,
    usage_count: usage.get(c.id) ?? 0,
  }));

  return NextResponse.json({ codes: result });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { code, label, recurrence } = body;

  if (!/^\d{6}$/.test(code ?? "")) {
    return NextResponse.json({ error: "密碼需為 6 位數字" }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "欄位不完整" }, { status: 400 });
  }

  let insert: Record<string, unknown>;
  if (recurrence === "weekly") {
    const { weekdays, start_minute, end_minute } = body;
    if (
      !Array.isArray(weekdays) ||
      weekdays.length === 0 ||
      !weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    ) {
      return NextResponse.json({ error: "請至少選一個星期" }, { status: 400 });
    }
    if (
      !Number.isInteger(start_minute) ||
      !Number.isInteger(end_minute) ||
      start_minute < 0 ||
      end_minute > 1439 ||
      start_minute >= end_minute
    ) {
      return NextResponse.json(
        { error: "結束時間需晚於開始時間" },
        { status: 400 }
      );
    }
    insert = {
      code,
      label,
      recurrence: "weekly",
      weekdays,
      start_minute,
      end_minute,
    };
  } else {
    const { valid_from, valid_until } = body;
    if (!valid_from || !valid_until) {
      return NextResponse.json({ error: "欄位不完整" }, { status: 400 });
    }
    if (new Date(valid_from).getTime() >= new Date(valid_until).getTime()) {
      return NextResponse.json(
        { error: "結束時間需晚於開始時間" },
        { status: 400 }
      );
    }
    insert = { code, label, recurrence: "once", valid_from, valid_until };
  }

  const { data, error } = await supabase
    .from("door_codes")
    .insert(insert)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ code: data });
}
