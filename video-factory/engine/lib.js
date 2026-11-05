/* Motor de cenas "partículas investigativas" — roda dentro do Chromium.
 * O render.js chama init(episode) uma vez e depois frame(i) para cada quadro.
 * Tudo é determinístico: mesmo episode.json => mesmo vídeo. */
(() => {
  const W = 1080, H = 1920, FPS = 30;
  const N = 5200;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const glow = document.createElement('canvas'); glow.width = W; glow.height = H;
  const gctx = glow.getContext('2d');
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const octx = off.getContext('2d', { willReadFrequently: true });

  let EP, THEME, COLORS;
  const px = new Float32Array(N), py = new Float32Array(N);
  const tx = new Float32Array(N), ty = new Float32Array(N);
  const pa = new Float32Array(N), ta = new Float32Array(N);
  const pc = new Uint8Array(N), hx = new Float32Array(N), hy = new Float32Array(N);
  const ps = new Float32Array(N);

  // ---------- utilidades ----------
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = t => 1 - Math.pow(1 - clamp(t), 3);
  const prog = (t, a, d) => clamp((t - a) / d);
  const fmt = (v, dec, suf = '') => v.toFixed(dec).replace('.', ',') + suf;

  function shuffle(arr, seed) { const r = mulberry(seed); for (let i = arr.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

  // ---------- amostragem de pontos ----------
  const cache = {};
  function samplePixels(key, drawFn, step = 4, color = 0) {
    if (cache[key]) return cache[key];
    octx.clearRect(0, 0, W, H); octx.fillStyle = '#fff'; octx.strokeStyle = '#fff';
    drawFn(octx);
    const d = octx.getImageData(0, 0, W, H).data, pts = [];
    for (let y = 0; y < H; y += step) for (let x = (y / step) % 2 ? step / 2 : 0; x < W; x += step) {
      if (d[(y * W + x) * 4 + 3] > 110) pts.push({ x, y, c: color });
    }
    return (cache[key] = shuffle(pts, key.length * 977));
  }
  function textPoints(text, { x = W / 2, y = H / 2, size = 400, maxW = W - 120, font = 'Anton', color = 0, step = 5 } = {}) {
    return samplePixels(`t|${text}|${x}|${y}|${size}|${font}|${color}|${step}`, c => {
      let s = size; c.font = `${s}px ${font}`;
      while (c.measureText(text).width > maxW && s > 20) { s -= 4; c.font = `${s}px ${font}`; }
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y);
    }, step, color);
  }
  function rectPoints(x, y, w, h, color = 0, step = 7) {
    const pts = [];
    for (let yy = y + h; yy > y; yy -= step) for (let xx = x; xx < x + w; xx += step) pts.push({ x: xx + (Math.sin(xx * 7.1 + yy) * 1.5), y: yy, c: color });
    return pts; // de baixo para cima (para "encher" a barra)
  }
  function ringPoints(cx, cy, r, thick, n, color = 0, a0 = -Math.PI * 1.25, a1 = Math.PI * .25) {
    const pts = [], rnd = mulberry(r * 13 + n);
    for (let i = 0; i < n; i++) { const f = i / n, a = a0 + (a1 - a0) * f, rr = r + (rnd() - .5) * thick; pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr, c: color, f }); }
    return pts;
  }
  function spiralPoints(cx, cy, n, t, color = 1) {
    const pts = [];
    for (let i = 0; i < n; i++) { const f = i / n, a = f * 26 + t * 1.6, r = 30 + f * 420; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * .9, c: i % 5 ? color : 0 }); }
    return pts;
  }

  // ---------- partículas ----------
  function initParticles() {
    const r = mulberry(7);
    for (let i = 0; i < N; i++) {
      hx[i] = r() * W; hy[i] = r() * H; px[i] = hx[i]; py[i] = hy[i];
      pa[i] = 0; ta[i] = .12; pc[i] = 3; ps[i] = 1.6 + r() * 2.2;
    }
  }
  function assign(pointSets, alpha = 1) {
    let k = 0;
    for (const pts of pointSets) for (const p of pts) {
      if (k >= N) break;
      tx[k] = p.x; ty[k] = p.y; pc[k] = p.c ?? 0; ta[k] = p.a ?? alpha; k++;
    }
    for (; k < N; k++) { tx[k] = hx[k]; ty[k] = hy[k]; pc[k] = 3; ta[k] = .10; }
  }
  function stepParticles(T, k = .085) {
    for (let i = 0; i < N; i++) {
      const jx = Math.sin(T * 1.3 + i * 12.9898) * 1.2, jy = Math.cos(T * 1.1 + i * 78.233) * 1.2;
      let gx = tx[i], gy = ty[i];
      if (pc[i] === 3) { gx += Math.sin(T * .3 + i) * 40; gy += Math.cos(T * .25 + i * .7) * 40; }
      px[i] += (gx - px[i]) * k + jx; py[i] += (gy - py[i]) * k + jy;
      pa[i] += (ta[i] - pa[i]) * .12;
    }
  }
  function drawParticles(T) {
    gctx.clearRect(0, 0, W, H);
    for (let c = 0; c < COLORS.length; c++) {
      gctx.fillStyle = COLORS[c];
      for (let i = 0; i < N; i++) {
        if (pc[i] !== c || pa[i] < .02) continue;
        const tw = .75 + .25 * Math.sin(T * 6 + i * 3.7);
        gctx.globalAlpha = clamp(pa[i] * tw); const s = ps[i];
        gctx.fillRect(px[i] - s / 2, py[i] - s / 2, s, s);
      }
    }
    gctx.globalAlpha = 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'blur(7px)'; ctx.globalAlpha = .9; ctx.drawImage(glow, 0, 0);
    ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.drawImage(glow, 0, 0);
    ctx.restore();
  }

  // ---------- HUD / tipografia ----------
  function text(str, x, y, { size = 60, font = 'Anton', color = '#fff', align = 'center', alpha = 1, weight = '', maxW = W - 100, spacing = 0, glowC = null } = {}) {
    if (alpha <= 0.001) return;
    ctx.save(); ctx.globalAlpha = clamp(alpha);
    let s = size; ctx.font = `${weight} ${s}px ${font}`;
    if (spacing) ctx.letterSpacing = spacing + 'px';
    while (ctx.measureText(str).width > maxW && s > 14) { s -= 2; ctx.font = `${weight} ${s}px ${font}`; }
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    if (glowC) { ctx.shadowColor = glowC; ctx.shadowBlur = 30; }
    ctx.fillText(str, x, y); ctx.restore();
  }
  const mono = (s, x, y, o = {}) => text(s, x, y, { font: 'Plex', weight: o.weight || 600, size: o.size || 30, color: o.color || THEME.dim, spacing: o.spacing ?? 6, ...o });
  function chip(str, x, y, { color, alpha = 1, size = 28 } = {}) {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.font = `600 ${size}px Plex`; ctx.letterSpacing = '4px';
    const w = ctx.measureText(str).width + 44, h = size + 26;
    ctx.strokeStyle = color || THEME.accent; ctx.lineWidth = 2; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = color || THEME.accent; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(str, x, y + 1);
    ctx.restore();
  }
  function reticle(x, y, size, t, label) {
    const p = easeOut(t), s = size * (1.8 - .8 * p), a = clamp(t * 3);
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = THEME.alert; ctx.lineWidth = 4; ctx.shadowColor = THEME.alert; ctx.shadowBlur = 18;
    const L = s * .28;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath(); ctx.moveTo(x + sx * s / 2, y + sy * (s / 2 - L)); ctx.lineTo(x + sx * s / 2, y + sy * s / 2); ctx.lineTo(x + sx * (s / 2 - L), y + sy * s / 2); ctx.stroke();
    }
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 18, y); ctx.lineTo(x + 18, y); ctx.moveTo(x, y - 18); ctx.lineTo(x, y + 18); ctx.stroke();
    ctx.restore();
    if (label && p > .95) mono(label, x, y + s / 2 + 40, { color: THEME.alert, size: 26, alpha: clamp((t - .9) * 8) });
  }
  function hud(T, sc) {
    // topo: série · episódio
    mono(EP.series || '', W / 2, 92, { size: 26, color: THEME.dim, spacing: 10 });
    ctx.save(); ctx.strokeStyle = THEME.dim; ctx.globalAlpha = .45; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(90, 130); ctx.lineTo(W - 90, 130); ctx.stroke(); ctx.restore();
    // cantos com coordenadas "vivas"
    const cx = String(1000 + ((T * 977) % 8999 | 0)).padStart(4, '0'), cy = String(1000 + ((T * 613) % 8999 | 0)).padStart(4, '0');
    mono(`X ${cx} · Y ${cy}`, 90, 170, { align: 'left', size: 20, spacing: 3, alpha: .55 });
    mono(`${String(sc.index + 1).padStart(2, '0')} / ${String(EP.scenes.length).padStart(2, '0')}`, W - 90, 170, { align: 'right', size: 20, spacing: 3, alpha: .55 });
    // rodapé
    mono(EP.handle || '', W / 2, H - 120, { size: 24, color: THEME.dim, spacing: 8, alpha: .8 });
    if (EP.sources) mono(EP.sources, W / 2, H - 80, { size: 18, color: THEME.dim, spacing: 4, alpha: .5 });
  }
  function subtitles(sc, t) {
    if (!sc.vo || !EP.subtitles) return;
    const words = sc.vo.split(/\s+/), chunks = [];
    for (let i = 0; i < words.length; i += 5) chunks.push(words.slice(i, i + 5).join(' '));
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const lt = t - sc.voStart; if (lt < 0 || lt > sc.voDur + .2) return;
    let acc = 0, cur = chunks[chunks.length - 1];
    for (const c of chunks) { acc += c.length / total * sc.voDur; if (lt <= acc) { cur = c; break; } }
    ctx.save(); ctx.font = '800 50px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(ctx.measureText(cur).width, W - 120);
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(W / 2 - w / 2 - 24, 1618 - 42, w + 48, 84);
    ctx.fillStyle = '#fff'; ctx.fillText(cur, W / 2, 1620, W - 120); ctx.restore();
  }

  // ---------- tipos de cena ----------
  // Cada tipo: points(sc, t) -> lista de conjuntos de pontos ; draw(sc, t) -> sobreposição
  const C = { white: 0, gold: 1, alert: 2 };
  const TYPES = {
    hook: {
      points(sc, t) {
        const glyph = textPoints(sc.glyph || '$', { y: 1010, size: 900, color: C.gold, step: 6 });
        const n = Math.floor(glyph.length * easeOut(t / 1.4));
        return [glyph.slice(0, n)];
      },
      draw(sc, t) {
        const a = prog(t, .2, .5);
        mono(sc.kicker || '', W / 2, 290, { color: THEME.accent, alpha: a, spacing: 14 });
        text(sc.title[0], W / 2, 400, { size: 150, alpha: a, spacing: 2 });
        if (sc.title[1]) text(sc.title[1], W / 2, 545, { size: 150, alpha: prog(t, .35, .5), spacing: 2 });
        if (sc.lock) reticle(sc.lock.x, sc.lock.y, 260, prog(t, sc.lock.at ?? 1.4, .7), sc.lock.label);
        (sc.tags || []).forEach((g, i) => chip(g, W / 2, 1420 + i * 78, { alpha: prog(t, 1 + i * .3, .4), color: i ? THEME.dim : THEME.accent, size: 24 }));
      }
    },
    headline: {
      points(sc, t) {
        const big = textPoints(sc.big, { y: 940, size: 520, color: C.gold, step: 5 });
        return [big.slice(0, Math.floor(big.length * easeOut(t / 1.1)))];
      },
      draw(sc, t) {
        text(sc.top, W / 2, 560, { size: 110, alpha: prog(t, .1, .4) });
        text(sc.bottom, W / 2, 1310, { size: 110, alpha: prog(t, .5, .4), color: THEME.accent });
        (sc.chips || []).forEach((g, i) => chip(g, W / 2, 1440 + i * 76, { alpha: prog(t, 1.2 + i * .35, .4), size: 24, color: THEME.dim }));
      }
    },
    bars: {
      layout(sc) {
        const n = sc.items.length, bw = 250, gap = 140, total = n * bw + (n - 1) * gap, x0 = (W - total) / 2;
        const max = Math.max(...sc.items.map(i => i.value)), base = 1300, hmax = 700;
        return sc.items.map((it, i) => ({ ...it, x: x0 + i * (bw + gap), w: bw, h: hmax * it.value / max, base, max }));
      },
      points(sc, t) {
        const L = this.layout(sc), area = L.reduce((a, b) => a + b.w * b.h, 0);
        const step = Math.max(6, Math.ceil(Math.sqrt(area / (N * .85))));
        return L.map((b, i) => {
          const pts = rectPoints(b.x, b.base - b.h, b.w, b.h, C[b.color] ?? (i ? C.gold : C.white), step);
          const p = easeOut(prog(t, b.at ?? (.3 + i * .45), 1.1));
          return pts.slice(0, Math.floor(pts.length * p));
        });
      },
      draw(sc, t) {
        mono(sc.caption || '', W / 2, 330, { color: THEME.accent, spacing: 10, alpha: prog(t, 0, .4) });
        if (sc.headline) text(sc.headline, W / 2, 430, { size: 96, alpha: prog(t, .1, .4) });
        this.layout(sc).forEach((b, i) => {
          const st = b.at ?? (.3 + i * .45), p = easeOut(prog(t, st, 1.1)), cx = b.x + b.w / 2;
          const val = b.value * p;
          text(b.prefix ? b.prefix + fmt(val, b.dec ?? 0) : fmt(val, b.dec ?? 0, b.suffix || ''), cx, b.base - b.h * p - 60, { size: 84, alpha: clamp(p * 4), color: i ? THEME.accent : '#fff' });
          mono(b.label, cx, b.base + 50, { color: '#fff', size: 28, alpha: prog(t, st - .1, .4) });
          if (b.sub) mono(b.sub, cx, b.base + 92, { size: 22, alpha: prog(t, st + .1, .4) });
        });
        if (sc.winner != null) {
          const b = this.layout(sc)[sc.winner];
          reticle(b.x + b.w / 2, b.base - b.h / 2, b.w + 90, prog(t, sc.winnerAt ?? 2.4, .6), sc.winnerLabel);
        }
        (sc.chips || []).forEach((g, i) => chip(g, W / 2, 1480 + i * 70, { alpha: prog(t, (sc.chipsAt ?? 2.6) + i * .3, .4), size: 22, color: THEME.dim }));
      }
    },
    equation: {
      points(sc, t) {
        const ring = ringPoints(W / 2, 1050, 300, 26, 1500, C.white);
        const v = 1 + (sc.dial.max - 1) * ease(prog(t, sc.dial.at ?? 1.2, sc.dial.sweep ?? 2.2));
        const f = (v - 1) / (sc.dial.max - 1);
        return [ring.map(p => p.f <= f ? { ...p, c: C.gold, a: 1 } : { ...p, a: .35 })];
      },
      draw(sc, t) {
        const terms = sc.terms, xs = [190, 360, 540, 700, 900];
        terms.forEach((s, i) => text(s, xs[i] ?? W / 2, 470, { size: i % 2 ? 80 : 74, alpha: prog(t, i * .18, .35), color: i === 2 ? THEME.accent : '#fff', maxW: 300 }));
        mono(sc.caption || '', W / 2, 330, { color: THEME.accent, spacing: 10, alpha: prog(t, 0, .4) });
        const v = 1 + (sc.dial.max - 1) * ease(prog(t, sc.dial.at ?? 1.2, sc.dial.sweep ?? 2.2));
        text(String(Math.round(v)), W / 2, 1050, { size: 260, alpha: prog(t, .9, .4), color: THEME.accent });
        mono(sc.dial.label || '', W / 2, 1230, { size: 24, alpha: prog(t, .9, .4) });
        mono('1', W / 2 - 230, 1300, { size: 26, alpha: .7 }); mono(String(sc.dial.max), W / 2 + 230, 1300, { size: 26, alpha: .7 });
        (sc.chips || []).forEach((g, i) => chip(g, W / 2, 1450 + i * 70, { alpha: prog(t, 2.2 + i * .3, .4), size: 22, color: THEME.dim }));
      }
    },
    price: {
      points(sc, t) {
        const res = textPoints(sc.result, { y: 900, size: 380, color: C.gold, step: 5 });
        const sw = sc.compareAt ?? 3.2;
        if (t < sw) return [res.slice(0, Math.floor(res.length * easeOut(prog(t, .9, 1))))];
        const full = 820, wB = full * sc.compare.to / sc.compare.from;
        const a = rectPoints(130, 1160, full, 70, C.white, 6), b = rectPoints(130, 1330, wB, 70, C.gold, 6);
        const p = easeOut(prog(t, sw, .9));
        return [a.slice(0, a.length * p | 0), b.slice(0, b.length * p | 0)];
      },
      draw(sc, t) {
        mono(sc.caption || '', W / 2, 330, { color: THEME.accent, spacing: 10, alpha: prog(t, 0, .4) });
        text(sc.formula, W / 2, 470, { size: 92, alpha: prog(t, .2, .4) });
        const sw = sc.compareAt ?? 3.2;
        if (t >= sw) {
          const p = prog(t, sw, .6);
          mono(sc.compare.labelFrom, 130, 1125, { align: 'left', color: '#fff', size: 26, alpha: p });
          mono(sc.compare.labelTo, 130, 1295, { align: 'left', color: THEME.accent, size: 26, alpha: p });
          text(sc.compare.delta, W / 2, 1530, { size: 150, color: THEME.alert, alpha: prog(t, sw + .8, .4), glowC: THEME.alert });
        }
        if (t < sw) (sc.chips || []).forEach((g, i) => chip(g, W / 2, 1180 + i * 70, { alpha: prog(t, 1.4 + i * .3, .4), size: 22, color: THEME.dim }));
      }
    },
    outro: {
      points(sc, t) {
        const end = sc.spiralAt ?? sc.dur - 1.6;
        if (t > end) return [spiralPoints(W / 2, 960, 2600, t - end)];
        const l1 = textPoints(sc.lines[0], { y: 820, size: 220, color: C.white, step: 7 });
        const l2 = textPoints(sc.lines[1] || '', { y: 1080, size: 220, color: C.gold, step: 7 });
        return [l1.slice(0, l1.length * easeOut(t / .9) | 0), l2.slice(0, l2.length * easeOut(prog(t, .4, .9)) | 0)];
      },
      draw(sc, t) {
        const end = sc.spiralAt ?? sc.dur - 1.6;
        if (t > end) {
          text(EP.handle, W / 2, 960, { size: 90, alpha: prog(t, end + .3, .5), glowC: THEME.accent });
          mono(sc.cta || '', W / 2, 1460, { color: THEME.accent, alpha: prog(t, end + .3, .5), spacing: 8, size: 26 });
        }
      }
    }
  };

  // ---------- linha do tempo ----------
  let lastFrame = -1;
  function sceneAt(T) { for (const s of EP.scenes) if (T < s.start + s.dur) return s; return EP.scenes[EP.scenes.length - 1]; }
  function frame(i) {
    if (i !== lastFrame + 1) throw new Error('frames precisam ser sequenciais');
    lastFrame = i;
    const T = i / FPS, sc = sceneAt(T), t = T - sc.start, type = TYPES[sc.type];
    assign(type.points(sc, t));
    stepParticles(T);
    // fundo
    const g = ctx.createRadialGradient(W / 2, H * .48, 50, W / 2, H * .48, H * .75);
    g.addColorStop(0, THEME.bg2); g.addColorStop(1, THEME.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    drawParticles(T);
    // fade de entrada/saída da sobreposição
    ctx.save(); ctx.globalAlpha = clamp(Math.min(t / .25, (sc.dur - t) / .2));
    type.draw(sc, t);
    ctx.restore();
    hud(T, sc); subtitles(sc, t);
    // flash de corte
    if (t < .12 && sc.index > 0) { ctx.fillStyle = `rgba(255,255,255,${.10 * (1 - t / .12)})`; ctx.fillRect(0, 0, W, H); }
    // fade final
    const endT = EP.duration - T; if (endT < .6) { ctx.fillStyle = `rgba(0,0,0,${1 - endT / .6})`; ctx.fillRect(0, 0, W, H); }
    return canvas.toDataURL('image/jpeg', .93);
  }

  async function init(ep) {
    EP = ep; THEME = { bg: '#020203', bg2: '#0b0b10', accent: '#f0b90b', alert: '#ff2e3c', dim: '#8a8f9c', ...(ep.theme || {}) };
    COLORS = ['#ffffff', THEME.accent, THEME.alert, '#7d8597'];
    await Promise.all(['100px Anton', '600 30px Plex', '400 30px Plex', '800 50px Inter', '600 50px Inter'].map(f => document.fonts.load(f)));
    initParticles();
    return { frames: Math.ceil(ep.duration * FPS), fps: FPS };
  }
  window.ENGINE = { init, frame };
})();
