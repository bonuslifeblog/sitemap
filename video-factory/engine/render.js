#!/usr/bin/env node
/* Uso: node engine/render.js episodes/001-leilao-google [--preview]
 * Lê episode.json + audio/NN.mp3 (uma narração por cena) + audio/music.(wav|mp3) opcional
 * e gera out/<slug>.mp4 (1080x1920, 30 fps) + out/<slug>-capa.jpg */
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '..');
const epDir = path.resolve(process.argv[2] || '');
const preview = process.argv.includes('--preview');
const stills = process.argv.includes('--stills'); // salva 1 quadro por segundo + folha de quadros, sem gerar vídeo
const ep = JSON.parse(fs.readFileSync(path.join(epDir, 'episode.json'), 'utf8'));
const slug = path.basename(epDir);
const outDir = path.join(ROOT, 'out'); fs.mkdirSync(outDir, { recursive: true });
if (stills) fs.rmSync(path.join(outDir, 'stills'), { recursive: true, force: true });

const probe = f => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// 1) linha do tempo
const LEAD = ep.lead ?? 0.35, GAP = ep.gap ?? 0.45;
if (ep.voice) {
  // voz única e INTACTA: o vídeo se ajusta a ela (timing.json vem do engine/align.js)
  const voice = path.join(epDir, ep.voice), tj = path.join(epDir, 'timing.json');
  const stale = !fs.existsSync(tj) || fs.statSync(tj).mtimeMs < Math.max(fs.statSync(voice).mtimeMs, fs.statSync(path.join(epDir, 'episode.json')).mtimeMs);
  if (stale) execFileSync('node', [path.join(__dirname, 'align.js'), epDir], { stdio: 'inherit' });
  const tm = JSON.parse(fs.readFileSync(tj, 'utf8'));
  ep.voiceFile = voice; ep.voiceLead = LEAD;
  const PRE = 0.12; // a cena começa um pouco antes da primeira palavra
  ep.scenes.forEach((sc, i) => {
    sc.index = i;
    const ph = tm.phrases.filter(p => p.scene === i);
    const first = ph[0].start + LEAD, last = ph[ph.length - 1].end + LEAD;
    sc.start = i === 0 ? 0 : first - PRE;
    sc.voStart = first - sc.start; sc.voDur = last - first;
    sc.words = tm.words.filter(w => w.scene === i).map(w => ({ w: w.w, t: +(w.t + LEAD).toFixed(3) }));
  });
  const end = tm.duration + LEAD + 0.5 + (ep.scenes[ep.scenes.length - 1].extra || 0);
  ep.scenes.forEach((sc, i) => { sc.dur = (i + 1 < ep.scenes.length ? ep.scenes[i + 1].start : end) - sc.start; });
  ep.duration = end;
} else {
  // modo antigo: um arquivo de narração por cena (audio/NN.mp3)
  let cursor = 0;
  ep.scenes.forEach((sc, i) => {
    sc.index = i;
    const a = path.join(epDir, 'audio', `${String(i + 1).padStart(2, '0')}.mp3`);
    sc.audio = fs.existsSync(a) ? a : null;
    sc.voDur = sc.audio ? probe(sc.audio) : (sc.minDur || 3);
    sc.voStart = i === 0 ? LEAD : 0.15;
    sc.dur = Math.max(sc.minDur || 0, sc.voStart + sc.voDur + GAP + (sc.extra || 0));
    sc.start = cursor; cursor += sc.dur;
  });
  ep.duration = cursor;
}
console.log(`duração: ${ep.duration.toFixed(1)}s, ${ep.scenes.length} cenas`);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => { console.error('ERRO NA PÁGINA:', e.message); process.exit(1); });
  await page.goto('file://' + path.join(ROOT, 'engine', 'page.html'));
  if (ep.map) await page.evaluate(w => window.MAP.load(w), JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/world-atlas/countries-50m.json'), 'utf8')));
  const { frames, fps } = await page.evaluate(e => window.ENGINE.init(e), ep);
  const cues = await page.evaluate(() => window.ENGINE.cues ? window.ENGINE.cues() : []);
  console.log(`${cues.length} efeitos sonoros`);

  const silent = path.join(outDir, `${slug}.silent.mp4`);
  const ff = stills ? null : spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', preview ? 'veryfast' : 'medium', '-crf', '20', '-maxrate', '14M', '-bufsize', '28M', '-pix_fmt', 'yuv420p', silent], { stdio: ['pipe', 'inherit', 'inherit'] });
  const coverAt = Math.round((ep.coverAt ?? 2.2) * fps);
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const url = await page.evaluate(n => window.ENGINE.frame(n), i);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (stills) { if (i % 30 === 0) { fs.mkdirSync(path.join(outDir, 'stills'), { recursive: true }); fs.writeFileSync(path.join(outDir, 'stills', `${String(i).padStart(5, '0')}.jpg`), buf); } continue; }
    if (i === coverAt) fs.writeFileSync(path.join(outDir, `${slug}-capa.jpg`), buf);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) process.stdout.write(`\rquadro ${i}/${frames} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  if (stills) {
    await browser.close();
    const sheet = path.join(outDir, `${slug}-folha.jpg`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-pattern_type', 'glob', '-i', path.join(outDir, 'stills', '*.jpg'), '-vf', 'scale=216:384,tile=10x4:padding=4:color=black', '-frames:v', '1', sheet]);
    console.log('\nfolha de quadros (1 por segundo):', sheet); return;
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('\nvídeo sem áudio pronto');

  // 2) mixagem: voz (sem graves) + efeitos + trilha com ducking (e respiro extra nos booms)
  const SFX = path.join(ROOT, 'engine', 'sfx');
  const args = ['-y', '-loglevel', 'error', '-i', silent];
  const filters = []; let n = 1; const voL = [], fxL = [];
  if (ep.voiceFile) {
    args.push('-i', ep.voiceFile); const ms = Math.round(ep.voiceLead * 1000);
    filters.push(`[${n}:a]aresample=48000,adelay=${ms}|${ms},apad[v${n}]`); voL.push(`[v${n}]`); n++;
  }
  for (const sc of ep.scenes) if (sc.audio) {
    args.push('-i', sc.audio); const ms = Math.round((sc.start + sc.voStart) * 1000);
    filters.push(`[${n}:a]aresample=48000,adelay=${ms}|${ms},apad[v${n}]`); voL.push(`[v${n}]`); n++;
  }
  filters.push(`${voL.join('')}amix=inputs=${voL.length}:normalize=0,highpass=f=65,equalizer=f=170:t=q:w=1.2:g=3,equalizer=f=3200:t=q:w=1.5:g=3.5,acompressor=threshold=0.1:ratio=3.5:attack=6:release=150:makeup=1.5,volume=${ep.voiceGain ?? 1.0}[vo]`);
  for (const c of cues) {
    args.push('-i', path.join(SFX, c.sfx + '.wav'));
    const ms = Math.max(0, Math.round(c.t * 1000));
    let f = `[${n}:a]aresample=48000`;
    if (c.dur) f += `,atrim=0:${c.dur.toFixed(2)},afade=t=out:st=${Math.max(0, c.dur - .12).toFixed(2)}:d=0.12`;
    if (c.end) f += `,atrim=0:${(c.end - c.t).toFixed(2)}`;
    f += `,volume=${(c.gain * (ep.sfxGain ?? 0.7)).toFixed(2)},adelay=${ms}|${ms},apad[x${n}]`;
    filters.push(f); fxL.push(`[x${n}]`); n++;
  }
  if (fxL.length) filters.push(`${fxL.join('')}amix=inputs=${fxL.length}:normalize=0[fx]`);
  const booms = cues.filter(c => c.bass).map(c => c.t);
  const dip = booms.length ? `,volume='if(${booms.map(t => `between(t,${(t - .1).toFixed(2)},${(t + 1.1).toFixed(2)})`).join('+')},0.35,1)':eval=frame` : '';
  const music = ['music.wav', 'music.mp3'].map(f => path.join(epDir, 'audio', f)).find(fs.existsSync);
  const busIn = ['[vo1]', fxL.length ? '[fx]' : null].filter(Boolean);
  filters.push(`[vo]asplit=2[vo1][vo2]`);
  if (music) {
    args.push('-stream_loop', '-1', '-i', music);
    filters.push(`[${n}:a]aresample=48000,volume=${ep.musicGain ?? 0.35}${dip},afade=t=out:st=${(ep.duration - 1.5).toFixed(2)}:d=1.5[m]`);
    filters.push(`[m][vo2]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md]`);
    busIn.push('[md]');
  } else filters.push(`[vo2]anullsink`);
  filters.push(`${busIn.join('')}amix=inputs=${busIn.length}:normalize=0,alimiter=limit=0.95:attack=2:release=60,loudnorm=I=-14:TP=-1.2:LRA=11,aresample=48000[a]`);
  const final = path.join(outDir, `${slug}.mp4`);
  args.push('-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', ep.duration.toFixed(2), '-movflags', '+faststart', final);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  fs.unlinkSync(silent);
  console.log('pronto:', final);
  execFileSync(path.join(__dirname, 'qa.sh'), [final, String(ep.duration)], { stdio: 'inherit' });
})();
