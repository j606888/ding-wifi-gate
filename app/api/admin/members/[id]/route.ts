import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/auth";
import { pushMessage } from "@/lib/line";
import { activateMember, deactivateMember } from "@/lib/members";

// body：{ is_active: boolean } 開通 / 停用，或 { dismiss: true } 從等待開通移除
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const { data: user } = await supabase
    .from("users")
    .select("line_user_id, is_active")
    .eq("line_user_id", id)
    .single();
  if (!user) {
    return NextResponse.json({ error: "找不到這個成員" }, { status: 404 });
  }

  if (body.dismiss === true) {
    await supabase
      .from("users")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("line_user_id", id);
    return NextResponse.json({ status: "ok" });
  }

  if (typeof body.is_active !== "boolean") {
    return NextResponse.json({ error: "欄位不完整" }, { status: 400 });
  }

  if (body.is_active && !user.is_active) {
    await activateMember(id, "manual");
    await pushMessage(id, "屋主幫你開通了！現在可以用下面的按鈕開關門。").catch(() => {});
  } else if (!body.is_active && user.is_active) {
    await deactivateMember(id);
  }
  return NextResponse.json({ status: "ok" });
}
