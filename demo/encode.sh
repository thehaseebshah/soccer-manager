#!/usr/bin/env bash
# Converts the raw Playwright .webm recordings to widely playable H.264 MP4s and builds the combined demo.
#   demo/encode.sh <rawDir> <outVideoDir>
set -euo pipefail
RAW="${1:?raw dir}"; OUT="${2:?out dir}"
mkdir -p "$OUT"
enc() { ffmpeg -y -loglevel error -i "$RAW/$1.webm" -an -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -r 25 -movflags +faststart "$OUT/$2.mp4"; }
enc fairness 1-fair-playing-time
enc live     2-match-day
enc owner    3-owners-view
enc develop  4-player-development
LIST="$(mktemp)"
for f in 1-fair-playing-time 2-match-day 3-owners-view 4-player-development; do echo "file '$OUT/$f.mp4'" >> "$LIST"; done
ffmpeg -y -loglevel error -f concat -safe 0 -i "$LIST" -c copy -movflags +faststart "$OUT/gaffer-full-demo.mp4"
rm -f "$LIST"
ls -la "$OUT"
