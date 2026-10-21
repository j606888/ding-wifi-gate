import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { getDefaultGate } from "@/lib/gates";

// 作廢啟動碼（已經用它開通的人不受影響）
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const gate = await getDefaultGate();
  const { id } = await params;
  const { error } = await supabase
    .from("activation_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("gate_id", gate.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ status: "ok" });
}
