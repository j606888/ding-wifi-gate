import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import mqtt from "mqtt";
import { supabase } from "@/lib/supabase";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const MQTT_URL = `mqtts://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`;
const TOPIC = process.env.MQTT_TOPIC!;

const COMMAND_MAP: Record<string, string> = {
  開門: "open",
  開: "open",
  關門: "close",
  關: "close",
  停止: "stop",
  停: "stop",
};

const LABEL_MAP: Record<string, string> = {
  開門: "開門",
  開: "開門",
  關門: "關門",
  關: "關門",
  停止: "停止",
  停: "停止",
};

async function getLineProfile(
  lineUserId: string
): Promise<{ displayName: string }> {
  const res = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!res.ok) return { displayName: "" };
  const data = await res.json();
  return { displayName: data.displayName ?? "" };
}

async function getOrCreateUser(lineUserId: string): Promise<{
  displayName: string;
  is_active: boolean;
  isNew: boolean;
}> {
  const { data: existing } = await supabase
    .from("users")
    .select("display_name, is_active")
    .eq("line_user_id", lineUserId)
    .single();

  if (existing) {
    return { displayName: existing.display_name ?? "", is_active: existing.is_active, isNew: false };
  }

  const { displayName } = await getLineProfile(lineUserId);
  await supabase.from("users").insert({
    line_user_id: lineUserId,
    display_name: displayName,
    is_active: false,
  });
  return { displayName, is_active: false, isNew: true };
}

async function logAccess(
  lineUserId: string,
  displayName: string,
  action: string,
  status: "success" | "denied"
): Promise<void> {
  await supabase.from("access_logs").insert({
    line_user_id: lineUserId,
    display_name: displayName,
    action,
    status,
  });
}

function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
}

async function publishMQTT(action: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(MQTT_URL, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      rejectUnauthorized: false,
    });
    client.on("connect", () => {
      client.publish(TOPIC, action, { qos: 1 }, (err) => {
        client.end();
        err ? reject(err) : resolve();
      });
    });
    client.on("error", reject);
  });
}

async function replyMessage(replyToken: string, text: string): Promise<void> {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  if (!verifySignature(body, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 });
  }

  const { events } = JSON.parse(body);

  for (const event of events) {
    const lineUserId: string = event.source.userId;

    if (event.type === "follow") {
      const { isNew, displayName } = await getOrCreateUser(lineUserId);
      if (isNew) {
        await replyMessage(
          event.replyToken,
          `你好 ${displayName}！\n你的帳號已建立，請等待管理員開通權限後即可使用。`
        );
      }
      continue;
    }

    if (event.type !== "message" || event.message.type !== "text") continue;

    const text: string = event.message.text.trim();
    const action = COMMAND_MAP[text];

    const { displayName, is_active } = await getOrCreateUser(lineUserId);

    if (!action) {
      await replyMessage(
        event.replyToken,
        `指令不認識。\n可用指令：開門、關門、停`
      );
      continue;
    }

    if (!is_active) {
      await logAccess(lineUserId, displayName, action, "denied");
      await replyMessage(event.replyToken, "你沒有使用權限，請聯絡管理員。");
      continue;
    }

    try {
      await publishMQTT(action);
      await logAccess(lineUserId, displayName, action, "success");
      await replyMessage(event.replyToken, `${LABEL_MAP[text]}成功`);
    } catch {
      await replyMessage(event.replyToken, "發送失敗，請稍後再試");
    }
  }

  return NextResponse.json({ status: "ok" });
}
