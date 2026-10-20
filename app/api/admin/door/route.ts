import { NextRequest, NextResponse } from "next/server";
import { publishMQTT, type GarageAction } from "@/lib/mqtt";
import { logAccess, notifyBark } from "@/lib/access";
import { requireAdmin } from "@/lib/auth";

const ACTIONS: GarageAction[] = ["open", "close", "stop"];
const DISPLAY_NAME = "管理員";

// 後台「控制」分頁直接開/關/停
export async function POST(req: NextRequest) {
  if (!requireAdmin(req, Date.now())) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { action } = await req.json().catch(() => ({ action: "" }));
  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ error: "未知的指令" }, { status: 400 });
  }

  try {
    await publishMQTT(action);
  } catch {
    return NextResponse.json({ error: "發送失敗，請稍後再試" }, { status: 502 });
  }

  await logAccess({
    action,
    status: "success",
    displayName: DISPLAY_NAME,
    source: "web",
  });
  notifyBark(DISPLAY_NAME, action).catch(() => {});

  return NextResponse.json({ status: "ok" });
}
