#!/usr/bin/env node
/* Corta uma narração única (audio/raw-full.mp3) em raw-NN.mp3, uma por cena.
 * Para cada fronteira entre cenas, estima o instante pelo nº de caracteres acumulado
 * do texto ("vo") e escolhe a pausa detectada mais próxima dessa estimativa.
 * Uso: node engine/split-voice.js episodes/<slug> */
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const epDir = path.resolve(process.argv[2]);
const ep = JSON.parse(fs.readFileSync(path.join(epDir, 'episode.json'), 'utf8'));
const src = path.join(epDir, 'audio', 'raw-full.mp3');

const err = require('child_process').spawnSync('ffmpeg', ['-hide_banner', '-i', src, '-af', 'silencedetect=n=-40dB:d=0.3', '-f', 'null', '-']).stderr.toString();
const sil = []; let s0 = null;
for (const l of err.split('\n')) {
  let m = l.match(/silence_start: ([\d.]+)/); if (m) s0 = +m[1];
  m = l.match(/silence_end: ([\d.]+)/); if (m && s0 != null) { sil.push({ s: s0, e: +m[1], mid: (s0 + +m[1]) / 2 }); s0 = null; }
}
const total = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString());
const speechStart = sil.length && sil[0].s < 0.05 ? sil[0].e : 0;
const speechEnd = sil.length && sil[sil.length - 1].e > total - 0.05 ? sil[sil.length - 1].s : total;
const inner = sil.filter(x => x.s > speechStart + 0.1 && x.e < speechEnd - 0.1);

// 1º: cortes manuais (ep.voCuts, em segundos). 2º: pausas longas (≥ 1 s) vindas de <break time="1.5s" />
// no roteiro, quando há exatamente N-1 delas. 3º: estimativa pelo tamanho do texto.
const need = ep.scenes.length - 1, long = inner.filter(x => x.e - x.s >= 1.0);
const lens = ep.scenes.map(s => s.vo.length), sum = lens.reduce((a, b) => a + b, 0);
let cuts = [], acc = 0; const used = new Set();
if (ep.voCuts) { cuts = [...ep.voCuts]; console.log('cortes manuais:', cuts.join(', ')); }
else if (long.length === need) { cuts = long.map(x => x.mid); console.log('cortes nas pausas <break>:', cuts.map(c => c.toFixed(2)).join(', ')); }
else for (let i = 0; i < need; i++) {
  acc += lens[i];
  const guess = speechStart + (speechEnd - speechStart) * acc / sum;
  let best = null;
  inner.forEach((x, k) => { if (!used.has(k) && (best == null || Math.abs(x.mid - guess) < Math.abs(inner[best].mid - guess))) best = k; });
  if (best == null) throw new Error('pausas insuficientes para cortar');
  used.add(best); cuts.push(inner[best].mid);
  console.log(`corte ${i + 1}: estimado ${guess.toFixed(2)}s → pausa ${inner[best].mid.toFixed(2)}s`);
}
cuts.sort((a, b) => a - b);
const bounds = [0, ...cuts, total];
for (let i = 0; i < ep.scenes.length; i++) {
  const out = path.join(epDir, 'audio', `raw-${String(i + 1).padStart(2, '0')}.mp3`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-ss', String(bounds[i]), '-to', String(bounds[i + 1]), '-c:a', 'libmp3lame', '-b:a', '192k', out]);
}
console.log(`${ep.scenes.length} arquivos raw-NN.mp3 gerados`);
