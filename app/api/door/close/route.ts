import { NextRequest, NextResponse } from "next/server";
import { publishMQTT } from "@/lib/mqtt";
import { logAccess, notifyDiscord } from "@/lib/access";
import { verifyToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const now = Date.now();
  const { token } = await req.json().catch(() => ({ token: "" }));

  const payload = verifyToken(token, now);
  if (!payload) {
    return NextResponse.json(
      { error: "授權已過期，請重新輸入密碼" },
      { status: 401 }
    );
  }

  const codeId = payload.codeId as number;
  const label = (payload.label as string) ?? "";

  try {
    await publishMQTT("close");
  } catch {
    return NextResponse.json({ error: "發送失敗，請稍後再試" }, { status: 502 });
  }

  await logAccess({
    action: "close",
    status: "success",
    displayName: `🔑 ${label}`,
    source: "web",
    codeId,
  });
  notifyDiscord(`🔑 ${label}`, "close").catch(() => {});

  return NextResponse.json({ status: "ok" });
}
