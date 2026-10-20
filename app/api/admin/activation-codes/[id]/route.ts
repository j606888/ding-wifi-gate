import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";

// 作廢啟動碼（已經用它開通的人不受影響）
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const { id } = await params;
  const { error } = await supabase
    .from("activation_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ status: "ok" });
}
