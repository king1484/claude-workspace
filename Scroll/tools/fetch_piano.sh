#!/usr/bin/env bash
# Download and unpack the Salamander Grand Piano samples (CC BY 3.0, Alexander Holm) into Scroll/assets/piano/.
# The samples (about 1.2 GB) are not committed. Needs freepats.zenvoid.org to be reachable.
set -euo pipefail
DEST="${1:-Scroll/assets/piano}"
URL="https://freepats.zenvoid.org/Piano/SalamanderGrandPiano/SalamanderGrandPianoV3+20161209_44khz16bit.tar.xz"
SHA256="58750eb1366761e187f71ddb9b932355ea894d28ec4331e74ab8acb44c819936"
mkdir -p "$DEST"
curl -fL --retry 3 -o "$DEST/salamander.tar.xz" "$URL"
echo "$SHA256  $DEST/salamander.tar.xz" | sha256sum -c -
tar -xJf "$DEST/salamander.tar.xz" --no-same-owner -C "$DEST"
echo "Samples in $DEST/SalamanderGrandPianoV3_44.1khz16bit/44.1khz16bit (sampled every minor third, 16 velocity layers)"
