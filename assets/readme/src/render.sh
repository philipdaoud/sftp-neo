#!/bin/sh
# Renders the README graphics in ../ from these HTML sources (needs Google Chrome).
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
render() {
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --force-device-scale-factor=2 --window-size="$2" --screenshot="../$1.png" "file://$PWD/$1.html" 2>/dev/null
}
render banner 1280,400
render how-it-works 1280,520
render sidebar 1280,720
render sync-preview 1280,470
