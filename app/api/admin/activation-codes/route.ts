import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { generateActivationCode } from "@/lib/members";

const USES = [1, 5, null];
const TTL_HOURS = [1, 24, 168];

// body：{ label?, maxUses: 1 | 5 | null, ttlHours: 1 | 24 | 168 }
export async function POST(req: NextRequest) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const maxUses = body.maxUses ?? null;
  if (!USES.includes(maxUses) || !TTL_HOURS.includes(body.ttlHours)) {
    return NextResponse.json({ error: "欄位不完整" }, { status: 400 });
  }
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 30) : "";

  const { data, error } = await supabase
    .from("activation_codes")
    .insert({
      code: await generateActivationCode(),
      label,
      max_uses: maxUses,
      expires_at: new Date(Date.now() + body.ttlHours * 60 * 60 * 1000).toISOString(),
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ code: data });
}
