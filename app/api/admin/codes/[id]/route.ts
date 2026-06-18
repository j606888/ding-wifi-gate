import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // 只允許更新這些欄位
  const allowed = [
    "code",
    "label",
    "recurrence",
    "weekdays",
    "start_minute",
    "end_minute",
    "valid_from",
    "valid_until",
    "is_active",
  ];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if ("code" in update && !/^\d{6}$/.test(String(update.code))) {
    return NextResponse.json({ error: "密碼需為 6 位數字" }, { status: 400 });
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "沒有要更新的欄位" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("door_codes")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ code: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const { id } = await params;

  const { error } = await supabase.from("door_codes").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ status: "ok" });
}
