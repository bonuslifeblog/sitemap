/* Motor v2 — "partículas que nunca somem".
 * Os N pontos são sempre os mesmos e viajam de forma em forma por curvas (morph).
 * Cada cena (= 1 trecho de narração) tem várias "batidas" (beats) que trocam o visual a cada 2–3 s.
 * Determinístico: render.js chama init(episode) e depois frame(0..n) em sequência. */
(() => {
  const W = 1080, H = 1920, FPS = 30, N = 6500;
  const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
  const glow = document.createElement('canvas'); glow.width = W; glow.height = H; const gctx = glow.getContext('2d');
  const off = document.createElement('canvas'); off.width = W; off.height = H; const octx = off.getContext('2d', { willReadFrequently: true });

  let EP, TH, COLORS, BEATS = [];
  // estado das partículas
  const px = new Float32Array(N), py = new Float32Array(N);         // posição atual
  const sx = new Float32Array(N), sy = new Float32Array(N);         // início do morph
  const cx = new Float32Array(N), cy = new Float32Array(N);         // ponto de controle da curva
  const tx = new Float32Array(N), ty = new Float32Array(N);         // destino
  const sa = new Float32Array(N), ta = new Float32Array(N), pa = new Float32Array(N); // alfa
  const dl = new Float32Array(N), sz = new Float32Array(N);         // atraso individual, tamanho
  const sc0 = new Uint8Array(N), tc = new Uint8Array(N);            // cor de origem/destino
  let mStart = 0, mDur = 1;

  // ---------- utilidades ----------
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
  const prog = (t, a, d) => clamp((t - a) / d);
  const fmtNum = (v, dec = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  function hilbert(x, y) { // índice na curva de Hilbert (grade 256×256): vizinhos no espaço => vizinhos na ordem
    x = clamp(x | 0, 0, 255); y = clamp(y | 0, 0, 255); let d = 0;
    for (let s = 128; s > 0; s >>= 1) { const rx = (x & s) ? 1 : 0, ry = (y & s) ? 1 : 0; d += s * s * ((3 * rx) ^ ry); if (!ry) { if (rx) { x = s - 1 - x; y = s - 1 - y; } const t = x; x = y; y = t; } }
    return d;
  }
  const hkey = (x, y) => hilbert(x / W * 256, (y - 200) / (H - 400) * 256);

  // ---------- amostragem ----------
  const cache = {};
  function sample(key, draw, step = 4, color = 0) {
    if (cache[key]) return cache[key];
    octx.setTransform(1, 0, 0, 1, 0, 0); octx.clearRect(0, 0, W, H);
    octx.fillStyle = '#fff'; octx.strokeStyle = '#fff'; octx.globalCompositeOperation = 'source-over';
    draw(octx);
    const d = octx.getImageData(0, 0, W, H).data, pts = [];
    for (let y = 0; y < H; y += step) for (let x = ((y / step) & 1) ? step / 2 : 0; x < W; x += step) if (d[(y * W + x | 0) * 4 + 3] > 110) pts.push({ x, y, c: color });
    return (cache[key] = pts);
  }
  function fitText(c, str, font, size, maxW) { let s = size; c.font = `${font.replace('$', s)}`; while (c.measureText(str).width > maxW && s > 20) { s -= 4; c.font = font.replace('$', s); } return s; }

  // ícones desenhados em vetor (preenchidos em branco), centrados em (x,y), tamanho s
  const ICONS = {
    person(c, x, y, s) { c.beginPath(); c.arc(x, y - .24 * s, .2 * s, 0, 7); c.fill(); c.beginPath(); c.ellipse(x, y + .42 * s, .38 * s, .36 * s, 0, Math.PI, 0); c.closePath(); c.fill(); },
    coin(c, x, y, s) { c.beginPath(); c.arc(x, y, .46 * s, 0, 7); c.fill(); c.globalCompositeOperation = 'destination-out'; c.lineWidth = .05 * s; c.beginPath(); c.arc(x, y, .36 * s, 0, 7); c.stroke(); c.font = `800 ${.5 * s}px Inter`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', x, y + .02 * s); c.globalCompositeOperation = 'source-over'; },
    bag(c, x, y, s) { c.lineWidth = .07 * s; c.beginPath(); c.arc(x, y - .18 * s, .17 * s, Math.PI, 0); c.stroke(); c.beginPath(); c.moveTo(x - .36 * s, y - .18 * s); c.lineTo(x + .36 * s, y - .18 * s); c.lineTo(x + .42 * s, y + .45 * s); c.lineTo(x - .42 * s, y + .45 * s); c.closePath(); c.fill(); },
    cursor(c, x, y, s) { c.beginPath(); c.moveTo(x - .25 * s, y - .45 * s); c.lineTo(x + .3 * s, y + .1 * s); c.lineTo(x + .02 * s, y + .12 * s); c.lineTo(x + .2 * s, y + .45 * s); c.lineTo(x + .08 * s, y + .5 * s); c.lineTo(x - .08 * s, y + .17 * s); c.lineTo(x - .25 * s, y + .33 * s); c.closePath(); c.fill(); },
    search(c, x, y, s) { c.lineWidth = .11 * s; c.beginPath(); c.arc(x - .08 * s, y - .08 * s, .28 * s, 0, 7); c.stroke(); c.lineWidth = .14 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + .14 * s, y + .14 * s); c.lineTo(x + .4 * s, y + .4 * s); c.stroke(); },
    chart(c, x, y, s) { const w = .16 * s; [[-.33, .3], [-.11, .5], [.11, .7], [.33, .95]].forEach(([dx, h]) => c.fillRect(x + dx * s - w / 2, y + .45 * s - h * s * .9, w, h * s * .9)); },
    box(c, x, y, s) { const a = .42 * s; c.beginPath(); c.moveTo(x, y - a); c.lineTo(x + a, y - a / 2); c.lineTo(x, y); c.lineTo(x - a, y - a / 2); c.closePath(); c.fill(); c.beginPath(); c.moveTo(x - a, y - a / 2 + 6); c.lineTo(x - 4, y + 6); c.lineTo(x - 4, y + a); c.lineTo(x - a, y + a / 2); c.closePath(); c.fill(); c.beginPath(); c.moveTo(x + a, y - a / 2 + 6); c.lineTo(x + 4, y + 6); c.lineTo(x + 4, y + a); c.lineTo(x + a, y + a / 2); c.closePath(); c.fill(); },
  };

  // ---------- formas (cada uma devolve pontos e, opcionalmente, um desenho por cima) ----------
  const COL = { white: 0, gold: 1, alert: 2, dim: 3, green: 4 };
  const col = n => COL[n] ?? 0;
  const SHAPES = {
    text(o) { // {text, y, size, font:'inter'|'serif', color, step}
      const y = o.y ?? 960, size = o.size ?? 300, step = o.step ?? 4, font = o.font === 'serif' ? 'italic $px Serif' : '800 $px Inter';
      return { pts: sample(`t|${o.text}|${y}|${size}|${font}|${step}`, c => { fitText(c, o.text, font, size, W - 140); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(o.text, W / 2, y); }, step, col(o.color)) };
    },
    icon(o) { // {name, x, y, size, color}
      const x = o.x ?? W / 2, y = o.y ?? 960, s = o.size ?? 420;
      return { pts: sample(`i|${o.name}|${x}|${y}|${s}`, c => ICONS[o.name](c, x, y, s), o.step ?? Math.max(5, Math.round(s / 65)), col(o.color)) };
    },
    grid(o) { // {name, cols, rows, y, w, h, color, highlight:{count, color, from:'start'|'end'}}
      const cols = o.cols, rows = o.rows, w = o.w ?? 860, h = o.h ?? 760, y0 = (o.y ?? 960) - h / 2, x0 = (W - w) / 2;
      const cw = w / cols, ch = h / rows, s = Math.min(cw, ch) * (o.scale ?? .82), n = o.count ?? cols * rows, pts = [];
      for (let k = 0; k < n; k++) {
        const i = k % cols, j = (k / cols) | 0, inRow = Math.min(cols, n - j * cols), x = x0 + (w - cw * inRow) / 2 + cw * (i + .5), y = y0 + ch * (j + .5);
        const hl = o.highlight && (o.highlight.from === 'end' ? k >= n - o.highlight.count : k < o.highlight.count);
        const c = hl ? col(o.highlight.color) : col(o.color);
        const p = sample(`i|${o.name}|${x | 0}|${y | 0}|${s | 0}`, cc => ICONS[o.name](cc, x, y, s), Math.max(3, Math.round(s / 34)), 0);
        for (const q of p) pts.push({ x: q.x, y: q.y, c, a: hl && o.highlight.color === 'dim' ? .25 : 1 });
      }
      return { pts };
    },
    bars(o, beat) { // {orient:'v'|'h', items:[{label, value, prefix, suffix, dec, color, cut}], y, max}
      const it = o.items, max = o.max ?? Math.max(...it.map(i => i.value)), pts = [], L = [];
      if (o.orient === 'h') {
        const x0 = 150, wmax = 700, bh = 54, gap = 150, y0 = (o.y ?? 960) - (it.length - 1) * gap / 2;
        it.forEach((b, i) => { const y = y0 + i * gap, w = wmax * b.value / max; L.push({ ...b, x: x0, y, w, h: bh, wmax }); rect(pts, x0, y - bh / 2, w, bh, col(b.color ?? (i ? 'gold' : 'white'))); });
      } else {
        const bw = 230, gap = 160, total = it.length * bw + (it.length - 1) * gap, x0 = (W - total) / 2, base = (o.y ?? 960) + 330, hmax = 640;
        it.forEach((b, i) => { const x = x0 + i * (bw + gap), h = hmax * b.value / max; L.push({ ...b, x, base, w: bw, h }); rect(pts, x, base - h, bw, h, col(b.color ?? (i ? 'gold' : 'white'))); });
      }
      return {
        pts, draw(t) {
          L.forEach((b, i) => {
            const p = easeOut(prog(t, .25 + i * .25, 1.0)), v = (b.prefix || '') + fmtNum(b.value * p, b.dec ?? 0) + (b.suffix || '');
            const c = b.color === 'gold' || (b.color == null && i) ? TH.accent : '#fff';
            if (o.orient === 'h') {
              mono(b.label, b.x, b.y - 58, { align: 'left', color: '#fff', size: 24, alpha: prog(t, .1, .4) });
              text(v, b.x + b.w + 24, b.y + 2, { size: 44, align: 'left', alpha: prog(t, .3, .4), color: c, weight: 800, font: 'Inter' });
              if (b.cut) { const a = prog(t, b.cut.at ?? 1, .4); ctx.save(); ctx.globalAlpha *= a; ctx.setLineDash([10, 8]); ctx.strokeStyle = TH.alert; ctx.lineWidth = 3; ctx.strokeRect(b.x + b.w, b.y - b.h / 2, b.wmax * b.cut.value / max, b.h); ctx.restore(); mono(b.cut.label, b.x + b.w + b.wmax * b.cut.value / max / 2, b.y + 70, { color: TH.alert, size: 22, alpha: a }); }
            } else {
              text(v, b.x + b.w / 2, b.base - b.h - 52, { size: 62, alpha: clamp(p * 3), color: c, weight: 800, font: 'Inter', maxW: b.w + 140 });
              mono(b.label, b.x + b.w / 2, b.base + 46, { color: '#fff', size: 24, alpha: prog(t, .1, .4) });
            }
          });
        }
      };
    },
    ring(o) { // {value, max, y, r, label}
      const r = o.r ?? 300, y = o.y ?? 960, f = o.value / o.max, pts = [], rnd = mulberry(17);
      for (let i = 0; i < 1800; i++) { const u = i / 1800, a = -Math.PI * 1.25 + Math.PI * 1.5 * u, rr = r + (rnd() - .5) * 26; pts.push({ x: W / 2 + Math.cos(a) * rr, y: y + Math.sin(a) * rr, c: u <= f ? 1 : 3, a: u <= f ? 1 : .35 }); }
      return { pts };
    },
    dust() { return { pts: [] }; },
    multi(o, beat) { const parts = o.parts.map(p => SHAPES[p.kind](p, beat)); return { pts: parts.flatMap(p => p.pts), draw: t => parts.forEach(p => p.draw && p.draw(t)) }; },
  };
  function rect(pts, x, y, w, h, c, step = 7) { for (let yy = y; yy < y + h; yy += step) for (let xx = x + ((yy / step) & 1) * step / 2; xx < x + w; xx += step) pts.push({ x: xx, y: yy, c }); }

  // ---------- morph ----------
  function dustPoint(i, T) { const r = mulberry(i * 7919 + 13); return { x: r() * W, y: 160 + r() * (H - 320) }; }
  function morphTo(pts, T, opt = {}) {
    // limita pontos ao orçamento, sem buracos (amostragem uniforme)
    const cap = Math.floor(N * (opt.density ?? .88));
    let use = pts;
    if (pts.length > cap) { use = []; const k = pts.length / cap; for (let i = 0; i < cap; i++) use.push(pts[Math.floor(i * k)]); }
    const targets = use.map(p => ({ x: p.x, y: p.y, c: p.c ?? 0, a: p.a ?? 1 }));
    for (let i = targets.length; i < N; i++) { const d = dustPoint(i); targets.push({ x: d.x, y: d.y, c: 3, a: .09, dust: 1 }); }
    // pareamento espacial coerente: partículas e destinos ordenados pela mesma curva de Hilbert
    const pi = Array.from({ length: N }, (_, i) => i).sort((a, b) => hkey(px[a], py[a]) - hkey(px[b], py[b]));
    targets.forEach(t => t.h = hkey(t.x, t.y)); targets.sort((a, b) => a.h - b.h);
    const via = opt.via || 'flow', rnd = mulberry(Math.round(T * 1000) + 5);
    const stagger = opt.stagger ?? .35;
    for (let k = 0; k < N; k++) {
      const i = pi[k], t = targets[k];
      sx[i] = px[i]; sy[i] = py[i]; sa[i] = pa[i]; sc0[i] = tc[i];
      tx[i] = t.x; ty[i] = t.y; ta[i] = t.a; tc[i] = t.c;
      if (via === 'burst') { const d = dustPoint(i * 3 + k); cx[i] = d.x; cy[i] = d.y; }
      else if (typeof via === 'object') { cx[i] = via.x + (rnd() - .5) * 60; cy[i] = via.y + (rnd() - .5) * 60; }
      else { const mx = (sx[i] + tx[i]) / 2, my = (sy[i] + ty[i]) / 2, dx = tx[i] - sx[i], dy = ty[i] - sy[i], len = Math.hypot(dx, dy) || 1, bend = (rnd() - .5) * Math.min(260, len * .6); cx[i] = mx - dy / len * bend; cy[i] = my + dx / len * bend; }
      dl[i] = (k / N) * stagger + rnd() * .08;
    }
    mStart = T; mDur = opt.dur ?? .9;
  }
  function stepParticles(T) {
    for (let i = 0; i < N; i++) {
      const u = clamp((T - mStart - dl[i]) / mDur), e = ease(u), m = 1 - e;
      let x = m * m * sx[i] + 2 * m * e * cx[i] + e * e * tx[i], y = m * m * sy[i] + 2 * m * e * cy[i] + e * e * ty[i];
      const br = ta[i] < .2 ? 26 : 1.1; // poeira passeia; forma "respira"
      x += Math.sin(T * (ta[i] < .2 ? .35 : 2.1) + i * 1.7) * br; y += Math.cos(T * (ta[i] < .2 ? .3 : 1.8) + i * 2.3) * br;
      px[i] = x; py[i] = y; pa[i] = sa[i] + (ta[i] - sa[i]) * e;
      if (u > .5) sc0[i] = tc[i];
    }
  }
  function drawParticles(T) {
    gctx.clearRect(0, 0, W, H);
    for (let c = 0; c < COLORS.length; c++) {
      gctx.fillStyle = COLORS[c];
      for (let i = 0; i < N; i++) {
        if (sc0[i] !== c || pa[i] < .02) continue;
        gctx.globalAlpha = clamp(pa[i] * (.72 + .28 * Math.sin(T * 5 + i * 3.7))); const s = sz[i];
        gctx.fillRect(px[i] - s / 2, py[i] - s / 2, s, s);
      }
    }
    gctx.globalAlpha = 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(6px)'; ctx.globalAlpha = .75; ctx.drawImage(glow, 0, 0);
    ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.drawImage(glow, 0, 0); ctx.restore();
  }

  // ---------- tipografia ----------
  function text(str, x, y, o = {}) {
    const a = o.alpha ?? 1; if (a <= .001 || !str) return;
    ctx.save(); ctx.globalAlpha *= clamp(a);
    const fam = o.font || 'Inter', w = o.weight ?? 800, it = o.italic ? 'italic ' : '';
    let s = o.size || 60; const f = z => `${it}${w} ${z}px ${fam}`; ctx.font = f(s);
    if (o.spacing) ctx.letterSpacing = o.spacing + 'px';
    const maxW = o.maxW ?? W - 110; while (ctx.measureText(str).width > maxW && s > 14) { s -= 2; ctx.font = f(s); }
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    if (o.glitch) { const j = o.glitch; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,40,60,.9)'; ctx.fillText(str, x + j, y); ctx.fillStyle = 'rgba(40,230,255,.9)'; ctx.fillText(str, x - j, y + j * .3); ctx.globalCompositeOperation = 'source-over'; }
    ctx.fillStyle = o.color || '#fff'; if (o.glowC) { ctx.shadowColor = o.glowC; ctx.shadowBlur = 28; }
    ctx.fillText(str, x, y); ctx.restore();
  }
  const mono = (s, x, y, o = {}) => text(s, x, y, { font: 'Plex', weight: o.weight ?? 600, size: o.size ?? 24, color: o.color ?? TH.dim, spacing: o.spacing ?? 5, ...o });
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function chip(str, y, a, color) { if (!str || a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.font = '600 20px Plex'; ctx.letterSpacing = '4px'; const w = ctx.measureText(str).width + 40; rr(W / 2 - w / 2, y - 20, w, 40, 20); ctx.strokeStyle = color || 'rgba(255,255,255,.22)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = color || TH.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(str, W / 2, y + 1); ctx.restore(); }
  function reticle(x, y, size, t, label) {
    const p = easeOut(t), s = size * (1.7 - .7 * p), a = clamp(t * 3); if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = TH.alert; ctx.lineWidth = 4; ctx.shadowColor = TH.alert; ctx.shadowBlur = 16; const L = s * .26;
    for (const [qx, qy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.beginPath(); ctx.moveTo(x + qx * s / 2, y + qy * (s / 2 - L)); ctx.lineTo(x + qx * s / 2, y + qy * s / 2); ctx.lineTo(x + qx * (s / 2 - L), y + qy * s / 2); ctx.stroke(); }
    ctx.restore(); if (label) mono(label, x, y + s / 2 + 36, { color: TH.alert, alpha: prog(t, .8, .3) });
  }
  function followCard(t) {
    const a = easeOut(prog(t, 0, .5)), y = 1250 + (1 - a) * 40, w = 760, h = 132, x = (W - w) / 2; if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; rr(x, y, w, h, 28); ctx.fillStyle = 'rgba(22,22,26,.92)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(x + 70, y + h / 2, 42, 0, 7); ctx.fillStyle = TH.accent; ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = '800 40px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((EP.name || 'S')[0], x + 70, y + h / 2 + 2);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '700 36px Inter'; ctx.fillText(EP.handle, x + 130, y + 50);
    ctx.fillStyle = TH.dim; ctx.font = '500 26px Inter'; ctx.fillText(EP.name || '', x + 130, y + 90);
    const on = t > 1.1, bw = on ? 210 : 170, bx = x + w - bw - 26, by = y + h / 2 - 32;
    rr(bx, by, bw, 64, 32); ctx.fillStyle = on ? 'rgba(255,255,255,.12)' : TH.accent; ctx.fill();
    ctx.fillStyle = on ? '#fff' : '#111'; ctx.font = '700 28px Inter'; ctx.textAlign = 'center'; ctx.fillText(on ? 'Seguindo ✓' : 'Seguir', bx + bw / 2, by + 34);
    if (t > .8 && t < 1.5) { const r = (t - .8) / .7; ctx.beginPath(); ctx.arc(bx + bw / 2, by + 32, 20 + r * 70, 0, 7); ctx.strokeStyle = `rgba(255,255,255,${.6 * (1 - r)})`; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.restore();
  }

  // ---------- legenda karaokê ----------
  function karaoke(sc, T) {
    if (!sc.vo || EP.subtitles === false) return;
    const lt = T - sc.start - sc.voStart; if (lt < -.1 || lt > sc.voDur + .3) return;
    if (!sc._words) { // tempo de cada palavra proporcional ao nº de vogais (≈ sílabas), com peso extra na pontuação
      const ws = sc.vo.split(/\s+/), wt = ws.map(w => Math.max(1, (w.match(/[aeiouáéíóúâêôãõà]/gi) || []).length) + (/[.,:?!]$/.test(w) ? 1.6 : 0));
      const tot = wt.reduce((a, b) => a + b, 0); let acc = 0;
      sc._words = ws.map((w, i) => { const st = acc / tot * sc.voDur; acc += wt[i]; return { w, st }; });
      const ch = []; let cur = [];
      sc._words.forEach((w, i) => { cur.push(w); if (cur.length >= 6 || /[.?!:]$/.test(w.w) || (cur.length >= 4 && /,$/.test(w.w))) { ch.push(cur); cur = []; } });
      if (cur.length) ch.push(cur); sc._chunks = ch;
    }
    let chunk = sc._chunks[0]; for (const c of sc._chunks) if (lt >= c[0].st - .05) chunk = c;
    ctx.save(); ctx.font = '700 44px Inter'; ctx.letterSpacing = '0px';
    const full = chunk.map(w => w.w).join(' '), lines = wrap(full, 860);
    const lh = 58, bh = lines.length * lh + 34, by = 1600 - bh / 2, bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 56;
    rr(W / 2 - bw / 2, by, bw, bh, 20); ctx.fillStyle = 'rgba(16,18,16,.78)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    let wi = 0;
    lines.forEach((ln, li) => {
      const ws = ln.split(' '); let x = W / 2 - ctx.measureText(ln).width / 2; const y = by + 17 + lh * li + lh / 2;
      ws.forEach(w => { const said = lt >= chunk[wi].st; ctx.fillStyle = said ? '#fff' : 'rgba(255,255,255,.38)'; if (said && EP.accentWords && EP.accentWords.includes(w.replace(/[.,:?!]/g, '').toLowerCase())) ctx.fillStyle = TH.accent; ctx.fillText(w, x, y); x += ctx.measureText(w + ' ').width; wi++; });
    });
    ctx.restore();
  }
  function wrap(str, maxW) { const ws = str.split(' '), out = []; let l = ''; for (const w of ws) { const t = l ? l + ' ' + w : w; if (ctx.measureText(t).width > maxW && l) { out.push(l); l = w; } else l = t; } out.push(l); return out; }

  // ---------- linha do tempo ----------
  function build() {
    BEATS = [];
    EP.scenes.forEach(sc => (sc.beats || []).forEach((b, k) => {
      const abs = sc.start + (k === 0 && !b.at ? 0 : sc.voStart + (b.at || 0));
      BEATS.push({ ...b, sc, abs });
    }));
    BEATS.sort((a, b) => a.abs - b.abs);
    BEATS.forEach((b, i) => { b.end = i + 1 < BEATS.length ? BEATS[i + 1].abs : EP.duration; b.shapeObj = SHAPES[(b.shape || { kind: 'dust' }).kind](b.shape || {}, b); });
  }
  let last = -1, curBeat = -1;
  function frame(i) {
    if (i !== last + 1) throw new Error('quadros precisam ser sequenciais'); last = i;
    const T = i / FPS;
    let bi = curBeat; while (bi + 1 < BEATS.length && T >= BEATS[bi + 1].abs) bi++;
    if (bi !== curBeat) { curBeat = bi; const b = BEATS[bi]; morphTo(b.shapeObj.pts, T, { via: b.via, dur: b.dur, stagger: b.stagger, density: b.density }); }
    const b = BEATS[curBeat], bt = T - b.abs, sc = b.sc;
    stepParticles(T);
    // fundo
    const g = ctx.createRadialGradient(W / 2, H * .45, 60, W / 2, H * .45, H * .8); g.addColorStop(0, TH.bg2); g.addColorStop(1, TH.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawParticles(T);
    // cabeçalho
    mono(EP.header || '', W / 2, 96, { size: 21, spacing: 6, alpha: .75 });
    ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = '#fff'; ctx.fillRect(90, 128, W - 180, 1); ctx.restore();
    // título/sub/legenda da batida (glitch quando o título muda)
    const prev = BEATS[curBeat - 1], changed = !prev || prev.title !== b.title;
    const tA = changed ? easeOut(prog(bt, 0, .3)) : 1, gl = (changed && bt < .28 && b.glitch !== false) ? (8 * (1 - bt / .28)) * (Math.sin(T * 90) > 0 ? 1 : -1) : 0;
    if (b.serif) text(b.title, W / 2, 300, { font: 'Serif', italic: true, weight: 400, size: 120, alpha: tA, glitch: gl });
    else text(b.title, W / 2, 290, { size: 74, alpha: tA, glitch: gl, maxW: W - 120 });
    if (b.sub != null) {
      let s = b.sub;
      if (typeof s === 'object') { const p = easeOut(prog(bt, s.delay ?? 0, s.dur ?? 1)); s = (s.prefix || '') + fmtNum(s.from + (s.to - s.from) * p, s.dec ?? 0) + (s.suffix || ''); }
      text(s, W / 2, 382, { font: 'Plex', weight: 600, size: 54, color: b.subColor === 'alert' ? TH.alert : b.subColor === 'gold' ? TH.accent : '#fff', alpha: tA });
    }
    mono(b.caption || '', W / 2, 446, { size: 20, alpha: tA * .9 });
    if (prev && prev.shapeObj.draw && bt < .35) { ctx.save(); ctx.globalAlpha = 1 - bt / .35; prev.shapeObj.draw(T - prev.abs); ctx.restore(); }
    if (b.shapeObj.draw) { ctx.save(); ctx.globalAlpha = easeOut(prog(bt, .1, .35)); b.shapeObj.draw(bt); ctx.restore(); }
    if (b.lock) reticle(b.lock.x ?? W / 2, b.lock.y ?? 960, b.lock.size ?? 420, prog(bt, b.lock.at ?? .4, .5), b.lock.label);
    if (b.card) followCard(bt - (b.card.at ?? 0));
    chip(b.source, 1440, tA * .95);
    karaoke(sc, T);
    // fade de entrada/saída do vídeo
    if (T < .25) { ctx.fillStyle = `rgba(0,0,0,${1 - T / .25})`; ctx.fillRect(0, 0, W, H); }
    const e = EP.duration - T; if (e < .5) { ctx.fillStyle = `rgba(0,0,0,${1 - e / .5})`; ctx.fillRect(0, 0, W, H); }
    return canvas.toDataURL('image/jpeg', .93);
  }

  async function init(ep) {
    EP = ep; TH = { bg: '#030304', bg2: '#0d0d10', accent: '#f0b90b', alert: '#ff3344', dim: '#8b909c', green: '#b5f23d', ...(ep.theme || {}) };
    COLORS = ['#f4f1e8', TH.accent, TH.alert, '#8f96a6', TH.green];
    await Promise.all(['800 60px Inter', '700 40px Inter', '500 30px Inter', '600 24px Plex', 'italic 400 100px Serif'].map(f => document.fonts.load(f)));
    const r = mulberry(99);
    for (let i = 0; i < N; i++) { const d = dustPoint(i); px[i] = sx[i] = tx[i] = cx[i] = d.x; py[i] = sy[i] = ty[i] = cy[i] = d.y; pa[i] = sa[i] = ta[i] = .09; sc0[i] = tc[i] = 3; sz[i] = 1.5 + r() * 2.1; }
    build();
    return { frames: Math.ceil(ep.duration * FPS), fps: FPS };
  }
  window.ENGINE = { init, frame };
})();
