import { NextRequest, NextResponse } from "next/server";
import mqtt from "mqtt";

const MQTT_URL = `mqtts://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`;
const TOPIC = process.env.MQTT_TOPIC!;

export async function POST(req: NextRequest) {
  const { action } = await req.json();

  if (!["open", "close", "stop"].includes(action)) {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  await new Promise<void>((resolve, reject) => {
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

  return NextResponse.json({ status: "ok", action });
}
