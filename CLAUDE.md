# ding-wifi-gate

用 LINE Bot 控制家裡鐵捲門的 IoT 專案。

## 背景

原本裝了「捲門衛士」Wi-Fi 開關（已倒閉，遙控器買不到、帳號額度只有 3 個）。目標是自製替代品，透過 LINE 控制鐵捲門，可開放給任意人數使用。

## 硬體

- **鐵捲門控制器**：3S 品牌白色盒子，接在馬達旁
- **捲門衛士**：並聯在 3S 控制器上的 Wi-Fi 外掛模組，接出 4 條線（紅、白、黑、綠/黃），對應上/下/停/COM 乾接點訊號
- **ESP32**：NodeMCU 開發板，CP2102 晶片，用 Micro-USB 連接 Mac
- **繼電器模組**：尚未購買（下一個硬體步驟）

## 系統架構

```
用戶 LINE
  ↓ Webhook
Vercel (Next.js)  ←── 目前用 Cloudflare Tunnel 測試
  ↓ MQTT Publish
HiveMQ Cloud (免費 Serverless Cluster)
  ↓ MQTT Push
ESP32（家裡，長連線訂閱 home/garage topic）
  ↓
GPIO 2（目前接板載 LED 模擬，之後換繼電器）
  ↓
繼電器 → 鐵捲門 4 條控制線
```

## 完成進度

- [x] ESP32 燒錄韌體，連上 Wi-Fi
- [x] ESP32 訂閱 HiveMQ MQTT（`home/garage` topic）
- [x] Next.js API Route `POST /api/garage`（直接發 MQTT，測試用）
- [x] Next.js LINE Webhook `POST /api/webhook`（驗證簽名、解析指令、發 MQTT、回覆用戶）
- [x] LINE Bot 傳「開門/關門/停」→ ESP32 LED 閃動（全鏈路驗證成功）

## 待辦事項

1. **部署 Vercel**
   - `git push` 到 GitHub，連結 Vercel 自動部署
   - 在 Vercel 環境變數填入 `.env.local` 的所有值
   - 更新 LINE Developers 的 Webhook URL 為 Vercel 網址

2. **購買並接繼電器**
   - 買「4 路 5V 繼電器模組」
   - 將 ESP32 GPIO 控制腳位接繼電器，繼電器另一端接捲門衛士原來的 4 條線
   - 修改 `firmware/main/main.ino`：把 LED 動作換成對應 GPIO 點動 0.5 秒

3. **權限管理**
   - 目前任何人加 Bot 都能開門，需要加白名單
   - 做法：在 webhook 裡檢查 `event.source.userId` 是否在允許清單內

## 關鍵設定

| 項目 | 值 |
|------|----|
| MQTT Host | `ae9640ca2d934e45945aeaca2fc6d8e1.s1.eu.hivemq.cloud` |
| MQTT Port | `8883` (TLS) |
| MQTT Topic | `home/garage` |
| MQTT Username | `j606888` |
| LINE Channel ID | `2010306542` |
| ESP32 Wi-Fi SSID | `james` |

完整密碼在 `.env.local`（不進 git）。

## 檔案結構

```
ding-wifi-gate/
├── firmware/
│   └── main/
│       └── main.ino       # ESP32 韌體：連 Wi-Fi + 訂閱 MQTT
├── app/
│   └── api/
│       ├── garage/
│       │   └── route.ts   # POST /api/garage - 直接觸發（測試用）
│       └── webhook/
│           └── route.ts   # POST /api/webhook - LINE Bot 入口
├── .env.local             # 所有密碼（不進 git）
└── CLAUDE.md
```

## LINE 指令對應

| LINE 傳的字 | MQTT 訊息 | 動作 |
|------------|-----------|------|
| 開門 / 開 | `open` | 鐵捲門上升 |
| 關門 / 關 | `close` | 鐵捲門下降 |
| 停 | `stop` | 停止 |

## 開發環境

- ESP32 韌體：Arduino IDE 2.3.9，板子選 `ESP32 Dev Module`，Port `/dev/cu.usbserial-0001`
- 需安裝的 Arduino 函式庫：`PubSubClient by Nick O'Leary`
- Next.js dev server：`npm run dev`（port 3005，因為 3000 被佔用）
- 本機測試外網穿透：`cloudflare tunnel` 或 `ngrok http 3005`
