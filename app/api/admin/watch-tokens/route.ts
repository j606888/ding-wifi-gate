import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { getDefaultGate } from "@/lib/gates";
import { newWatchSecret, WATCH_TOKEN_COLUMNS, watchTemplateUrls } from "@/lib/watch-tokens";

// GET：有效的手錶 token（不含 hash）＋捷徑範本連結
export async function GET(req: NextRequest) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const gate = await getDefaultGate();
  const { data, error } = await supabase
    .from("watch_tokens")
    .select(WATCH_TOKEN_COLUMNS)
    .eq("gate_id", gate.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tokens: data ?? [], templates: watchTemplateUrls() });
}

// POST { name, canClose }：新增，明文 secret 只在這次回傳
export async function POST(req: NextRequest) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const gate = await getDefaultGate();
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 20) : "";
  if (!name) {
    return NextResponse.json({ error: "請填名字" }, { status: 400 });
  }
  const { secret, token_hash, token_hint } = newWatchSecret();
  const { data, error } = await supabase
    .from("watch_tokens")
    .insert({ gate_id: gate.id, name, token_hash, token_hint, can_close: body.canClose !== false })
    .select(WATCH_TOKEN_COLUMNS)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ token: data, secret });
}
