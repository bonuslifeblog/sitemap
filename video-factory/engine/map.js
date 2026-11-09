/* Camada de mapa-múndi em pontos, com câmera que voa entre regiões.
 * Batida com "camera": {lon, lat, zoom} liga o mapa; "highlight": [países] acende países;
 * "pins": [{lon, lat, label, value, at, color}] e "arc": {from:[lon,lat], to:[lon,lat], at}. */
(() => {
  const W = 1080, H = 1920;
  const U = () => window.ENGINE_UTIL;
  const LODS = [1.6, 0.8, 0.4, 0.2];           // espaçamento dos pontos em graus
  let grids = [], names = [], ready = false;
  const merc = lat => 180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const layer = document.createElement('canvas'); layer.width = W; layer.height = H; const lctx = layer.getContext('2d');

  function load(topo) {
    const fc = topojson.feature(topo, topo.objects.countries);
    names = fc.features.map(f => f.properties.name);
    const RW = 4096, RH = 2048, c = document.createElement('canvas'); c.width = RW; c.height = RH;
    const g = c.getContext('2d', { willReadFrequently: true });
    fc.features.forEach((f, i) => {
      g.fillStyle = `rgb(${(i + 1) & 255},${(i + 1) >> 8},0)`;
      const polys = f.geometry ? (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) : [];
      g.beginPath();
      for (const poly of polys) for (const ring of poly) {
        ring.forEach(([lon, lat], k) => { const x = (lon + 180) / 360 * RW, y = (90 - lat) / 180 * RH; k ? g.lineTo(x, y) : g.moveTo(x, y); });
        g.closePath();
      }
      g.fill('evenodd');
    });
    const d = g.getImageData(0, 0, RW, RH).data;
    grids = LODS.map(s => {
      const X = [], Y = [], C = [];
      let row = 0;
      for (let lat = 83; lat > -58; lat -= s * .87, row++) for (let lon = -180 + (row & 1) * s / 2; lon < 180; lon += s) {
        const px = ((lon + 180) / 360 * RW) | 0, py = ((90 - lat) / 180 * RH) | 0, o = (py * RW + px) * 4;
        const id = d[o] + (d[o + 1] << 8); if (d[o + 3] > 0 && id > 0) { X.push(lon); Y.push(merc(lat)); C.push(id - 1); }
      }
      return { s, X: Float32Array.from(X), Y: Float32Array.from(Y), C: Uint16Array.from(C) };
    });
    ready = true;
    return grids.map(g => g.X.length);
  }

  // ---- câmera ----
  const camOf = b => b && b.camera ? { lon: b.camera.lon, Y: merc(b.camera.lat), z: b.camera.zoom } : null;
  function camera(T, beats, cur) {
    // última câmera definida até a batida atual e a anterior a ela
    let k = cur; while (k >= 0 && !beats[k].camera) k--;
    if (k < 0) return null;
    let j = k - 1; while (j >= 0 && !beats[j].camera) j--;
    const to = camOf(beats[k]); if (j < 0) return creep({ ...to, speed: 0 }, T - beats[k].abs);
    const from = camOf(beats[j]), dur = beats[k].camDur ?? 1.15, u = U().clamp((T - beats[k].abs) / dur), e = U().ease(u);
    const dist = Math.hypot(to.lon - from.lon, to.Y - from.Y);
    const lz = Math.log(from.z) + (Math.log(to.z) - Math.log(from.z)) * e;
    const dip = Math.min(.55, dist / 140) * Math.sin(Math.PI * e);        // afasta no meio do voo, como um "fly to"
    const speed = u > 0 && u < 1 ? Math.sin(Math.PI * u) * Math.min(1, dist / 30 + Math.abs(Math.log(to.z / from.z))) : 0;
    return creep({ lon: from.lon + (to.lon - from.lon) * e, Y: from.Y + (to.Y - from.Y) * e, z: Math.exp(lz) * (1 - dip), speed }, T - beats[k].abs - dur);
  }
  // câmera nunca para: depois de chegar, avança devagar (+2,5%/s) e desliza de leve
  function creep(c, held) { if (held <= 0) return c; const h = Math.min(held, 6); return { ...c, z: c.z * (1 + .025 * h), lon: c.lon + .06 * h * Math.sin(h * .7) }; }
  const CY = H * .5;
  const proj = (cam, lon, lat) => ({ x: W / 2 + (lon - cam.lon) * cam.z, y: CY - (merc(lat) - cam.Y) * cam.z });

  // ---- desenho ----
  let alpha = 0, hlA = {};
  function draw(ctx, T, beats, cur) {
    if (!ready) return null;
    const b = beats[cur], cam = camera(T, beats, cur);
    const want = b.map === false || !cam ? 0 : 1;
    alpha += (want - alpha) * .12; if (alpha < .01 || !cam) return null;
    const th = U().theme(), hl = new Set(b.highlight || []);
    // brilho de destaque entra/sai suave por país
    names.forEach((n, i) => { const tgt = hl.has(n) ? 1 : 0; const v = hlA[i] ?? 0; hlA[i] = v + (tgt - v) * .1; });
    lctx.clearRect(0, 0, W, H);
    // escolhe o nível de detalhe pelo espaçamento em pixels (~9 px)
    let li = 0; for (let k = 0; k < grids.length; k++) if (grids[k].s * cam.z >= 9) li = k;
    const g = grids[li], dot = Math.max(1.6, Math.min(4.2, g.s * cam.z * .38));
    const x0 = -20, x1 = W + 20, y0 = -20, y1 = H + 20;
    for (let pass = 0; pass < 2; pass++) {
      lctx.fillStyle = pass ? th.accent : '#59606e';
      for (let i = 0; i < g.X.length; i++) {
        const x = W / 2 + (g.X[i] - cam.lon) * cam.z; if (x < x0 || x > x1) continue;
        const y = CY - (g.Y[i] - cam.Y) * cam.z; if (y < y0 || y > y1) continue;
        const h = hlA[g.C[i]] || 0;
        if (pass === 0) { if (h > .98) continue; lctx.globalAlpha = .55 * (1 - h); }
        else { if (h < .02) continue; lctx.globalAlpha = .95 * h; }
        lctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
      }
    }
    lctx.globalAlpha = 1;
    const mb = Math.min(7, cam.speed * 7);
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.filter = mb > .3 ? `blur(${mb.toFixed(1)}px)` : 'none'; ctx.drawImage(layer, 0, 0);
    ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${(8 + mb).toFixed(1)}px)`; ctx.globalAlpha = alpha * .55; ctx.drawImage(layer, 0, 0);
    ctx.restore();
    return cam;
  }

  function overlay(ctx, T, beats, cur, cam) {
    if (!cam || alpha < .05) return;
    const b = beats[cur], bt = T - b.abs, th = U().theme(), { text, mono, rr, easeOut, prog, clamp } = U();
    ctx.save(); ctx.globalAlpha *= alpha;
    if (b.arc) {
      const p = easeOut(prog(bt, b.arc.at ?? .3, 1.0)), a = proj(cam, ...b.arc.from), c = proj(cam, ...b.arc.to);
      const mx = (a.x + c.x) / 2, my = Math.min(a.y, c.y) - Math.hypot(c.x - a.x, c.y - a.y) * .35;
      ctx.beginPath(); for (let k = 0; k <= 60 * p; k++) { const u = k / 60, x = (1 - u) ** 2 * a.x + 2 * (1 - u) * u * mx + u * u * c.x, y = (1 - u) ** 2 * a.y + 2 * (1 - u) * u * my + u * u * c.y; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = th.accent; ctx.lineWidth = 3; ctx.shadowColor = th.accent; ctx.shadowBlur = 14; ctx.setLineDash([12, 10]); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
    }
    (b.pins || []).forEach(pin => {
      const s = prog(bt, pin.at ?? .5, .35); if (s <= 0) return;
      const q = proj(cam, pin.lon, pin.lat), pop = 1 + .35 * Math.sin(Math.PI * Math.min(1, s)) * (1 - s), col = pin.color === 'alert' ? th.alert : pin.color === 'white' ? '#fff' : th.accent;
      const ring = (T * .9 + (pin.lon + 200) * .01) % 1;
      ctx.beginPath(); ctx.arc(q.x, q.y, 10 + ring * 46, 0, 7); ctx.strokeStyle = col; ctx.globalAlpha = alpha * (1 - ring) * .7 * s; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.globalAlpha = alpha * s; ctx.beginPath(); ctx.arc(q.x, q.y, 11 * pop, 0, 7); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 24; ctx.fill(); ctx.shadowBlur = 0;
      // cartão com cidade e valor
      const up = pin.below ? 1 : -1, cy = q.y + up * 120, w = 300, h = 118, cx = Math.max(w / 2 + 40, Math.min(W - w / 2 - 40, q.x));
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(q.x, q.y + up * 16); ctx.lineTo(cx, cy - up * h / 2); ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); ctx.scale(pop, pop);
      rr(-w / 2, -h / 2, w, h, 18); ctx.fillStyle = 'rgba(14,14,18,.88)'; ctx.fill(); ctx.strokeStyle = col; ctx.globalAlpha = alpha * s * .6; ctx.stroke(); ctx.globalAlpha = alpha * s;
      ctx.restore();
      mono(pin.label, cx, cy - 26, { size: 21, color: 'rgba(255,255,255,.75)', alpha: s });
      let v = pin.value; if (typeof v === 'object') { const pp = easeOut(prog(bt, (pin.at ?? .5) + (v.delay ?? 0), v.dur ?? .8)); v = (v.prefix || '') + Math.round(v.from + (v.to - v.from) * pp) + (v.suffix || ''); }
      text(v, cx, cy + 18, { size: 54, color: col, alpha: s, font: 'Inter', weight: 800 });
    });
    ctx.restore();
  }
  window.MAP = { load, draw, overlay, get ready() { return ready; } };
})();
