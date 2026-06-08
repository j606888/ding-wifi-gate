#!/bin/bash
# Setup LINE Rich Menu for garage control

set -e

# Load env
source "$(dirname "$0")/../.env.local"
TOKEN="$LINE_CHANNEL_ACCESS_TOKEN"
IMAGE="$(dirname "$0")/../public/line-rich-menu.png"

echo "=== 1. Create rich menu ==="
MENU_ID=$(curl -s -X POST https://api.line.me/v2/bot/richmenu \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "size": {"width": 2500, "height": 843},
    "selected": true,
    "name": "garage-control",
    "chatBarText": "控制鐵捲門",
    "areas": [
      {
        "bounds": {"x": 0, "y": 0, "width": 833, "height": 843},
        "action": {"type": "message", "label": "打開", "text": "打開"}
      },
      {
        "bounds": {"x": 833, "y": 0, "width": 834, "height": 843},
        "action": {"type": "message", "label": "關門", "text": "關門"}
      },
      {
        "bounds": {"x": 1667, "y": 0, "width": 833, "height": 843},
        "action": {"type": "message", "label": "停止", "text": "停止"}
      }
    ]
  }' | tee /dev/stderr | python3 -c "import sys,json; print(json.load(sys.stdin)['richMenuId'])")

echo ""
echo "=== 2. Upload image (richMenuId: $MENU_ID) ==="
curl -s -X POST "https://api-data.line.me/v2/bot/richmenu/$MENU_ID/content" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: image/png" \
  --data-binary "@$IMAGE" | python3 -m json.tool

echo ""
echo "=== 3. Set as default rich menu ==="
curl -s -X POST "https://api.line.me/v2/bot/user/all/richmenu/$MENU_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Length: 0"

echo ""
echo "Done! Rich menu ID: $MENU_ID"
