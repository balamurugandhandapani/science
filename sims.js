/* ==============================
   Physics Simulations (original code)
   Pendulum - Double slit - Photoelectric effect - Bragg diffraction
   Pure physics lives in SIM (testable in Node); drawing is browser-only.
============================== */
const SIM = (function () {
  const PI = Math.PI, HC = 1239.841984;              /* eV nm (exact SI) */
  const ME = 9.1093837139e-31, QE = 1.602176634e-19; /* CODATA 2022, SI 2019 */

  function agm(a, b) { for (let i = 0; i < 30 && Math.abs(a - b) > 1e-15; i++) { const t = (a + b) / 2; b = Math.sqrt(a * b); a = t; } return a; }
  /* exact large-angle pendulum period */
  const periodExact = (L, g, th0) => 2 * PI * Math.sqrt(L / g) / agm(1, Math.cos(th0 / 2));
  const period0 = (L, g) => 2 * PI * Math.sqrt(L / g);
  /* one RK4 step of  th'' = -(g/L) sin th - b th' */
  function rk4(th, w, dt, g, L, b) {
    const a = (t, v) => -(g / L) * Math.sin(t) - b * v;
    const k1t = w, k1w = a(th, w);
    const k2t = w + dt / 2 * k1w, k2w = a(th + dt / 2 * k1t, w + dt / 2 * k1w);
    const k3t = w + dt / 2 * k2w, k3w = a(th + dt / 2 * k2t, w + dt / 2 * k2w);
    const k4t = w + dt * k3w, k4w = a(th + dt * k3t, w + dt * k3w);
    return [th + dt / 6 * (k1t + 2 * k2t + 2 * k3t + k4t), w + dt / 6 * (k1w + 2 * k2w + 2 * k3w + k4w)];
  }
  /* double slit: lam, a, d in metres, y and D in metres; returns relative intensity 0..1 */
  function slitI(y, lam, d, a, D) {
    const s = y / Math.hypot(y, D), al = PI * d * s / lam, be = PI * a * s / lam;
    const sinc = Math.abs(be) < 1e-12 ? 1 : Math.sin(be) / be;
    return Math.cos(al) ** 2 * sinc * sinc;
  }
  /* photoelectric effect; lam nm, phi eV, V volts */
  function photo(lam, phi, V, intensity) {
    const E = HC / lam, K = Math.max(0, E - phi), on = E > phi;
    const Vs = K;
    const rel = on ? (V >= 0 ? 1 : Math.max(0, Math.min(1, (V + Vs) / Vs))) : 0;
    return { E, K, on, Vs, lam0: HC / phi, f0: phi * QE / 6.62607015e-34, vmax: Math.sqrt(2 * K * QE / ME), I: rel * intensity / 100 };
  }
  /* N-plane Bragg interference, normalised to 1 at the peaks */
  function braggI(th, d, lam, N) {
    const dl = 4 * PI * d * Math.sin(th) / lam, s = Math.sin(dl / 2);
    return Math.abs(s) < 1e-9 ? 1 : (Math.sin(N * dl / 2) / s) ** 2 / (N * N);
  }
  function braggAngles(d, lam) { const r = []; for (let n = 1; n * lam / (2 * d) <= 1 && n < 9; n++) r.push([n, Math.asin(n * lam / (2 * d)) * 180 / PI]); return r; }
  function rgb(nm, k) { /* approximate colour of light, k = brightness 0..1 */
    let r = 0, g = 0, b = 0;
    if (nm < 440) { r = (440 - nm) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = (645 - nm) / 65; } else { r = 1; }
    const c = x => Math.round(255 * Math.pow(Math.max(0, Math.min(1, x * k)), 0.8));
    return 'rgb(' + c(r) + ',' + c(g) + ',' + c(b) + ')';
  }
  return { agm, periodExact, period0, rk4, slitI, photo, braggI, braggAngles, rgb, HC };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SIM;

if (typeof document !== 'undefined') (function () {
  const $ = id => document.getElementById(id), PI = Math.PI, INK = '#013938', ACC = '#800000';
  const v = id => parseFloat($(id).value);
  const f = x => String(parseFloat(Number(x).toPrecision(5)));
  const T = t => '<span data-tex="' + t.replace(/"/g, '&quot;') + '"></span>';
  const typeset = el => { if (window.renderTeX) window.renderTeX(el); };

  /* sliders: [id, label, min, max, step, value, unit] */
  function ctl(box, defs, onchange) {
    $(box).innerHTML = defs.map(d => '<label><span>' + d[1] + ': <b id="' + d[0] + '-v">' + d[5] + '</b> ' + d[6] + '</span><input type="range" id="' + d[0] +
      '" min="' + d[2] + '" max="' + d[3] + '" step="' + d[4] + '" value="' + d[5] + '"></label>').join('');
    defs.forEach(d => $(d[0]).addEventListener('input', () => { $(d[0] + '-v').textContent = $(d[0]).value; onchange(d[0]); }));
  }
  /* readout table with live cells: rows [labelHTML, cellId, highlight] */
  function table(box, rows) {
    $(box).innerHTML = '<table class="result-table">' + rows.map(r => '<tr' + (r[2] ? ' class="result-highlight"' : '') + '><td>' + r[0] + '</td><td id="' + r[1] + '">&ndash;</td></tr>').join('') + '</table>';
    typeset($(box));
  }
  const set = (id, s) => { $(id).textContent = s; };
  function axes(c, x0, y0, x1, y1) { c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y1); c.lineTo(x0, y0); c.lineTo(x1, y0); c.stroke(); }
  function line(c, pts, col, w) { c.strokeStyle = col; c.lineWidth = w || 2; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); }
  const clear = cv => { const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); c.font = '11px "IBM Plex Mono", monospace'; return c; };

  document.querySelectorAll('.calc-tab').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.calc-tab').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.calc-panel').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); $('panel-' + b.dataset.tab).classList.add('active');
  }));
  const visible = id => $('panel-' + id).classList.contains('active');

  /* ================= PENDULUM ================= */
  const pe = { th: 0, w: 0, t: 0, run: false, hist: [], up: null, Tm: null, last: 0 };
  ctl('pe-ctl', [['pe-L', 'Length L', 0.2, 3, 0.05, 1, 'm'], ['pe-a', 'Start angle &theta;<sub>0</sub>', 5, 90, 1, 30, '&deg;'],
    ['pe-m', 'Mass m', 0.1, 5, 0.1, 1, 'kg'], ['pe-b', 'Damping b', 0, 2, 0.05, 0, 's<sup>&minus;1</sup>']], id => { if (id === 'pe-a') peReset(); else peReadout(); drawPe(); });
  table('pe-out', [[T('\\theta'), 'pe-th'], [T('\\omega=\\dot\\theta'), 'pe-w'], [T('K=\\tfrac12 mL^{2}\\omega^{2}'), 'pe-ke'], [T('U=mgL(1-\\cos\\theta)'), 'pe-pe'],
    ['Total energy', 'pe-te'], [T('T_0=2\\pi\\sqrt{L/g}')+' (small angle)', 'pe-t0'], [T('T')+' exact (AGM)', 'pe-tx', true], [T('T')+' measured in this run', 'pe-tm', true]]);
  function peReset() { pe.th = v('pe-a') * PI / 180; pe.w = 0; pe.t = 0; pe.hist = []; pe.up = null; pe.Tm = null; peReadout(); drawPe(); }
  function peReadout() {
    const L = v('pe-L'), g = v('pe-g'), m = v('pe-m'), a = v('pe-a') * PI / 180;
    const K = 0.5 * m * L * L * pe.w * pe.w, U = m * g * L * (1 - Math.cos(pe.th));
    set('pe-th', f(pe.th * 180 / PI) + ' °'); set('pe-w', f(pe.w) + ' rad/s'); set('pe-ke', f(K) + ' J'); set('pe-pe', f(U) + ' J'); set('pe-te', f(K + U) + ' J');
    set('pe-t0', f(SIM.period0(L, g)) + ' s'); set('pe-tx', f(SIM.periodExact(L, g, a)) + ' s  (×' + f(SIM.periodExact(L, g, a) / SIM.period0(L, g)) + ')');
    set('pe-tm', pe.Tm ? f(pe.Tm) + ' s' : (v('pe-b') > 0 ? 'run the pendulum (damping slightly lengthens it)' : 'run the pendulum'));
  }
  function peStep(dt) {
    const g = v('pe-g'), L = v('pe-L'), b = v('pe-b'), p = pe.th;
    [pe.th, pe.w] = SIM.rk4(pe.th, pe.w, dt, g, L, b); pe.t += dt;
    if (p < 0 && pe.th >= 0 && pe.w > 0) { const tc = pe.t - dt * pe.th / (pe.th - p); if (pe.up !== null) pe.Tm = tc - pe.up; pe.up = tc; }
    pe.hist.push([pe.t, pe.th]); if (pe.hist.length > 4000) pe.hist.shift();
  }
  function drawPe() {
    const cv = $('pe-cv'), c = clear(cv), L = v('pe-L'), S = 80, px = 165, py = 30;
    const bx = px + L * S * Math.sin(pe.th), by = py + L * S * Math.cos(pe.th), r = 8 + 5 * Math.cbrt(v('pe-m'));
    c.fillStyle = '#e6ecec'; c.fillRect(40, 20, 250, 8);
    c.strokeStyle = 'rgba(1,57,56,.25)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(px, py); c.lineTo(px, py + L * S + 14); c.stroke(); c.setLineDash([]);
    const a0 = v('pe-a') * PI / 180; c.strokeStyle = 'rgba(128,0,0,.25)'; c.beginPath(); c.arc(px, py, L * S, PI / 2 - a0, PI / 2 + a0); c.stroke();
    line(c, [[px, py], [bx, by]], INK, 2);
    c.fillStyle = ACC; c.beginPath(); c.arc(bx, by, r, 0, 7); c.fill(); c.fillStyle = INK; c.beginPath(); c.arc(px, py, 4, 0, 7); c.fill();
    /* graph of theta(t), last 8 s */
    const gx0 = 370, gx1 = 745, gy0 = 160, amp = Math.max(a0, 0.2) * 180 / PI * 1.15;
    axes(c, gx0, gy0 + 120, gx1, gy0 - 120); c.strokeStyle = 'rgba(1,57,56,.25)'; c.beginPath(); c.moveTo(gx0, gy0); c.lineTo(gx1, gy0); c.stroke();
    c.fillStyle = INK; c.textAlign = 'right'; c.fillText(f(amp) + '°', gx0 - 4, gy0 - 116); c.fillText('0', gx0 - 4, gy0 + 4); c.fillText('-' + f(amp) + '°', gx0 - 4, gy0 + 124);
    c.textAlign = 'center'; c.fillText('time (last 8 s)', (gx0 + gx1) / 2, 312);
    const t1 = pe.t, t0 = Math.max(0, t1 - 8), win = Math.max(8, t1 - t0);
    const pts = pe.hist.filter(h => h[0] >= t0).map(h => [gx0 + (h[0] - t0) / win * (gx1 - gx0), gy0 - h[1] * 180 / PI / amp * 120]);
    if (pts.length > 1) line(c, pts, ACC, 2); else if (!pe.run) { c.fillStyle = INK; c.textAlign = 'center'; c.fillText('press Start', (gx0 + gx1) / 2, gy0 - 20); }
  }
  function peLoop(ts) {
    if (!pe.run) return;
    const dt = Math.min(0.05, (ts - pe.last) / 1000 || 0.016); pe.last = ts;
    for (let i = 0, n = Math.ceil(dt / (1 / 240)); i < n; i++) peStep(dt / n);
    peReadout(); drawPe(); requestAnimationFrame(peLoop);
  }
  $('pe-go').addEventListener('click', () => { pe.run = !pe.run; $('pe-go').innerHTML = pe.run ? '&#10074;&#10074; Pause' : '&#9654; Start'; if (pe.run) { pe.last = performance.now(); requestAnimationFrame(peLoop); } });
  $('pe-rs').addEventListener('click', peReset); $('pe-g').addEventListener('change', () => { peReset(); });

  /* ================= DOUBLE SLIT ================= */
  ctl('wv-ctl', [['wv-l', 'Wavelength &lambda;', 400, 700, 1, 550, 'nm'], ['wv-d', 'Slit separation d', 20, 500, 5, 150, '&micro;m'],
    ['wv-a', 'Slit width a', 2, 100, 1, 30, '&micro;m'], ['wv-D', 'Screen distance D', 0.5, 5, 0.1, 2, 'm']], drawWv);
  table('wv-out', [['Fringe spacing ' + T('\\Delta y=\\lambda D/d'), 'wv-dy', true], ['First diffraction minimum ' + T('y_1=\\lambda D/a'), 'wv-y1'],
    ['Bright fringes in the central envelope (about)', 'wv-n'], ['First-order angle ' + T('\\theta_1=\\arcsin(\\lambda/d)'), 'wv-th']]);
  function drawWv() {
    const cv = $('wv-cv'), c = clear(cv), lam = v('wv-l') * 1e-9, d = v('wv-d') * 1e-6, a = v('wv-a') * 1e-6, D = v('wv-D');
    const dy = lam * D / d, y1 = lam * D / a, Y = Math.min(2.2 * y1, 15 * dy), x0 = 60, x1 = 740, N = x1 - x0;
    const I = [], strip = 64;
    for (let i = 0; i <= N; i++) I.push(SIM.slitI((i / N * 2 - 1) * Y, lam, d, a, D));
    for (let i = 0; i <= N; i++) { c.fillStyle = SIM.rgb(v('wv-l'), I[i]); c.fillRect(x0 + i, 10, 1, strip); }
    c.strokeStyle = INK; c.strokeRect(x0, 10, N, strip);
    const gy0 = 310, gh = 215; axes(c, x0, gy0, x1, gy0 - gh);
    line(c, I.map((s, i) => [x0 + i, gy0 - s * gh]), ACC, 2);
    c.fillStyle = INK; c.textAlign = 'center';
    for (let k = -2; k <= 2; k++) { const px = x0 + (k / 2 + 1) / 2 * N; c.fillText(String(parseFloat((k / 2 * Y * 1000).toPrecision(3))), Math.min(px, x1 - 14), gy0 + 14); }
    c.fillText('position on screen y (mm)', (x0 + x1) / 2, 338); c.textAlign = 'right'; c.fillText('1', x0 - 4, gy0 - gh + 8); c.fillText('0', x0 - 4, gy0 - 2); c.textAlign = 'left'; c.fillText('intensity I/I\u2080', x0 + 8, gy0 - gh + 2);
    set('wv-dy', f(dy * 1000) + ' mm'); set('wv-y1', f(y1 * 1000) + ' mm'); set('wv-n', a > d ? 'slit width should be smaller than the separation' : '≈ ' + f(2 * d / a - 1)); set('wv-th', f(Math.asin(Math.min(1, lam / d)) * 180 / PI) + ' °');
  }

  /* ================= PHOTOELECTRIC ================= */
  ctl('ph-ctl', [['ph-l', 'Wavelength &lambda;', 200, 700, 1, 250, 'nm'], ['ph-i', 'Light intensity', 0, 100, 1, 60, '%'], ['ph-V', 'Collector voltage V', -4, 4, 0.05, 0, 'V']], () => { phRead(); drawIV(); });
  const phi = () => $('ph-m').value === 'custom' ? v('ph-phi') : parseFloat($('ph-m').value);
  $('ph-m').addEventListener('change', () => { $('ph-cw').style.display = $('ph-m').value === 'custom' ? '' : 'none'; phRead(); drawIV(); });
  $('ph-phi').addEventListener('input', () => { phRead(); drawIV(); });
  table('ph-out', [['Photon energy ' + T('E=hc/\\lambda'), 'ph-E'], ['Threshold wavelength ' + T('\\lambda_0=hc/\\phi'), 'ph-l0'], ['Threshold frequency ' + T('f_0'), 'ph-f0'],
    ['Electrons emitted?', 'ph-on', true], ['Maximum kinetic energy ' + T('K_{\\max}'), 'ph-K'], ['Stopping potential ' + T('V_s'), 'ph-Vs'],
    ['Fastest electron speed', 'ph-sp'], ['Relative photocurrent', 'ph-I']]);
  function phRead() {
    const p = SIM.photo(v('ph-l'), phi(), v('ph-V'), v('ph-i'));
    set('ph-E', f(p.E) + ' eV'); set('ph-l0', f(p.lam0) + ' nm'); set('ph-f0', f(p.f0 / 1e12) + ' THz');
    set('ph-on', p.on ? 'Yes — photon energy exceeds φ' : 'No — photon energy below φ'); set('ph-K', f(p.K) + ' eV'); set('ph-Vs', f(p.Vs) + ' V');
    set('ph-sp', p.on ? f(p.vmax / 1e6) + ' × 10⁶ m/s' : '–'); set('ph-I', f(p.I * 100) + ' % of maximum');
  }
  function drawIV() {
    const cv = $('ph-iv'), c = clear(cv), p = SIM.photo(v('ph-l'), phi(), v('ph-V'), v('ph-i')), x0 = 60, x1 = 740, y0 = 200, h = 170;
    const X = V => x0 + (V + 4) / 8 * (x1 - x0), Y = i => y0 - i * h;
    axes(c, x0, y0, x1, y0 - h - 10);
    c.strokeStyle = 'rgba(1,57,56,.25)'; c.beginPath(); c.moveTo(X(0), y0); c.lineTo(X(0), y0 - h - 10); c.stroke();
    const pts = []; for (let V = -4; V <= 4.001; V += 0.05) pts.push([X(V), Y(SIM.photo(v('ph-l'), phi(), V, v('ph-i')).I)]);
    line(c, pts, ACC, 2);
    c.fillStyle = INK; c.textAlign = 'center'; for (let V = -4; V <= 4; V += 2) c.fillText(V + ' V', X(V), y0 + 14);
    c.fillText('collector voltage V', (x0 + x1) / 2, 226); c.textAlign = 'right'; c.fillText('current', x0 - 4, 24);
    if (p.on) { c.setLineDash([4, 3]); c.strokeStyle = INK; c.beginPath(); c.moveTo(X(-p.Vs), y0); c.lineTo(X(-p.Vs), y0 - 30); c.stroke(); c.setLineDash([]); c.textAlign = 'center'; c.fillText('−Vs', X(-p.Vs), y0 - 36); }
    c.fillStyle = ACC; c.beginPath(); c.arc(X(v('ph-V')), Y(p.I), 5, 0, 7); c.fill();
  }
  const parts = []; let phCnt = 0;
  function drawPh() {
    const cv = $('ph-cv'), c = clear(cv), lam = v('ph-l'), P = phi(), V = v('ph-V'), p = SIM.photo(lam, P, V, v('ph-i')), XL = 100, XR = 660;
    c.fillStyle = '#b8c2c4'; c.fillRect(XL - 24, 50, 24, 170); c.fillRect(XR, 50, 24, 170);
    c.fillStyle = INK; c.textAlign = 'center'; c.fillText('metal plate', XL - 12, 240); c.fillText('collector', XR + 12, 240); c.fillText(f(V) + ' V', (XL + XR) / 2, 40);
    if (visible('ph') && Math.random() < v('ph-i') / 100 * 0.5) parts.push({ k: 'p', x: 8, y: 20 + Math.random() * 190, tx: XL, ty: 50 + Math.random() * 170 });
    const col = lam < 380 ? '#7b2fbe' : lam > 750 ? '#8b0000' : SIM.rgb(lam, 1);
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      if (q.k === 'p') {
        const dx = q.tx - q.x, dy = q.ty - q.y, dd = Math.hypot(dx, dy); q.x += dx / dd * 5; q.y += dy / dd * 5;
        c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(q.x - dx / dd * 14, q.y - dy / dd * 14); c.lineTo(q.x, q.y); c.stroke();
        if (dd < 6) { parts.splice(i, 1); if (p.on) parts.push({ k: 'e', x: XL, y: q.ty, dir: 1, ke0: p.K * (0.3 + 0.7 * Math.random()) }); }
      } else {
        const ke = q.ke0 + V * (q.x - XL) / (XR - XL);
        if (ke <= 0 && q.dir > 0) q.dir = -1;
        q.x += q.dir * (1.2 + 5 * Math.sqrt(Math.max(ke, 0.02)));
        c.fillStyle = '#1f5fbf'; c.beginPath(); c.arc(q.x, q.y, 4, 0, 7); c.fill();
        if (q.x >= XR || q.x <= XL) { parts.splice(i, 1); if (q.x >= XR) phCnt++; }
      }
    }
    c.lineWidth = 1; c.fillStyle = INK; c.textAlign = 'left'; c.fillText(p.on ? 'electrons reaching collector: ' + phCnt : 'no emission: photon energy ' + f(p.E) + ' eV < φ = ' + f(P) + ' eV', 20, 255);
    requestAnimationFrame(drawPh);
  }

  /* ================= BRAGG ================= */
  ctl('br-ctl', [['br-d', 'Plane spacing d', 1, 5, 0.05, 3, '&Aring;'], ['br-l', 'Wavelength &lambda;', 0.5, 3, 0.01, 1.54, '&Aring;'],
    ['br-t', 'Glancing angle &theta;', 1, 89, 0.1, 15, '&deg;'], ['br-N', 'Number of planes N', 2, 30, 1, 6, '']], drawBr);
  table('br-out', [['Path difference ' + T('2d\\sin\\theta'), 'br-pd'], ['Order ' + T('n=2d\\sin\\theta/\\lambda'), 'br-n', true], ['Condition', 'br-c', true], ['Bragg angles ' + T('\\theta_n'), 'br-an']]);
  function drawBr() {
    const cv = $('br-cv'), c = clear(cv), d = v('br-d'), lam = v('br-l'), th = v('br-t') * PI / 180, N = v('br-N'), dp = d * 24, y1 = 130, cs = Math.cos(th), sn = Math.sin(th);
    for (let k = 0; k < 3; k++) { const y = y1 + k * dp; c.strokeStyle = 'rgba(1,57,56,.2)'; c.beginPath(); c.moveTo(20, y); c.lineTo(420, y); c.stroke(); c.fillStyle = INK; for (let x = 30; x < 420; x += 36) { c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); } }
    const ray = (xh, yh, col) => { line(c, [[xh - 140 * cs, yh - 140 * sn], [xh, yh], [xh + 140 * cs, yh - 140 * sn]], col, 2); };
    ray(190, y1, '#1f5fbf'); ray(190 + 70, y1 + dp, '#c05a00');
    c.fillStyle = INK; c.textAlign = 'left'; c.fillText('incoming', 30, 22); c.fillText('reflected', 320, 22);
    const pd = 2 * d * Math.sin(th), n = pd / lam, near = Math.abs(n - Math.round(n)) < 0.03 && Math.round(n) >= 1;
    c.fillStyle = near ? '#1b7a2b' : INK; c.font = 'bold 12px "IBM Plex Mono", monospace'; c.fillText(near ? 'constructive: n = ' + Math.round(n) : 'not a Bragg angle', 30, 368); c.font = '11px "IBM Plex Mono", monospace';
    /* intensity vs theta */
    const gx0 = 470, gx1 = 745, gy0 = 330, gh = 270; axes(c, gx0, gy0, gx1, gy0 - gh);
    const pts = []; for (let i = 0; i <= 540; i++) { const a = 0.2 + i / 540 * 89.6; pts.push([gx0 + a / 90 * (gx1 - gx0), gy0 - SIM.braggI(a * PI / 180, d, lam, N) * gh]); }
    line(c, pts, ACC, 1.5);
    SIM.braggAngles(d, lam).forEach(b => { const x = gx0 + b[1] / 90 * (gx1 - gx0); c.strokeStyle = 'rgba(1,57,56,.3)'; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(x, gy0); c.lineTo(x, gy0 - gh); c.stroke(); c.setLineDash([]); c.fillStyle = INK; c.textAlign = 'center'; c.fillText('n=' + b[0], x, gy0 + 14); });
    const xm = gx0 + v('br-t') / 90 * (gx1 - gx0); c.strokeStyle = '#1b7a2b'; c.lineWidth = 2; c.beginPath(); c.moveTo(xm, gy0); c.lineTo(xm, gy0 - gh); c.stroke(); c.lineWidth = 1;
    c.fillStyle = INK; c.textAlign = 'center'; c.fillText('glancing angle \u03b8 (0\u201390\u00b0)', (gx0 + gx1) / 2, 360); c.textAlign = 'right'; c.fillText('I', gx0 - 4, gy0 - gh + 8);
    set('br-pd', f(pd) + ' Å  (= ' + f(n) + ' λ)'); set('br-n', f(n)); set('br-c', near ? 'Constructive — a diffraction peak' : 'Between peaks — waves partly cancel');
    set('br-an', SIM.braggAngles(d, lam).map(b => 'n=' + b[0] + ': ' + f(b[1]) + '°').join('   ') || 'none (λ > 2d)');
  }

  peReset(); drawWv(); phRead(); drawIV(); drawBr(); requestAnimationFrame(drawPh);
})();
