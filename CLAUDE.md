# ding-wifi-gate

用 LINE Bot 控制家裡鐵捲門的 IoT 專案。

## 背景

原本裝了「捲門衛士」Wi-Fi 開關（已倒閉，遙控器買不到、帳號額度只有 3 個）。目標是自製替代品，透過 LINE 控制鐵捲門，可開放給任意人數使用。

## 硬體

- **鐵捲門控制器**：3S 品牌白色盒子，接在馬達旁
- **捲門衛士**：並聯在 3S 控制器上的 Wi-Fi 外掛模組，接出 4 條線（紅、白、黑、綠/黃），對應上/下/停/COM 乾接點訊號
- **ESP32**：NodeMCU 開發板，CP2102 晶片，用 Micro-USB 連接 Mac
- **繼電器模組**：HW-316，4路 5V，JQC3F-05VDC-C 繼電器，黃色 Jumper 保持接著

## 系統架構

```
用戶 LINE
  ↓ Webhook
Vercel (Next.js)  https://ding-wifi-gate.vercel.app
  ↓ 查/寫 Supabase（用戶權限、操作紀錄）
Supabase (PostgreSQL)
  ↓ MQTT Publish
HiveMQ Cloud (免費 Serverless Cluster)
  ↓ MQTT Push
ESP32（家裡，長連線訂閱 home/garage topic）
  ↓ GPIO 26/27/14
繼電器模組（HW-316）
  ↓ 乾接點 NO+COM
鐵捲門控制器（3S）端子台
```

## 完成進度

- [x] ESP32 燒錄韌體，連上 Wi-Fi
- [x] ESP32 訂閱 HiveMQ MQTT（`home/garage` topic）
- [x] Next.js API Route `POST /api/garage`（直接發 MQTT，測試用）
- [x] Next.js LINE Webhook `POST /api/webhook`（驗證簽名、解析指令、發 MQTT、回覆用戶）
- [x] LINE Bot 傳「開門/關門/停」→ ESP32 LED 閃動（全鏈路驗證成功）
- [x] 部署 Vercel（`https://ding-wifi-gate.vercel.app/api/webhook`），LINE Webhook 驗證成功
- [x] 接繼電器模組，LINE 實際控制鐵捲門成功（全鏈路驗證）
- [x] Supabase 整合：用戶管理（`users` 表）＋操作紀錄（`access_logs` 表）
- [x] 權限管理：新用戶自動建立帳號，管理員手動開通 `is_active`
- [x] LINE Rich Menu：快速開門/關門/停止按鈕
- [x] 「誰來了」指令：顯示最新 5 筆開門紀錄（相對時間格式）

## 待辦事項

1. **線路整理**
   - 目前裸線外露，需裝入盒子保護
   - 規劃：找適合的塑膠盒，固定 ESP32 + 繼電器模組，線路整齊收納

## 關鍵設定

| 項目 | 值 |
|------|----|
| MQTT Host | `ae9640ca2d934e45945aeaca2fc6d8e1.s1.eu.hivemq.cloud` |
| MQTT Port | `8883` (TLS) |
| MQTT Topic | `home/garage` |
| MQTT Username | `j606888` |
| LINE Channel ID | `2010306542` |
| ESP32 Wi-Fi SSID | `james` |
| Supabase URL | `SUPABASE_URL` in `.env.local` |

完整密碼在 `.env.local`（不進 git）。需要的環境變數：
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `MQTT_HOST` / `MQTT_PORT` / `MQTT_USERNAME` / `MQTT_PASSWORD` / `MQTT_TOPIC`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 檔案結構

```
ding-wifi-gate/
├── firmware/
│   └── main/
│       └── main.ino       # ESP32 韌體：連 Wi-Fi + 訂閱 MQTT + 繼電器控制
├── app/
│   └── api/
│       ├── garage/
│       │   └── route.ts   # POST /api/garage - 直接觸發（測試用）
│       └── webhook/
│           └── route.ts   # POST /api/webhook - LINE Bot 入口
├── lib/
│   └── supabase.ts        # Supabase client
├── public/
│   └── line-rich-menu.png # LINE Rich Menu 圖片
├── .env.local             # 所有密碼（不進 git）
└── CLAUDE.md
```

## 接線配置

### ESP32 → 繼電器模組（HW-316）左側控制腳

| ESP32 | 繼電器針腳 |
|-------|-----------|
| GND | GND |
| 5V (VIN) | VCC |
| GPIO 26 | IN1 → 開門（M1） |
| GPIO 27 | IN2 → 關門（M2） |
| GPIO 14 | IN3 → 停止（M3） |

黃色 Jumper 保持原位（VCC/JD-VCC 連在一起）。韌體為 Active LOW，GPIO 預設 HIGH，觸發時拉 LOW 500ms。

### 繼電器模組右側螺絲端子 → 鐵捲門控制器端子台

每個繼電器接 NO + COM 兩個孔（模擬按鍵點動）：

| 繼電器 | NO 孔 | COM 孔 | 鐵捲門端子 |
|--------|-------|--------|-----------|
| M1 | → 「上」端子 | → 「外線」端子 | 開門 |
| M2 | → 「下」端子 | → 「外線」端子 | 關門 |
| M3 | → 「停」端子 | → 「外線」端子 | 停止 |

「外線」（COM）用短線串接 M1/M2/M3 的 COM 孔後拉一條到端子台。M4 不使用。

鐵捲門控制器端子台標籤（由左到右）：上 / 下 / 停 / 單 / 外線 / 紅外線 / 鍵

## Supabase 資料表

### `users`
| 欄位 | 型別 | 說明 |
|------|------|------|
| `line_user_id` | text | LINE userId（主鍵） |
| `display_name` | text | LINE 顯示名稱 |
| `is_active` | bool | 是否有權限（預設 false，管理員手動改） |
| `created_at` | timestamptz | 建立時間 |

### `access_logs`
| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | int | 自動遞增 |
| `line_user_id` | text | 操作者 LINE userId |
| `display_name` | text | 操作者名稱（快照） |
| `action` | text | `open` / `close` / `stop` |
| `status` | text | `success` / `denied` |
| `created_at` | timestamptz | 操作時間 |

## LINE 指令對應

| LINE 傳的字 | MQTT 訊息 | 動作 |
|------------|-----------|------|
| 開門 / 開 | `open` | 鐵捲門上升 |
| 關門 / 關 | `close` | 鐵捲門下降 |
| 停 | `stop` | 停止 |
| 誰來了 | （查詢）| 顯示最新 5 筆成功操作紀錄（相對時間） |

## 開發環境

- ESP32 韌體：Arduino IDE 2.3.9，板子選 `ESP32 Dev Module`，Port `/dev/cu.usbserial-0001`
- 需安裝的 Arduino 函式庫：`PubSubClient by Nick O'Leary`
- Next.js dev server：`npm run dev`（port 3005，因為 3000 被佔用）
- 本機測試外網穿透：`cloudflare tunnel` 或 `ngrok http 3005`
