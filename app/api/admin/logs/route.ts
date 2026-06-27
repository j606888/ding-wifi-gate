import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

const ACTIONS = ["open", "close", "stop"];
const STATUSES = ["success", "denied"];
const SOURCES = ["line", "web"];

export async function GET(req: NextRequest) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const status = searchParams.get("status");
  const source = searchParams.get("source");

  let q = supabase
    .from("access_logs")
    .select("id, display_name, action, status, source, code_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (action && ACTIONS.includes(action)) q = q.eq("action", action);
  if (status && STATUSES.includes(status)) q = q.eq("status", status);
  if (source && SOURCES.includes(source)) q = q.eq("source", source);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ logs: data ?? [] });
}
