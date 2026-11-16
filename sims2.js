/* ==============================
   More Physics Simulations (original code)
   Projectile + air drag - Mass-spring - Radioactive decay
   Blackbody spectrum - Hydrogen (Bohr) - DC circuit
   Pure physics in SIM2 (testable in Node); drawing is browser-only.
============================== */
const SIM2 = (function () {
  const PI = Math.PI, H = 6.62607015e-34, C = 299792458, KB = 1.380649e-23;       /* exact SI 2019 */
  const HCeV = 1239.841984, ME = 9.1093837139e-31, MP = 1.67262192595e-27, RINF = 10973731.568157; /* CODATA 2022 */
  const SIGMA = 2 * PI ** 5 * KB ** 4 / (15 * H ** 3 * C ** 2);
  const WIEN = H * C / (KB * 4.965114231744276);                                     /* m K */
  const RH = RINF / (1 + ME / MP);                                                   /* hydrogen Rydberg, m^-1 */

  /* ---- projectile, optional quadratic drag (RK4); stores a point every 0.01 s ---- */
  function flight(v0, aDeg, h0, g, m, dia, Cd, drag) {
    const k = drag ? 0.5 * 1.225 * Cd * PI * (dia / 2) ** 2 / m : 0, a = aDeg * PI / 180, dt = 0.002;
    let s = [0, h0, v0 * Math.cos(a), v0 * Math.sin(a)], t = 0, n = 0, Hm = h0;
    const d = q => { const sp = Math.hypot(q[2], q[3]); return [q[2], q[3], -k * sp * q[2], -g - k * sp * q[3]]; };
    const ad = (q, r, h) => q.map((x, i) => x + h * r[i]);
    const pts = [[0, h0, 0]];
    while (t < 900) {
      const k1 = d(s), k2 = d(ad(s, k1, dt / 2)), k3 = d(ad(s, k2, dt / 2)), k4 = d(ad(s, k3, dt));
      const nx = s.map((x, i) => x + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      if (nx[1] < 0) { const f = s[1] / (s[1] - nx[1]); t += dt * f; pts.push([s[0] + (nx[0] - s[0]) * f, 0, t]); s = [s[0] + (nx[0] - s[0]) * f, 0, s[2] + (nx[2] - s[2]) * f, s[3] + (nx[3] - s[3]) * f]; break; }
      s = nx; t += dt; n++; Hm = Math.max(Hm, s[1]);
      if (n % 5 === 0) pts.push([s[0], s[1], t]);
    }
    return { pts, T: t, R: s[0], H: Hm, vImpact: Math.hypot(s[2], s[3]) };
  }
  const vacuum = (v0, aDeg, h0, g) => { const a = aDeg * PI / 180, vy = v0 * Math.sin(a); const T = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g; return { T, R: v0 * Math.cos(a) * T, H: h0 + (vy > 0 ? vy * vy / (2 * g) : 0) }; };

  /* ---- mass on a spring: m x'' = -k x - b x'  (x from equilibrium) ---- */
  function springStep(x, v, dt, k, m, b) {
    const acc = (xx, vv) => (-k * xx - b * vv) / m;
    const k1x = v,                  k1v = acc(x, v);
    const k2x = v + dt / 2 * k1v,   k2v = acc(x + dt / 2 * k1x, v + dt / 2 * k1v);
    const k3x = v + dt / 2 * k2v,   k3v = acc(x + dt / 2 * k2x, v + dt / 2 * k2v);
    const k4x = v + dt * k3v,       k4v = acc(x + dt * k3x, v + dt * k3v);
    return [x + dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x), v + dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v)];
  }

  /* ---- radioactive decay ---- */
  const decayProb = (dt, half) => 1 - Math.pow(2, -dt / half);

  /* ---- blackbody ---- */
  const planck = (lamM, T) => 2 * H * C * C / lamM ** 5 / Math.expm1(H * C / (lamM * KB * T));   /* W m^-3 sr^-1 */
  const rayleigh = (lamM, T) => 2 * C * KB * T / lamM ** 4;
  const wienPeakNm = T => WIEN / T * 1e9;
  const exitance = T => SIGMA * T ** 4;                                                           /* W m^-2 */
  function visibleFraction(T) { let s = 0; for (let l = 380; l < 750; l += 1) s += planck((l + 0.5) * 1e-9, T) * 1e-9; return s * PI / exitance(T); }

  /* ---- hydrogen (Bohr model with reduced mass) ---- */
  const hLevel = n => -HCeV * 1e-9 * RH / (n * n);                                                // eV
  function hLine(ni, nf) { const dE = hLevel(ni) - hLevel(nf); return { dE, lam: HCeV / dE }; }   // photon energy (eV) and vacuum wavelength (nm), ni > nf
  const hRadius = n => n * n * 0.529177210544;                                                    // Angstrom (n^2 a0)

  /* ---- DC circuit, two resistors ---- */
  function circuit(V, R1, R2, mode) {
    if (mode === 'series') { const Re = R1 + R2, I = V / Re; return { Re, I, I1: I, I2: I, V1: I * R1, V2: I * R2, P1: I * I * R1, P2: I * I * R2, P: V * I }; }
    const Re = R1 * R2 / (R1 + R2), I1 = V / R1, I2 = V / R2, I = I1 + I2;
    return { Re, I, I1, I2, V1: V, V2: V, P1: V * I1, P2: V * I2, P: V * I };
  }
  return { flight, vacuum, springStep, decayProb, planck, rayleigh, wienPeakNm, exitance, visibleFraction, hLevel, hLine, hRadius, circuit, SIGMA, WIEN, RH, HCeV };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SIM2;

if (typeof document !== 'undefined') (function () {
  const U = window.SIMUI, $ = U.$, v = U.v, f = U.f, T = U.T, ctl = U.ctl, table = U.table, set = U.set, axes = U.axes, line = U.line, clear = U.clear, INK = U.INK, ACC = U.ACC, PI = Math.PI;
  const raf = fn => { let last = 0; const loop = ts => { fn(Math.min(0.05, (ts - last) / 1000 || 0.016)); last = ts; requestAnimationFrame(loop); }; requestAnimationFrame(loop); };
  const toggle = (btn, st, startFn) => $(btn).addEventListener('click', () => { st.run = !st.run; $(btn).innerHTML = st.run ? '&#10074;&#10074; Pause' : '&#9654; Start'; if (startFn) startFn(); });

  /* ================= PROJECTILE + DRAG ================= */
  const pj = { fl: null, vac: null, t: 0, run: false };
  ctl('pj-ctl', [['pj-v', 'Launch speed v<sub>0</sub>', 1, 60, 1, 25, 'm/s'], ['pj-a', 'Angle &alpha;', 0, 90, 1, 45, '&deg;'], ['pj-h', 'Launch height h<sub>0</sub>', 0, 20, 0.5, 0, 'm'],
    ['pj-m', 'Mass m', 0.05, 10, 0.05, 1, 'kg'], ['pj-d', 'Diameter', 0.02, 0.5, 0.01, 0.1, 'm']], pjCalc);
  $('pj-g').addEventListener('change', pjCalc); $('pj-air').addEventListener('change', pjCalc);
  table('pj-out', [['Range (with chosen air setting) ' + T('R'), 'pj-R', true], ['Maximum height ' + T('H'), 'pj-H'], ['Time of flight ' + T('t'), 'pj-T'], ['Impact speed', 'pj-vi'],
    ['Same shot in a vacuum: range', 'pj-Rv'], ['Same shot in a vacuum: height', 'pj-Hv']]);
  function pjCalc() {
    const g = v('pj-g'), drag = $('pj-air').value === 'on';
    pj.fl = SIM2.flight(v('pj-v'), v('pj-a'), v('pj-h'), g, v('pj-m'), v('pj-d'), 0.47, drag); pj.vac = SIM2.vacuum(v('pj-v'), v('pj-a'), v('pj-h'), g);
    pj.t = 0; set('pj-R', f(pj.fl.R) + ' m'); set('pj-H', f(pj.fl.H) + ' m'); set('pj-T', f(pj.fl.T) + ' s'); set('pj-vi', f(pj.fl.vImpact) + ' m/s');
    set('pj-Rv', f(pj.vac.R) + ' m'); set('pj-Hv', f(pj.vac.H) + ' m'); drawPj();
  }
  function drawPj() {
    const cv = $('pj-cv'), c = clear(cv), p = pj.fl, x0 = 60, y0 = 270, W = 680, Hh = 235;
    const xm = Math.max(p.R, pj.vac.R, 1) * 1.08, ym = Math.max(p.H, pj.vac.H, 1) * 1.2, sc = Math.min(W / xm, Hh / ym);
    axes(c, x0, y0, x0 + W, y0 - Hh); c.fillStyle = INK; c.textAlign = 'center';
    for (let i = 0; i <= 4; i++) { const xv = xm * i / 4; c.fillText(f(+xv.toPrecision(3)), x0 + xv * sc, y0 + 14); }
    c.textAlign = 'right'; for (let i = 0; i <= 3; i++) { const yv = ym * i / 3; c.fillText(f(+yv.toPrecision(3)), x0 - 5, y0 - yv * sc + 4); }
    c.textAlign = 'center'; c.fillText('distance x (m)', x0 + W / 2, 296);
    const vp = []; for (let i = 0; i <= 120; i++) { const t = pj.vac.T * i / 120, a = v('pj-a') * PI / 180; vp.push([x0 + v('pj-v') * Math.cos(a) * t * sc, y0 - Math.max(0, v('pj-h') + v('pj-v') * Math.sin(a) * t - 0.5 * v('pj-g') * t * t) * sc]); }
    c.setLineDash([5, 4]); line(c, vp, 'rgba(1,57,56,.55)', 1.5); c.setLineDash([]);
    line(c, p.pts.map(q => [x0 + q[0] * sc, y0 - q[1] * sc]), ACC, 2.5);
    let i = 0; while (i < p.pts.length - 1 && p.pts[i + 1][2] <= pj.t) i++; const q = p.pts[Math.min(i, p.pts.length - 1)];
    c.fillStyle = ACC; c.beginPath(); c.arc(x0 + q[0] * sc, y0 - q[1] * sc, 6, 0, 7); c.fill();
    c.fillStyle = INK; c.textAlign = 'left'; c.fillText('solid: chosen air setting    dashed: vacuum', x0 + 10, 20);
  }
  $('pj-go').addEventListener('click', () => { pj.t = 0; pj.run = true; });
  raf(dt => { if (pj.run && U.visible('pj')) { pj.t += dt; if (pj.t > pj.fl.T + 0.5) { pj.run = false; pj.t = pj.fl.T; } drawPj(); } });

  /* ================= MASS-SPRING ================= */
  const sp = { x: 0, v: 0, t: 0, run: false, hist: [], up: null, Tm: null };
  ctl('sp-ctl', [['sp-k', 'Spring constant k', 5, 100, 1, 25, 'N/m'], ['sp-m', 'Mass m', 0.1, 5, 0.1, 1, 'kg'], ['sp-b', 'Damping b', 0, 3, 0.05, 0, 'kg/s'], ['sp-A', 'Start displacement', 0.05, 0.4, 0.01, 0.2, 'm']],
    id => { if (id === 'sp-A') spReset(); spRead(); drawSp(); });
  table('sp-out', [[T('x'), 'sp-x'], [T('v'), 'sp-v'], [T('K=\\tfrac12 mv^{2}'), 'sp-K'], [T('U=\\tfrac12 kx^{2}'), 'sp-U'], ['Total energy', 'sp-E'],
    [T('\\omega=\\sqrt{k/m}'), 'sp-w'], [T('T=2\\pi\\sqrt{m/k}'), 'sp-T', true], ['Period measured in this run', 'sp-Tm', true]]);
  function spReset() { sp.x = v('sp-A'); sp.v = 0; sp.t = 0; sp.hist = []; sp.up = null; sp.Tm = null; spRead(); drawSp(); }
  function spRead() {
    const k = v('sp-k'), m = v('sp-m'), K = 0.5 * m * sp.v * sp.v, Ue = 0.5 * k * sp.x * sp.x;
    set('sp-x', f(sp.x) + ' m'); set('sp-v', f(sp.v) + ' m/s'); set('sp-K', f(K) + ' J'); set('sp-U', f(Ue) + ' J'); set('sp-E', f(K + Ue) + ' J');
    set('sp-w', f(Math.sqrt(k / m)) + ' rad/s'); set('sp-T', f(2 * PI * Math.sqrt(m / k)) + ' s'); set('sp-Tm', sp.Tm ? f(sp.Tm) + ' s' : 'run the simulation');
  }
  function drawSp() {
    const cv = $('sp-cv'), c = clear(cv), S = 300, ye = 170, ym = ye + sp.x * S, top = 28;
    c.fillStyle = '#e6ecec'; c.fillRect(60, top - 8, 160, 8); c.strokeStyle = 'rgba(1,57,56,.3)'; c.setLineDash([4, 4]); c.beginPath(); c.moveTo(40, ye); c.lineTo(250, ye); c.stroke(); c.setLineDash([]);
    const pts = [[140, top]]; for (let i = 1; i < 12; i++) pts.push([140 + (i % 2 ? -16 : 16), top + 12 + (ym - 20 - top - 12) * (i / 12)]); pts.push([140, ym - 20]);
    line(c, [[140, top], [140, top + 12], ...pts.slice(1), [140, ym - 20]], INK, 2);
    c.fillStyle = ACC; c.fillRect(110, ym - 20, 60, 32); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(f(v('sp-m')) + ' kg', 140, ym + 1);
    c.fillStyle = INK; c.textAlign = 'left'; c.fillText('equilibrium', 255, ye + 4);
    const gx0 = 340, gx1 = 745, gy = 150, amp = v('sp-A') * 1.15; axes(c, gx0, gy + 125, gx1, gy - 125); c.strokeStyle = 'rgba(1,57,56,.25)'; c.beginPath(); c.moveTo(gx0, gy); c.lineTo(gx1, gy); c.stroke();
    c.fillStyle = INK; c.textAlign = 'right'; c.fillText(f(amp) + ' m', gx0 - 4, gy - 120); c.fillText('0', gx0 - 4, gy + 4); c.fillText('-' + f(amp), gx0 - 4, gy + 128); c.textAlign = 'center'; c.fillText('time (last 8 s)', (gx0 + gx1) / 2, 305);
    const t1 = sp.t, t0 = Math.max(0, t1 - 8), win = Math.max(8, t1 - t0), pp = sp.hist.filter(h => h[0] >= t0).map(h => [gx0 + (h[0] - t0) / win * (gx1 - gx0), gy - h[1] / amp * 120]);
    if (pp.length > 1) line(c, pp, ACC, 2); else { c.fillText('press Start', (gx0 + gx1) / 2, gy - 20); }
  }
  toggle('sp-go', sp); $('sp-rs').addEventListener('click', spReset);
  raf(dt => {
    if (!sp.run || !U.visible('sp')) return; const n = Math.ceil(dt / 0.004);
    for (let i = 0; i < n; i++) { const h = dt / n, p = sp.x; [sp.x, sp.v] = SIM2.springStep(sp.x, sp.v, h, v('sp-k'), v('sp-m'), v('sp-b')); sp.t += h;
      if (p < 0 && sp.x >= 0 && sp.v > 0) { const tc = sp.t - h * sp.x / (sp.x - p); if (sp.up !== null) sp.Tm = tc - sp.up; sp.up = tc; } sp.hist.push([sp.t, sp.x]); if (sp.hist.length > 4000) sp.hist.shift(); }
    spRead(); drawSp();
  });

  /* ================= RADIOACTIVE DECAY ================= */
  const rd = { atoms: [], t: 0, run: false, hist: [] };
  ctl('rd-ctl', [['rd-N', 'Number of atoms N<sub>0</sub>', 25, 900, 25, 400, ''], ['rd-h', 'Half-life t<sub>1/2</sub>', 1, 20, 0.5, 5, 's']], id => { if (id === 'rd-N') rdReset(); rdRead(); drawRd(); });
  table('rd-out', [['Time ' + T('t'), 'rd-t'], ['Atoms remaining ' + T('N'), 'rd-n', true], ['Expected ' + T('N_0 2^{-t/t_{1/2}}'), 'rd-e', true], ['Decay constant ' + T('\\lambda=\\ln 2/t_{1/2}'), 'rd-l'],
    ['Mean lifetime ' + T('\\tau=1/\\lambda'), 'rd-tau'], ['Activity ' + T('A=\\lambda N'), 'rd-a']]);
  function rdReset() { const n = v('rd-N'); rd.atoms = new Array(n).fill(true); rd.t = 0; rd.hist = [[0, n]]; rdRead(); drawRd(); }
  const rdLeft = () => rd.atoms.reduce((s, a) => s + (a ? 1 : 0), 0);
  function rdRead() {
    const N = rdLeft(), N0 = v('rd-N'), h = v('rd-h'), lam = Math.LN2 / h;
    set('rd-t', f(rd.t) + ' s'); set('rd-n', N + ' of ' + N0 + ' (' + f(N / N0 * 100) + ' %)'); set('rd-e', f(N0 * Math.pow(2, -rd.t / h)));
    set('rd-l', f(lam) + ' s⁻¹'); set('rd-tau', f(1 / lam) + ' s'); set('rd-a', f(lam * N) + ' decays/s');
  }
  function drawRd() {
    const cv = $('rd-cv'), c = clear(cv), N0 = rd.atoms.length, cols = Math.ceil(Math.sqrt(N0 * 1.4)), rows = Math.ceil(N0 / cols), cell = Math.min(300 / cols, 270 / rows);
    rd.atoms.forEach((a, i) => { c.fillStyle = a ? ACC : '#d7dede'; c.beginPath(); c.arc(30 + (i % cols + 0.5) * cell, 20 + (Math.floor(i / cols) + 0.5) * cell, Math.max(1.5, cell * 0.36), 0, 7); c.fill(); });
    const gx0 = 400, gx1 = 745, gy0 = 290, gh = 250, h = v('rd-h'), tmax = Math.max(h * 5, rd.t * 1.05); axes(c, gx0, gy0, gx1, gy0 - gh);
    const X = t => gx0 + t / tmax * (gx1 - gx0), Y = n => gy0 - n / N0 * gh, ex = []; for (let i = 0; i <= 120; i++) { const t = tmax * i / 120; ex.push([X(t), Y(N0 * Math.pow(2, -t / h))]); }
    c.setLineDash([5, 4]); line(c, ex, INK, 1.5); c.setLineDash([]); if (rd.hist.length > 1) line(c, rd.hist.map(p => [X(p[0]), Y(p[1])]), ACC, 2.5);
    c.fillStyle = INK; c.textAlign = 'center'; for (let k = 1; k <= 5; k++) if (k * h <= tmax) c.fillText(k + ' t½', Math.min(X(k * h), gx1 - 8), gy0 + 14);
    c.fillText('time (dashed = expected curve, solid = this run)', (gx0 + gx1) / 2, 326); c.textAlign = 'right'; c.fillText(N0 + '', gx0 - 4, gy0 - gh + 6); c.fillText('N/2', gx0 - 4, Y(N0 / 2) + 4);
  }
  toggle('rd-go', rd); $('rd-rs').addEventListener('click', rdReset);
  raf(dt => {
    if (!rd.run || !U.visible('rd')) return; const p = SIM2.decayProb(dt, v('rd-h'));
    rd.atoms = rd.atoms.map(a => a && Math.random() >= p); rd.t += dt; rd.hist.push([rd.t, rdLeft()]); if (rd.hist.length > 6000) rd.hist.shift(); rdRead(); drawRd();
  });

  /* ================= BLACKBODY ================= */
  ctl('bb-ctl', [['bb-T', 'Temperature T', 300, 12000, 2, 5772, 'K']], drawBb);
  $('bb-rj').addEventListener('change', drawBb);
  table('bb-out', [['Peak wavelength ' + T('\\lambda_{\\max}=b/T'), 'bb-pk', true], ['Total power per area ' + T('\\sigma T^{4}'), 'bb-j'], ['Share emitted as visible light (380&ndash;750 nm)', 'bb-vis'], ['Approximate colour', 'bb-col']]);
  function drawBb() {
    const cv = $('bb-cv'), c = clear(cv), Tk = v('bb-T'), x0 = 60, x1 = 740, y0 = 290, gh = 250, lmax = 3000, lmin = 100;
    const X = l => x0 + (l - lmin) / (lmax - lmin) * (x1 - x0); let top = 0; for (let l = lmin; l <= lmax; l += 10) top = Math.max(top, SIM2.planck(l * 1e-9, Tk)); const Y = b => y0 - b / top * gh;
    for (let l = 380; l <= 750; l += 2) { c.fillStyle = SIM.rgb(l, 0.35); c.fillRect(X(l), y0 - gh, X(l + 2) - X(l) + 0.5, gh); }
    axes(c, x0, y0, x1, y0 - gh); const pl = [], rj = []; for (let l = lmin; l <= lmax; l += 5) { pl.push([X(l), Y(SIM2.planck(l * 1e-9, Tk))]); const r = Y(SIM2.rayleigh(l * 1e-9, Tk)); rj.push([X(l), Math.max(y0 - gh - 5, r)]); }
    if ($('bb-rj').value === 'on') { c.setLineDash([5, 4]); line(c, rj, 'rgba(1,57,56,.7)', 1.5); c.setLineDash([]); }
    line(c, pl, ACC, 2.5); const pk = SIM2.wienPeakNm(Tk);
    if (pk >= lmin && pk <= lmax) { c.strokeStyle = INK; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(X(pk), y0); c.lineTo(X(pk), y0 - gh); c.stroke(); c.setLineDash([]); }
    c.fillStyle = INK; c.textAlign = 'center'; for (let l = 500; l <= 3000; l += 500) c.fillText(l, X(l), y0 + 14); c.fillText('wavelength (nm) \u2014 coloured band = visible light', (x0 + x1) / 2, 316); c.textAlign = 'right'; c.fillText('spectral radiance (scaled to this temperature)', x1 - 6, y0 - gh + 14);
    const vf = SIM2.visibleFraction(Tk); let R = 0, G = 0, B = 0; for (let l = 380; l <= 750; l += 5) { const m = SIM.rgb(l, 1).match(/\d+/g).map(Number), w = SIM2.planck(l * 1e-9, Tk); R += w * m[0]; G += w * m[1]; B += w * m[2]; }
    const mx = Math.max(R, G, B) || 1; const col = 'rgb(' + Math.round(R / mx * 255) + ',' + Math.round(G / mx * 255) + ',' + Math.round(B / mx * 255) + ')';
    set('bb-pk', f(pk) + ' nm' + (pk < 380 ? ' (ultraviolet)' : pk > 750 ? ' (infrared)' : ' (visible)')); set('bb-j', f(SIM2.exitance(Tk)) + ' W/m²'); set('bb-vis', f(vf * 100) + ' %');
    $('bb-col').innerHTML = '<span class="color-swatch" style="background:' + col + ';width:34px"></span>';
  }

  /* ================= HYDROGEN (BOHR) ================= */
  const hy = { ph: 0 };
  ctl('hy-ctl', [['hy-i', 'Upper level n<sub>i</sub>', 2, 7, 1, 3, ''], ['hy-f', 'Lower level n<sub>f</sub>', 1, 6, 1, 2, '']], id => {
    if (v('hy-f') >= v('hy-i')) { if (id === 'hy-i') { $('hy-f').value = v('hy-i') - 1; $('hy-f-v').textContent = $('hy-f').value; } else { $('hy-i').value = v('hy-f') + 1; $('hy-i-v').textContent = $('hy-i').value; } } hyRead(); });
  table('hy-out', [['Energy of the jump ' + T('\\Delta E=E_i-E_f'), 'hy-dE'], ['Photon wavelength ' + T('\\lambda'), 'hy-l', true], ['Spectral series / region', 'hy-s', true], ['Energy of level ' + T('E_{n_i}') + ', ' + T('E_{n_f}'), 'hy-E'],
    ['Orbit radius ' + T('r_n=n^{2}a_0'), 'hy-r']]);
  function hyRead() {
    const ni = v('hy-i'), nf = v('hy-f'), L = SIM2.hLine(ni, nf), ser = { 1: 'Lyman', 2: 'Balmer', 3: 'Paschen', 4: 'Brackett', 5: 'Pfund', 6: 'Humphreys' }[nf];
    set('hy-dE', f(L.dE) + ' eV'); set('hy-l', f(L.lam) + ' nm'); set('hy-s', ser + ' series — ' + (L.lam < 380 ? 'ultraviolet' : L.lam > 750 ? 'infrared' : 'visible'));
    set('hy-E', f(SIM2.hLevel(ni)) + ' eV, ' + f(SIM2.hLevel(nf)) + ' eV'); set('hy-r', f(SIM2.hRadius(ni)) + ' Å → ' + f(SIM2.hRadius(nf)) + ' Å');
  }
  function drawHy(dt) {
    const cv = $('hy-cv'), c = clear(cv), ni = v('hy-i'), nf = v('hy-f'), L = SIM2.hLine(ni, nf); hy.ph = (hy.ph + dt * 0.5) % 1;
    const ey = n => 265 - 36 * (n - 1);                      /* evenly spaced for readability (not to scale) */
    for (let n = 1; n <= 7; n++) { const y = ey(n); c.strokeStyle = n === ni || n === nf ? ACC : 'rgba(1,57,56,.5)'; c.lineWidth = n === ni || n === nf ? 2.5 : 1; c.beginPath(); c.moveTo(20, y); c.lineTo(250, y); c.stroke(); c.fillStyle = INK; c.textAlign = 'left'; c.fillText('n=' + n + '  ' + f(SIM2.hLevel(n)) + ' eV', 256, y + 4); }
    c.lineWidth = 1; const yi = ey(ni), yf = ey(nf), p = hy.ph < 0.5 ? 0 : (hy.ph - 0.5) * 2, ye = hy.ph < 0.5 ? yi : yi + (yf - yi) * Math.min(1, p * 2);
    c.fillStyle = '#1f5fbf'; c.beginPath(); c.arc(135, ye, 7, 0, 7); c.fill();
    const col = L.lam < 380 ? '#7b2fbe' : L.lam > 750 ? '#8b0000' : SIM.rgb(L.lam, 1); if (hy.ph >= 0.5) { c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 60; i++) { const x = 140 + i * 1.4 + p * 40, yy = yf + 6 + Math.sin(i * 0.9) * 8 * (1 - i / 60); i ? c.lineTo(x, yy + 0) : c.moveTo(x, yy); } c.stroke(); c.lineWidth = 1; }
    const sx0 = 430, sx1 = 745, sy = 70; c.fillStyle = '#000'; c.fillRect(sx0, sy, sx1 - sx0, 90); const X = l => sx0 + (l - 380) / 370 * (sx1 - sx0);
    for (let l = 380; l <= 750; l += 2) { c.fillStyle = SIM.rgb(l, 0.12); c.fillRect(X(l), sy, X(l + 2) - X(l) + 0.5, 90); }
    for (let n = 3; n <= 9; n++) { const lm = SIM2.hLine(n, 2).lam; if (lm >= 380 && lm <= 750) { c.fillStyle = SIM.rgb(lm, 1); c.fillRect(X(lm) - 1, sy, 3, 90); } }
    if (L.lam >= 380 && L.lam <= 750) { c.strokeStyle = '#fff'; c.lineWidth = 2; c.strokeRect(X(L.lam) - 5, sy - 4, 10, 98); c.lineWidth = 1; }
    c.fillStyle = INK; c.textAlign = 'center'; c.fillText('Balmer lines (visible), 380\u2013750 nm', (sx0 + sx1) / 2, sy + 112); c.fillText('your jump: ' + f(L.lam) + ' nm', (sx0 + sx1) / 2, sy + 134); c.textAlign = 'left'; c.fillText('levels evenly spaced for clarity (energies listed)', 20, 296);
  }
  raf(dt => { if (U.visible('hy')) drawHy(dt); });

  /* ================= DC CIRCUIT ================= */
  const dc = { off: 0 };
  ctl('dc-ctl', [['dc-V', 'Battery voltage V', 1, 24, 0.5, 12, 'V'], ['dc-1', 'Resistor R<sub>1</sub>', 10, 1000, 10, 100, '&Omega;'], ['dc-2', 'Resistor R<sub>2</sub>', 10, 1000, 10, 200, '&Omega;']], dcRead);
  $('dc-mode').addEventListener('change', dcRead);
  table('dc-out', [['Equivalent resistance ' + T('R_{\\mathrm{eq}}'), 'dc-Re', true], ['Total current ' + T('I=V/R_{\\mathrm{eq}}'), 'dc-I', true], ['Through ' + T('R_1') + ' / ' + T('R_2'), 'dc-Ii'],
    ['Voltage across ' + T('R_1') + ' / ' + T('R_2'), 'dc-Vv'], ['Power in ' + T('R_1') + ' / ' + T('R_2'), 'dc-Pp'], ['Total power ' + T('P=IV'), 'dc-P']]);
  const dcm = () => SIM2.circuit(v('dc-V'), v('dc-1'), v('dc-2'), $('dc-mode').value);
  function dcRead() {
    const r = dcm(), m = (a, b, u) => f(a) + ' ' + u + ' / ' + f(b) + ' ' + u;
    set('dc-Re', f(r.Re) + ' Ω'); set('dc-I', f(r.I * 1000) + ' mA'); set('dc-Ii', m(r.I1 * 1000, r.I2 * 1000, 'mA')); set('dc-Vv', m(r.V1, r.V2, 'V')); set('dc-Pp', m(r.P1 * 1000, r.P2 * 1000, 'mW')); set('dc-P', f(r.P * 1000) + ' mW');
  }
  const erase = (c, x0, y0, x1, y1) => { c.fillStyle = '#fff'; c.fillRect(Math.min(x0, x1) - 4, Math.min(y0, y1) - 4, Math.abs(x1 - x0) + 8, Math.abs(y1 - y0) + 8); };
  function zigH(c, x0, x1, y) { erase(c, x0, y, x1, y); const p = [[x0, y]]; for (let i = 0; i < 8; i++) p.push([x0 + (i + 0.5) / 8 * (x1 - x0), y + (i % 2 ? 10 : -10)]); p.push([x1, y]); line(c, p, INK, 2); }
  function zigV(c, x, y0, y1) { erase(c, x, y0, x, y1); const p = [[x, y0]]; for (let i = 0; i < 8; i++) p.push([x + (i % 2 ? 10 : -10), y0 + (i + 0.5) / 8 * (y1 - y0)]); p.push([x, y1]); line(c, p, INK, 2); }
  function drawDc(dt) {
    const cv = $('dc-cv'), c = clear(cv), r = dcm(), series = $('dc-mode').value === 'series'; dc.off += dt;
    const flow = (pts, I) => {
      let len = 0; const seg = []; for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(d); len += d; }
      const n = Math.max(2, Math.floor(len / 26)), sp = 20 + Math.min(260, I * 600); c.fillStyle = '#1f5fbf';
      for (let k = 0; k < n; k++) { let s = ((k * len / n + dc.off * sp) % len + len) % len, i = 0; while (i < seg.length - 1 && s > seg[i]) { s -= seg[i]; i++; } const a = pts[i], b = pts[i + 1], t = s / seg[i]; c.beginPath(); c.arc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 3.5, 0, 7); c.fill(); }
    };
    c.fillStyle = INK; c.textAlign = 'center';
    if (series) {
      const loop = [[90, 125], [90, 60], [660, 60], [660, 240], [90, 240], [90, 175]]; line(c, loop, INK, 2); zigH(c, 220, 330, 60); zigH(c, 430, 540, 60);
      c.fillText('R1 = ' + v('dc-1') + ' \u03a9', 275, 40); c.fillText('R2 = ' + v('dc-2') + ' \u03a9', 485, 40); flow(loop, r.I);
    } else {
      line(c, [[90, 125], [90, 60], [480, 60]], INK, 2); line(c, [[90, 175], [90, 240], [480, 240]], INK, 2); line(c, [[280, 60], [280, 240]], INK, 2); line(c, [[480, 60], [480, 240]], INK, 2);
      zigV(c, 280, 110, 190); zigV(c, 480, 110, 190); c.fillStyle = INK; c.textAlign = 'left'; c.fillText('R1 = ' + v('dc-1') + ' \u03a9  (' + f(r.I1 * 1000) + ' mA)', 298, 154); c.fillText('R2 = ' + v('dc-2') + ' \u03a9  (' + f(r.I2 * 1000) + ' mA)', 498, 154); c.textAlign = 'center';
      flow([[90, 125], [90, 60], [280, 60]], r.I); flow([[280, 60], [280, 240]], r.I1); flow([[480, 60], [480, 240]], r.I2); flow([[480, 240], [90, 240], [90, 175]], r.I);
    }
    erase(c, 90, 125, 90, 175); c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(76, 134); c.lineTo(104, 134); c.stroke(); c.lineWidth = 7; c.beginPath(); c.moveTo(82, 166); c.lineTo(98, 166); c.stroke(); c.lineWidth = 1;
    c.fillStyle = INK; c.textAlign = 'left'; c.fillText('+', 110, 138); c.fillText('\u2212', 110, 172); c.textAlign = 'right'; c.fillText(f(v('dc-V')) + ' V', 68, 154);
    c.textAlign = 'center'; c.fillText('blue dots = conventional current (+ to \u2212); they move faster when the current is larger', 380, 280);
  }
  raf(dt => { if (U.visible('dc')) drawDc(dt); });

  pjCalc(); spReset(); rdReset(); drawBb(); hyRead(); dcRead();
})();
