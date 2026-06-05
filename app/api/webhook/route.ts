import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import mqtt from "mqtt";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;
const MQTT_URL = `mqtts://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`;
const TOPIC = process.env.MQTT_TOPIC!;

const COMMAND_MAP: Record<string, string> = {
  開門: "open",
  開: "open",
  關門: "close",
  關: "close",
  停: "stop",
};

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
    if (event.type !== "message" || event.message.type !== "text") continue;

    const text: string = event.message.text.trim();
    const action = COMMAND_MAP[text];

    if (!action) {
      await replyMessage(
        event.replyToken,
        `指令不認識。\n可用指令：開門、關門、停`
      );
      continue;
    }

    try {
      await publishMQTT(action);
      const label = text === "停" ? "停止" : text;
      await replyMessage(event.replyToken, `${label} 指令已送出`);
    } catch {
      await replyMessage(event.replyToken, "發送失敗，請稍後再試");
    }
  }

  return NextResponse.json({ status: "ok" });
}
