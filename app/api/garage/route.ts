import { NextRequest, NextResponse } from "next/server";
import { publishMQTT } from "@/lib/mqtt";

export async function POST(req: NextRequest) {
  const { action } = await req.json();

  if (!["open", "close", "stop"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  await publishMQTT(action);

  return NextResponse.json({ status: "ok", action });
}
