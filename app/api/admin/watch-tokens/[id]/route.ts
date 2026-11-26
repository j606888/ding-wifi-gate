import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { getDefaultGate } from "@/lib/gates";
import { newWatchSecret, WATCH_TOKEN_COLUMNS } from "@/lib/watch-tokens";

type Ctx = { params: Promise<{ id: string }> };

// PATCH { canClose } 改關門權限；{ rotate: true } 刷新（舊 token 立刻失效，回傳新 secret）
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const gate = await getDefaultGate();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  let secret: string | undefined;
  if (body.rotate === true) {
    const s = newWatchSecret();
    secret = s.secret;
    update.token_hash = s.token_hash;
    update.token_hint = s.token_hint;
  }
  if (typeof body.canClose === "boolean") update.can_close = body.canClose;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "沒有要更新的欄位" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("watch_tokens")
    .update(update)
    .eq("id", id)
    .eq("gate_id", gate.id)
    .is("revoked_at", null)
    .select(WATCH_TOKEN_COLUMNS)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "找不到這組 token" }, { status: 404 });
  }
  return NextResponse.json({ token: data, secret });
}

// DELETE：立刻失效（只標記 revoked_at，紀錄保留）
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const gate = await getDefaultGate();
  const { id } = await params;
  const { error } = await supabase
    .from("watch_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("gate_id", gate.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ status: "ok" });
}
