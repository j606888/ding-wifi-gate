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

const int PIN_OPEN  = 26;
const int PIN_CLOSE = 27;
const int PIN_STOP  = 14;

WiFiClientSecure wifiClient;
PubSubClient mqttClient(wifiClient);

void triggerRelay(int pin) {
  digitalWrite(pin, LOW);   // Active LOW：拉低觸發繼電器
  delay(500);
  digitalWrite(pin, HIGH);  // 放開
}

void onMessage(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  Serial.println("收到訊息: " + msg);

  if      (msg == "open")  triggerRelay(PIN_OPEN);
  else if (msg == "close") triggerRelay(PIN_CLOSE);
  else if (msg == "stop")  triggerRelay(PIN_STOP);
  else return;

  Serial.println("動作執行完畢");
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

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("連線 Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nIP: " + WiFi.localIP().toString());

  pinMode(PIN_OPEN,  OUTPUT); digitalWrite(PIN_OPEN,  HIGH);
  pinMode(PIN_CLOSE, OUTPUT); digitalWrite(PIN_CLOSE, HIGH);
  pinMode(PIN_STOP,  OUTPUT); digitalWrite(PIN_STOP,  HIGH);

  wifiClient.setInsecure();
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCallback(onMessage);

  connectMQTT();
}

void loop() {
  if (!mqttClient.connected()) connectMQTT();
  mqttClient.loop();
}
