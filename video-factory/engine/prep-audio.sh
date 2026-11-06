#!/usr/bin/env bash
# Limpa as narrações brutas (raw-NN.mp3): corta silêncio do início/fim, acelera levemente e normaliza.
# Uso: engine/prep-audio.sh episodes/<slug> [tempo=1.08]
set -euo pipefail
dir="$1/audio"; tempo="${2:-1.08}"
for f in "$dir"/raw-[0-9]*.mp3; do
  out="$dir/$(basename "$f" | sed 's/^raw-//')"
  ffmpeg -y -loglevel error -i "$f" -af "silenceremove=start_periods=1:start_threshold=-38dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-38dB:start_silence=0.08,areverse,atempo=$tempo" -ar 48000 -b:a 192k "$out"
  printf '%s %.2fs\n' "$(basename "$out")" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out")"
done
