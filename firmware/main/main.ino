#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

// Wi-Fi
const char* WIFI_SSID     = "james";
const char* WIFI_PASSWORD = "19930318";

// HiveMQ MQTT
const char* MQTT_HOST     = "ae9640ca2d934e45945aeaca2fc6d8e1.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "j606888";
const char* MQTT_PASS     = "gVXExs!v8BF3PdD";
const char* MQTT_TOPIC    = "home/garage";

const int LED_PIN = 2;

WiFiClientSecure wifiClient;
PubSubClient mqttClient(wifiClient);

void onMessage(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.println("收到訊息: " + msg);

  if (msg == "open" || msg == "close" || msg == "stop") {
    digitalWrite(LED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_PIN, LOW);
    Serial.println("動作執行完畢");
  }
}

void connectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("連線 MQTT...");
    String clientId = "ESP32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
      Serial.println("成功");
      mqttClient.subscribe(MQTT_TOPIC);
    } else {
      Serial.println("失敗，5秒後重試");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("連線 Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nIP: " + WiFi.localIP().toString());

  wifiClient.setInsecure(); // 略過 TLS 憑證驗證（測試用）
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMessage);

  connectMQTT();
}

void loop() {
  if (!mqttClient.connected()) connectMQTT();
  mqttClient.loop();
}
