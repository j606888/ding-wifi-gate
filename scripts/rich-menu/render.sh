#!/bin/bash
# 用 Chrome headless 把 unbound.html / bound.html 截成 2500×843 的 Rich Menu PNG
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/../../public"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
for name in unbound bound; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=2500,843 --virtual-time-budget=10000 \
    --screenshot="$OUT/line-rich-menu-$name.png" "file://$DIR/$name.html" 2>/dev/null
  echo "→ public/line-rich-menu-$name.png"
done
