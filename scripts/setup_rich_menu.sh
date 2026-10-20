#!/bin/bash
# 建立兩種 LINE Rich Menu：
#   尚未綁定（預設，所有人）：輸入啟動碼 / 申請使用
#   已綁定（開通的人個別綁定）：開門 / 關門 / 停止
# 圖片先用 scripts/rich-menu/render.sh 產生到 public/。
# 跑完把印出的 LINE_RICH_MENU_BOUND_ID 加到 Vercel 環境變數並重新部署。

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/.env.local"
TOKEN="$LINE_CHANNEL_ACCESS_TOKEN"

create_menu() { # $1 = JSON body → 印出 richMenuId
  curl -s -X POST https://api.line.me/v2/bot/richmenu \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$1" | python3 -c "import sys,json; print(json.load(sys.stdin)['richMenuId'])"
}

upload_image() { # $1 = richMenuId, $2 = png
  curl -s -X POST "https://api-data.line.me/v2/bot/richmenu/$1/content" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: image/png" \
    --data-binary "@$2" > /dev/null
}

echo "=== 1. 已綁定選單（開門 / 關門 / 停止）==="
BOUND_ID=$(create_menu '{
  "size": {"width": 2500, "height": 843},
  "selected": true,
  "name": "garage-bound",
  "chatBarText": "控制鐵捲門",
  "areas": [
    {"bounds": {"x": 0, "y": 0, "width": 833, "height": 843}, "action": {"type": "message", "label": "開門", "text": "開門"}},
    {"bounds": {"x": 833, "y": 0, "width": 834, "height": 843}, "action": {"type": "message", "label": "關門", "text": "關門"}},
    {"bounds": {"x": 1667, "y": 0, "width": 833, "height": 843}, "action": {"type": "message", "label": "停止", "text": "停止"}}
  ]
}')
upload_image "$BOUND_ID" "$ROOT/public/line-rich-menu-bound.png"
echo "$BOUND_ID"

echo "=== 2. 尚未綁定選單（輸入啟動碼 / 申請使用）==="
UNBOUND_ID=$(create_menu '{
  "size": {"width": 2500, "height": 843},
  "selected": true,
  "name": "garage-unbound",
  "chatBarText": "開始使用",
  "areas": [
    {"bounds": {"x": 0, "y": 0, "width": 1500, "height": 843}, "action": {"type": "message", "label": "輸入啟動碼", "text": "輸入啟動碼"}},
    {"bounds": {"x": 1500, "y": 0, "width": 1000, "height": 843}, "action": {"type": "message", "label": "申請使用", "text": "申請使用"}}
  ]
}')
upload_image "$UNBOUND_ID" "$ROOT/public/line-rich-menu-unbound.png"
echo "$UNBOUND_ID"

echo "=== 3. 已開通的人先綁上「已綁定」選單 ==="
USER_IDS=$(curl -s "$SUPABASE_URL/rest/v1/users?is_active=eq.true&select=line_user_id" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  | python3 -c "import sys,json; print(json.dumps([u['line_user_id'] for u in json.load(sys.stdin)]))")
echo "$USER_IDS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)), '人')"
if [ "$USER_IDS" != "[]" ]; then
  curl -s -X POST https://api.line.me/v2/bot/richmenu/bulk/link \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"richMenuId\": \"$BOUND_ID\", \"userIds\": $USER_IDS}"
  echo
fi

echo "=== 4. 「尚未綁定」設成預設選單 ==="
curl -s -X POST "https://api.line.me/v2/bot/user/all/richmenu/$UNBOUND_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Length: 0"
echo

echo ""
echo "完成！把這行加到 Vercel 環境變數，然後重新部署："
echo "LINE_RICH_MENU_BOUND_ID=$BOUND_ID"
