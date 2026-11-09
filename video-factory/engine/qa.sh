#!/usr/bin/env bash
# Controle de qualidade do vídeo final: trechos congelados (>= 0,4 s), telas pretas,
# volume (LUFS / pico) e folha de quadros (1 a cada 1,5 s) em out/<slug>-qa.jpg.
# Uso: engine/qa.sh out/<slug>.mp4 [duração]
set -uo pipefail
f="$1"; dur="${2:-$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")}"
base="${f%.mp4}"; ok=1
echo "── QA: $(basename "$f")"
fr=$(ffmpeg -hide_banner -i "$f" -vf "freezedetect=n=0.002:d=0.4" -an -f null - 2>&1 | grep -oE "freeze_start: [0-9.]+|freeze_duration: [0-9.]+" | paste - - | awk '{printf "%s s (%.1f s) ", $2, $4}')
if [ -n "$fr" ]; then echo "  ✗ congelado: $fr"; ok=0; else echo "  ✓ nenhum trecho congelado ≥ 0,4 s"; fi
# telas pretas fora do fade de entrada (0,3 s) e de saída (0,6 s)
bl=$(ffmpeg -hide_banner -i "$f" -vf "blackdetect=d=0.1:pix_th=0.04" -an -f null - 2>&1 | grep -oE "black_start:[0-9.]+ black_end:[0-9.]+" | awk -F'[: ]' -v D="$dur" '$2>0.3 && $4<D-0.6 {printf "%s–%s s ", $2, $4}')
if [ -n "$bl" ]; then echo "  ✗ tela preta: $bl"; ok=0; else echo "  ✓ nenhuma tela preta no meio"; fi
ffmpeg -hide_banner -i "$f" -af ebur128=peak=true -vn -f null - 2>&1 | grep -E "^\s+(I|Peak):" | tr -s ' ' | sed 's/^/  · /'
ffmpeg -loglevel error -y -i "$f" -vf "fps=2/3,scale=180:320,tile=12x3:padding=3:color=black" -frames:v 1 "$base-qa.jpg" && echo "  · folha de QA: $base-qa.jpg"
[ $ok = 1 ] && echo "  ✓ QA aprovado" || echo "  ✗ QA com problemas (ver acima)"
