import mqtt from "mqtt";

const MQTT_URL = `mqtts://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`;
const TOPIC = process.env.MQTT_TOPIC!;

export type GarageAction = "open" | "close" | "stop";

// 乾跑模式：設 MQTT_DRY_RUN=1（或 true）時只印 log、不真的發 MQTT，
// 讓本機能跑完整流程測試開/關門畫面，鐵門不會動。
const DRY_RUN = /^(1|true)$/i.test(process.env.MQTT_DRY_RUN ?? "");

export async function publishMQTT(action: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`[MQTT dry-run] 略過發送，action=${action}`);
    return;
  }
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(MQTT_URL, {
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      rejectUnauthorized: false,
    });
    client.on("connect", () => {
      client.publish(TOPIC, action, { qos: 1 }, (err) => {
        client.end();
        if (err) reject(err);
        else resolve();
      });
    });
    client.on("error", reject);
  });
}
