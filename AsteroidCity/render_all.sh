#!/bin/bash
# Parallel render in 3 chunks (integer frame boundaries), concat, mux with out/mix.wav.
# Usage: bash render_all.sh [half]   -> out/preview.mp4 (half res) or out/final.mp4
set -e
cd "$(dirname "$0")"
Q=""; NAME=final
if [ "$1" = "half" ]; then Q="--query half"; NAME=preview; fi
FR=$(node -e "const L=require('./out/layout.json');console.log(Math.round(L.total*30))")
B1=$((FR/3)); B2=$((2*FR/3))
s(){ node -e "console.log(($1/30).toFixed(6))"; }
node render.mjs $Q --from 0 --to $(s $B1) --out out/${NAME}_c1.mp4 > out/${NAME}_c1.log 2>&1 &
node render.mjs $Q --from $(s $B1) --to $(s $B2) --out out/${NAME}_c2.mp4 > out/${NAME}_c2.log 2>&1 &
node render.mjs $Q --from $(s $B2) --to $(s $FR) --out out/${NAME}_c3.mp4 > out/${NAME}_c3.log 2>&1 &
wait
printf "file '%s'\n" ${NAME}_c1.mp4 ${NAME}_c2.mp4 ${NAME}_c3.mp4 > out/${NAME}_list.txt
ffmpeg -y -v error -f concat -safe 0 -i out/${NAME}_list.txt -c copy out/${NAME}_silent.mp4
ffmpeg -y -v error -i out/${NAME}_silent.mp4 -i out/mix.wav -map 0:v -map 1:a -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -c:a aac -b:a 256k -shortest -movflags +faststart out/${NAME}.mp4
echo done out/${NAME}.mp4
