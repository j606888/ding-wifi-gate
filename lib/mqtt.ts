import mqtt from "mqtt";

const MQTT_URL = `mqtts://${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`;
const TOPIC = process.env.MQTT_TOPIC!;

export type GarageAction = "open" | "close" | "stop";

export async function publishMQTT(action: string): Promise<void> {
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
