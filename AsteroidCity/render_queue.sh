#!/bin/bash
# Load-balanced parallel render: W workers pull 1-second segments from a shared queue (heavy shots first),
# then concat + mux with out/mix.wav. Segments already rendered are kept, so the script can be re-run to resume.
# Usage: bash render_queue.sh [workers=4] [half]
set -e
cd "$(dirname "$0")"
W=${1:-4}; Q=""; NAME=final
if [ "$2" = "half" ]; then Q="--query half"; NAME=preview; fi
DIR=out/q_$NAME; mkdir -p $DIR
rm -rf $DIR/*.lock $DIR/*.part.mp4
# impact / fire / shock seconds first (the most expensive), so no worker is left with a long tail
ORDER=10,11,12,18,19,20,21,13,14,15,16,17,22,9,0,1,2,3,23,24,25,26,27,28,29,30,8,7,6,5,4,44,45,46
for i in $(seq 1 $W); do node render.mjs $Q --queue $DIR --order $ORDER > $DIR/worker$i.log 2>&1 & done
wait
ls $DIR/seg_*.mp4 | sort | sed "s#^$DIR/#file '#; s#\$#'#" > $DIR/list.txt
SEGS=$(node -e "const L=require('./out/layout.json');console.log(Math.ceil(Math.round(L.total*30)/30))")
N=$(wc -l < $DIR/list.txt); [ "$N" -eq "$SEGS" ] || { echo "missing segments: $N of $SEGS"; exit 1; }
ffmpeg -y -v error -f concat -safe 0 -i $DIR/list.txt -c copy out/${NAME}_silent.mp4
ffmpeg -y -v error -i out/${NAME}_silent.mp4 -i out/mix.wav -map 0:v -map 1:a -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -c:a aac -b:a 256k -shortest -movflags +faststart out/${NAME}.mp4
echo done out/${NAME}.mp4
