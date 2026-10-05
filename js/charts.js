/* Noir Balance · gráficas animadas e interactivas (SVG propio, sin librerías) */
(function () {
  const NB = window.NB;
  const C = (NB.charts = {});
  NB.scrubs = {};

  const r1 = (n) => Math.round(n * 10) / 10;

  C.smooth = (p) => {
    if (!p.length) return '';
    let d = 'M' + p[0][0] + ' ' + p[0][1];
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[i - 1] || p[i];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ' C' + r1(c1[0]) + ' ' + r1(c1[1]) + ' ' + r1(c2[0]) + ' ' + r1(c2[1]) + ' ' + r1(p2[0]) + ' ' + r1(p2[1]);
    }
    return d;
  };

  /* Línea con área, proyección punteada y marcador que se mueve con el dedo */
  C.line = (id, o) => {
    const W = 310;
    const H = 116;
    const vals = o.vals;
    const n = vals.length;
    if (n < 2) return '';
    const min = Math.min.apply(null, vals);
    const max = Math.max.apply(null, vals);
    const span = max - min || 1;
    const pts = vals.map((v, i) => [r1((i / (n - 1)) * W), r1(H - 18 - ((v - min) / span) * (H - 40))]);
    const ti = Math.min(o.todayIdx == null ? n - 1 : o.todayIdx, n - 1);
    const full = C.smooth(pts);
    const solid = C.smooth(pts.slice(0, ti + 1));
    const dash = ti < n - 1 ? C.smooth(pts.slice(ti)) : '';
    const fmt = o.fmt || NB.money;
    const labels = o.labels || vals.map((_, i) => String(i + 1));
    const l0 = o.todayLabel || labels[ti];
    NB.scrubs[id] = { pts, vals, labels, ti, dashFrom: ti, proj: o.proj !== false };
    NB.scrubs[id].texts = vals.map((v) => fmt(v));
    NB.scrubs[id].l0 = l0;
    NB.scrubs[id].a0 = NB.scrubs[id].texts[ti];
    const gid = 'ga' + id;
    return (
      '<div class="readout"><span class="mut" id="sl-' + id + '">' + NB.esc(l0) + '</span><b id="sa-' + id + '">' + NB.esc(NB.scrubs[id].a0) + '</b></div>' +
      '<svg class="scrub" data-scrub="' + id + '" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="' + NB.esc(o.aria || 'Gráfica') + '">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--vio)" stop-opacity="0.5"/><stop offset="1" stop-color="var(--vio)" stop-opacity="0"/></linearGradient></defs>' +
      '<path class="c-area" d="' + full + ' L' + W + ' ' + H + ' L0 ' + H + ' Z" fill="url(#' + gid + ')"/>' +
      (dash ? '<path class="c-proj" d="' + dash + '" fill="none" stroke="var(--chart)" stroke-width="2" stroke-dasharray="4 5"/>' : '') +
      '<path class="c-line" pathLength="1" d="' + solid + '" fill="none" stroke="var(--chart)" stroke-width="2.2" stroke-linecap="round"/>' +
      '<circle class="c-spark" r="2.6" fill="var(--text)"><animateMotion dur="6s" repeatCount="indefinite" path="' + full + '"/></circle>' +
      '<line id="sx-' + id + '" x1="' + pts[ti][0] + '" y1="' + pts[ti][1] + '" x2="' + pts[ti][0] + '" y2="' + H + '" stroke="var(--chart)" stroke-width="1" opacity="0.5"/>' +
      '<circle class="c-pulse" id="sp-' + id + '" cx="' + pts[ti][0] + '" cy="' + pts[ti][1] + '" r="5" fill="var(--vio)"/>' +
      '<circle id="sc-' + id + '" cx="' + pts[ti][0] + '" cy="' + pts[ti][1] + '" r="5" fill="var(--text)" stroke="var(--vio)" stroke-width="2"/>' +
      '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="transparent"/>' +
      '</svg>'
    );
  };

  C.scrubMove = (svg, e) => {
    const id = svg.getAttribute('data-scrub');
    const sc = NB.scrubs[id];
    if (!sc) return;
    const rect = svg.getBoundingClientRect();
    const f = (e.clientX - rect.left) / Math.max(1, rect.width);
    const idx = Math.max(0, Math.min(sc.pts.length - 1, Math.round(f * (sc.pts.length - 1))));
    C.scrubSet(id, idx);
  };
  C.scrubSet = (id, idx) => {
    const sc = NB.scrubs[id];
    if (!sc) return;
    const p = sc.pts[idx];
    const g = (k) => document.getElementById(k + '-' + id);
    const x = g('sx');
    if (!x) return;
    x.setAttribute('x1', p[0]);
    x.setAttribute('x2', p[0]);
    x.setAttribute('y1', p[1]);
    ['sc', 'sp'].forEach((k) => {
      g(k).setAttribute('cx', p[0]);
      g(k).setAttribute('cy', p[1]);
    });
    const lab = idx === sc.ti ? sc.l0 : sc.labels[idx] + (sc.proj && idx > sc.ti ? ' · proyección' : '');
    g('sl').textContent = lab;
    g('sa').textContent = sc.texts[idx];
  };
  C.scrubReset = (svg) => {
    const id = svg.getAttribute('data-scrub');
    const sc = NB.scrubs[id];
    if (sc) C.scrubSet(id, sc.ti);
  };

  /* Dona */
  C.donut = (items, centerLabel) => {
    const total = NB.sum(items, (i) => i.value);
    if (total <= 0) return '';
    const R = 44;
    const CIR = 2 * Math.PI * R;
    let off = 0;
    const segs = items
      .map((it) => {
        const len = Math.max(0, (it.value / total) * CIR - (items.length > 1 ? 2.5 : 0));
        const s = '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="' + it.color + '" stroke-width="15" stroke-dasharray="' + r1(len) + ' ' + r1(CIR - len) + '" stroke-dashoffset="' + r1(-off) + '" stroke-linecap="butt"/>';
        off += (it.value / total) * CIR;
        return s;
      })
      .join('');
    return (
      '<svg class="donut" viewBox="0 0 120 120" width="132" height="132" role="img" aria-label="Gastos por categoría">' +
      '<g class="donut-g" transform="rotate(-90 60 60)">' + segs + '</g>' +
      '<text x="60" y="57" text-anchor="middle" style="fill:var(--mut);font-size:8px;font-weight:500">' + NB.esc(centerLabel || 'Total') + '</text>' +
      '<text x="60" y="71" text-anchor="middle" style="fill:var(--text);font-size:12px;font-weight:700">' + NB.esc(NB.money0(total)) + '</text>' +
      '</svg>'
    );
  };

  /* Barras agrupadas: ingresos vs gastos por semana */
  C.bars = (weeks) => {
    const W = 310;
    const H = 130;
    const max = Math.max(1, ...weeks.map((w) => Math.max(w.inc, w.exp)));
    const gw = W / weeks.length;
    const bw = Math.min(16, gw * 0.28);
    let out = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Ingresos contra gastos por semana">';
    out += '<line x1="0" y1="' + (H - 20) + '" x2="' + W + '" y2="' + (H - 20) + '" stroke="var(--line)"/>';
    weeks.forEach((w, i) => {
      const cx = gw * i + gw / 2;
      const hi = Math.max(w.inc > 0 ? 3 : 0, (w.inc / max) * (H - 38));
      const he = Math.max(w.exp > 0 ? 3 : 0, (w.exp / max) * (H - 38));
      out += '<rect class="bar" style="animation-delay:' + (0.1 + i * 0.07) + 's" x="' + r1(cx - bw - 2) + '" y="' + r1(H - 20 - hi) + '" width="' + r1(bw) + '" height="' + r1(hi) + '" rx="3" fill="var(--green)"/>';
      out += '<rect class="bar" style="animation-delay:' + (0.17 + i * 0.07) + 's" x="' + r1(cx + 2) + '" y="' + r1(H - 20 - he) + '" width="' + r1(bw) + '" height="' + r1(he) + '" rx="3" fill="var(--vio)"/>';
      out += '<text x="' + r1(cx) + '" y="' + (H - 6) + '" text-anchor="middle" style="fill:var(--mut);font-size:8.5px">' + NB.esc(w.label) + '</text>';
    });
    return out + '</svg>';
  };

  /* Anillo de progreso */
  C.ring = (pct, size) => {
    size = size || 64;
    const R = 26;
    const CIR = 2 * Math.PI * R;
    const p = Math.max(0, Math.min(1, pct));
    return (
      '<svg class="ring" viewBox="0 0 64 64" width="' + size + '" height="' + size + '" role="img" aria-label="' + Math.round(p * 100) + '% apartado">' +
      '<circle cx="32" cy="32" r="' + R + '" fill="none" stroke="var(--track)" stroke-width="6"/>' +
      '<circle class="ring-v" cx="32" cy="32" r="' + R + '" fill="none" stroke="var(--vio)" stroke-width="6" stroke-linecap="round" transform="rotate(-90 32 32)" style="--c:' + r1(CIR) + ';--v:' + r1(CIR * (1 - p)) + '" stroke-dasharray="' + r1(CIR) + '"/>' +
      '<text x="32" y="36" text-anchor="middle" style="fill:var(--text);font-size:13px;font-weight:700">' + Math.round(p * 100) + '%</text>' +
      '</svg>'
    );
  };

  C.progress = (pct, delay) =>
    '<div class="track"><div class="fill" style="width:' + Math.max(0, Math.min(100, pct * 100)) + '%;animation-delay:' + (delay || 0.3) + 's,0s"></div></div>';
})();
