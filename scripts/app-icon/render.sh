#!/bin/bash
# 用 Chrome headless 把 icon.html 截成 512×512，再用 sips 縮成主畫面圖示（iOS apple-touch-icon + manifest 用）
# Chrome 視窗寬度有下限，所以不直接截小尺寸
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/../../public"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=512,512 --virtual-time-budget=2000 \
  --screenshot="$OUT/icon-512.png" "file://$DIR/icon.html" 2>/dev/null
echo "→ public/icon-512.png"
for pair in apple-touch-icon:180 icon-192:192; do
  name="${pair%%:*}"
  size="${pair##*:}"
  sips -z "$size" "$size" "$OUT/icon-512.png" --out "$OUT/$name.png" >/dev/null
  echo "→ public/$name.png"
done
