import mqtt from "mqtt";
import type { Gate } from "@/lib/gates";

const MQTT_URL = `mqtts://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`;

// 連線＋發送的總時限。HiveMQ 卡住時要快速失敗，不要讓呼叫端（例如手錶捷徑）一直轉圈。
const PUBLISH_TIMEOUT_MS = 5000;

export type GarageAction = "open" | "close" | "stop";

// 乾跑模式：設 MQTT_DRY_RUN=1（或 true）時只印 log、不真的發 MQTT，
// 讓本機能跑完整流程測試開/關門畫面，鐵門不會動。
const DRY_RUN = /^(1|true)$/i.test(process.env.MQTT_DRY_RUN ?? "");

export async function publishMQTT(gate: Gate, action: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`[MQTT dry-run] 略過發送，topic=${gate.mqtt_topic} action=${action}`);
    return;
  }
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(MQTT_URL, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      rejectUnauthorized: false,
      connectTimeout: PUBLISH_TIMEOUT_MS,
      reconnectPeriod: 0, // 失敗就放棄，不要在背景一直重連
    });
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.end(Boolean(err));
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(
      () => finish(new Error(`MQTT 發送逾時（${PUBLISH_TIMEOUT_MS}ms）`)),
      PUBLISH_TIMEOUT_MS
    );
    client.on("connect", () => {
      client.publish(gate.mqtt_topic, action, { qos: 1 }, (err) => finish(err ?? undefined));
    });
    client.on("error", (err) => finish(err));
  });
}
