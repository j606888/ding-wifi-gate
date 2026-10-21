import { NextRequest, NextResponse } from "next/server";
import { publishMQTT, type GarageAction } from "@/lib/mqtt";
import { logAccess, notifyBark } from "@/lib/access";
import { verifyToken } from "@/lib/auth";
import { getDefaultGate, getGateById } from "@/lib/gates";
import { cleanGuestName, guestDisplayName } from "@/lib/guest-name";

export async function POST(req: NextRequest) {
  const now = Date.now();
  const { token, action: rawAction } = await req
    .json()
    .catch(() => ({ token: "", action: "close" }));
  // 同一個 token 可以關門或緊急停止
  const action: GarageAction = rawAction === "stop" ? "stop" : "close";

  const payload = verifyToken(token, now);
  if (!payload) {
    return NextResponse.json(
      { error: "授權已過期，請重新輸入密碼" },
      { status: 401 }
    );
  }

  // 舊 token（加 gate 之前簽的）沒有 gateId → 預設 gate
  const gate =
    typeof payload.gateId === "string"
      ? await getGateById(payload.gateId)
      : await getDefaultGate();
  if (!gate) {
    return NextResponse.json({ error: "找不到這扇門" }, { status: 404 });
  }

  const codeId = payload.codeId as number;
  const label = (payload.label as string) ?? "";
  // 名字在開門時簽進 token，關門/停止的紀錄跟著帶上
  const displayName = guestDisplayName(label, cleanGuestName(payload.name));

  try {
    await publishMQTT(gate, action);
  } catch {
    return NextResponse.json({ error: "發送失敗，請稍後再試" }, { status: 502 });
  }

  await logAccess({
    gateId: gate.id,
    action,
    status: "success",
    displayName,
    source: "web",
    codeId,
  });
  notifyBark(displayName, action).catch(() => {});

  return NextResponse.json({ status: "ok" });
}
