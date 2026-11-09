#!/usr/bin/env node
/* Alinha o roteiro (campo "vo" de cada cena) com a narração SEM alterar o áudio.
 * Sem reconhecimento de fala: detecta os trechos de fala/silêncio e usa programação dinâmica
 * para escolher onde termina cada frase do roteiro, casando nº de sílabas com duração de fala,
 * premiando cortes em pausas longas e punindo fim de frase (.?!) no meio de um trecho de fala.
 * Uso: node engine/align.js episodes/<slug>   → grava episodes/<slug>/timing.json */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');

const epDir = path.resolve(process.argv[2]);
const ep = JSON.parse(fs.readFileSync(path.join(epDir, 'episode.json'), 'utf8'));
const voice = path.join(epDir, ep.voice || 'audio/voice.mp3');
const duration = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voice]).toString());

// ---- 1. trechos de fala ----
const log = spawnSync('ffmpeg', ['-hide_banner', '-i', voice, '-af', 'silencedetect=n=-40dB:d=0.12', '-f', 'null', '-']).stderr.toString();
const sil = []; let s0 = null;
for (const l of log.split('\n')) {
  let m = l.match(/silence_start: (-?[\d.]+)/); if (m) s0 = Math.max(0, +m[1]);
  m = l.match(/silence_end: ([\d.]+)/); if (m && s0 != null) { sil.push([s0, +m[1]]); s0 = null; }
}
if (s0 != null) sil.push([s0, duration]);
const segs = []; let cur = 0;
for (const [a, b] of sil) { if (a - cur > 0.04) segs.push([cur, a]); cur = b; }
if (duration - cur > 0.04) segs.push([cur, duration]);

// ---- 2. frases do roteiro (quebradas na pontuação) e sílabas ----
const syl = w => Math.max(1, (w.toLowerCase().match(/[aeiouáéíóúâêôãõàü]+/g) || []).length);
const phrases = [];
ep.scenes.forEach((sc, si) => {
  const parts = sc.vo.match(/[^.,;:?!]+[.,;:?!]*/g).map(s => s.trim()).filter(Boolean);
  parts.forEach(p => phrases.push({ text: p, scene: si, words: p.split(/\s+/), syl: p.split(/\s+/).reduce((a, w) => a + syl(w), 0), end: /[.?!]$/.test(p) ? 'sent' : /[,;:]$/.test(p) ? 'comma' : '' }));
});
// a última frase de cada cena é fim de cena (corte mais forte)
phrases.forEach((p, i) => { if (!phrases[i + 1] || phrases[i + 1].scene !== p.scene) p.end = 'scene'; });

// ---- 3. pontos de corte candidatos: meio de cada pausa + grade de 0,1 s dentro da fala ----
const cands = [];
for (let k = 0; k + 1 < segs.length; k++) cands.push({ t: (segs[k][1] + segs[k + 1][0]) / 2, gap: segs[k + 1][0] - segs[k][1] });
for (const [a, b] of segs) for (let t = a + 0.15; t < b - 0.15; t += 0.1) cands.push({ t, gap: 0 });
cands.sort((x, y) => x.t - y.t);
const T0 = segs[0][0], T1 = segs[segs.length - 1][1];
const pts = [{ t: T0, gap: 1 }, ...cands.filter(c => c.t > T0 && c.t < T1), { t: T1, gap: 1 }];
const speechIn = (a, b) => segs.reduce((acc, [x, y]) => acc + Math.max(0, Math.min(b, y) - Math.max(a, x)), 0);
const gapsIn = (a, b) => cands.filter(c => c.gap > 0 && c.t > a + 0.05 && c.t < b - 0.05).reduce((acc, c) => acc + Math.max(0, c.gap - 0.3), 0);
const totalSpeech = speechIn(T0, T1), totalSyl = phrases.reduce((a, p) => a + p.syl, 0), rate = totalSpeech / totalSyl;

function cost(p, a, b, cutPt) {
  const d = speechIn(a, b), e = p.syl * rate;
  let c = (d - e) ** 2 / Math.max(e, 0.3) * 4;
  c += gapsIn(a, b) * (p.end === 'comma' ? 1.5 : 3);            // pausa longa no meio da frase
  if (cutPt.gap === 0) c += { scene: 6, sent: 4, comma: 1.2, '': 0.6 }[p.end];   // corte dentro da fala
  else c -= Math.min(cutPt.gap, 1.2) * { scene: 3, sent: 2.2, comma: 1, '': 0.4 }[p.end]; // corte numa pausa
  return c;
}
// ---- 4. programação dinâmica ----
const P = phrases.length, N = pts.length, INF = 1e18;
const D = Array.from({ length: P + 1 }, () => new Float64Array(N).fill(INF)), BK = Array.from({ length: P + 1 }, () => new Int32Array(N).fill(-1));
D[0][0] = 0;
for (let i = 1; i <= P; i++) for (let j = 1; j < N; j++) {
  if (i === P && j !== N - 1) continue;
  for (let k = 0; k < j; k++) {
    if (D[i - 1][k] === INF) continue;
    const e = phrases[i - 1].syl * rate; if (pts[j].t - pts[k].t > e * 3 + 2) continue;
    const v = D[i - 1][k] + cost(phrases[i - 1], pts[k].t, pts[j].t, pts[j]);
    if (v < D[i][j]) { D[i][j] = v; BK[i][j] = k; }
  }
}
const cuts = []; for (let i = P, j = N - 1; i > 0; i--) { cuts.unshift(j); j = BK[i][j]; } cuts.unshift(0);
// ---- 5. tempo de cada frase (fala efetiva) e de cada palavra (proporcional às sílabas) ----
const words = [];
phrases.forEach((p, i) => {
  const a = pts[cuts[i]].t, b = pts[cuts[i + 1]].t;
  const inside = segs.map(([x, y]) => [Math.max(a, x), Math.min(b, y)]).filter(([x, y]) => y - x > 0.02);
  p.start = inside.length ? inside[0][0] : a; p.stop = inside.length ? inside[inside.length - 1][1] : b;
  // mapeia "posição em sílabas" -> tempo, pulando as pausas internas
  const tot = inside.reduce((s, [x, y]) => s + y - x, 0) || (b - a);
  const at = f => { let r = f * tot; for (const [x, y] of inside) { if (r <= y - x) return x + r; r -= y - x; } return p.stop; };
  let acc = 0; p.words.forEach(w => { words.push({ w, t: +at(acc / p.syl).toFixed(3), scene: p.scene }); acc += syl(w); });
});
const out = {
  voice: path.relative(epDir, voice), duration: +duration.toFixed(3),
  phrases: phrases.map(p => ({ scene: p.scene, text: p.text, start: +p.start.toFixed(3), end: +p.stop.toFixed(3) })),
  words, segments: segs.map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)]),
};
fs.writeFileSync(path.join(epDir, 'timing.json'), JSON.stringify(out, null, 1));
console.log(`voz ${duration.toFixed(2)} s · ${segs.length} trechos de fala · ${P} frases`);
for (const p of out.phrases) console.log(`  cena ${p.scene + 1}  ${p.start.toFixed(2).padStart(6)} → ${p.end.toFixed(2).padStart(6)}  ${p.text}`);
