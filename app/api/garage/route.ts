import { NextRequest, NextResponse } from "next/server";
import { publishMQTT } from "@/lib/mqtt";
import { getDefaultGate } from "@/lib/gates";

export async function POST(req: NextRequest) {
  const { action } = await req.json();

  if (!["open", "close", "stop"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  await publishMQTT(await getDefaultGate(), action);

  return NextResponse.json({ status: "ok", action });
}
