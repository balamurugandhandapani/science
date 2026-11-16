/* ==============================
   Simulation gallery (original code)
   Coloured boxes with a live animated preview for every simulation.
   Click a box -> opens that simulation; "All simulations" returns here.
   Deep links: Simulations.html#pe  (pe wv ph br pj sp rd bb hy dc)
============================== */
(function () {
  const $ = id => document.getElementById(id), root = $('simGallery'); if (!root) return;
  const SIMS = [
    { id: 'pe', t: 'Pendulum Lab', cat: 'Mechanics', d: 'Swing it on any planet and measure the period.', a: '#4568dc', b: '#b06ab3' },
    { id: 'pj', t: 'Projectile + Air', cat: 'Mechanics', d: 'Fire a ball and see what air resistance does.', a: '#cb2d3e', b: '#ef473a' },
    { id: 'sp', t: 'Mass & Spring', cat: 'Mechanics', d: 'Hooke\u2019s law, damping and energy swapping.', a: '#0083b0', b: '#00b4db' },
    { id: 'wv', t: 'Double Slit', cat: 'Waves & Light', d: 'Light waves add up into bright and dark fringes.', a: '#8e2de2', b: '#4a00e0' },
    { id: 'bb', t: 'Blackbody Spectrum', cat: 'Waves & Light', d: 'Heat an object and watch its colour and spectrum.', a: '#f12711', b: '#f5af19' },
    { id: 'ph', t: 'Photoelectric Effect', cat: 'Quantum & Atoms', d: 'Which colours of light can free electrons from metal?', a: '#f7971e', b: '#d9a300' },
    { id: 'hy', t: 'Hydrogen Atom', cat: 'Quantum & Atoms', d: 'Electron jumps make the Balmer lines.', a: '#2b32b2', b: '#1488cc' },
    { id: 'rd', t: 'Radioactive Decay', cat: 'Quantum & Atoms', d: 'Random decays follow a smooth half-life curve.', a: '#5aa00a', b: '#b5d33d' },
    { id: 'br', t: 'Bragg Diffraction', cat: 'Crystals & Circuits', d: 'When do X-rays reflect from atomic planes?', a: '#134e5e', b: '#4fae8a' },
    { id: 'dc', t: 'DC Circuit', cat: 'Crystals & Circuits', d: 'Series and parallel resistors with flowing current.', a: '#f953c6', b: '#b91d73' }
  ];
  const CATS = ['All', 'Mechanics', 'Waves & Light', 'Quantum & Atoms', 'Crystals & Circuits'];
  const TAU = Math.PI * 2;

  /* ---------- animated previews: (ctx, W, H, t seconds) ---------- */
  const W = 260, H = 150;
  const D = {
    pe(c, t) { const px = W / 2, py = 10, L = 108, a = 0.75 * Math.cos(t * 2.8), bx = px + L * Math.sin(a), by = py + L * Math.cos(a);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.setLineDash([3, 4]); c.beginPath(); c.arc(px, py, L, Math.PI / 2 - .75, Math.PI / 2 + .75); c.stroke(); c.setLineDash([]);
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(px, py); c.lineTo(bx, by); c.stroke(); c.fillStyle = '#fff'; c.fillRect(px - 40, 5, 80, 5); c.beginPath(); c.arc(bx, by, 11, 0, 7); c.fill(); },
    pj(c, t) { const u = (t * 0.35) % 1, X = v => 14 + v * (W - 28), Y = v => H - 18 - 4 * 66 * v * (1 - v) * (1 + 0.1 * v);
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.5; c.setLineDash([4, 4]); c.beginPath(); for (let i = 0; i <= 40; i++) { const v = i / 40; const x = X(v), y = H - 18 - 4 * 70 * v * (1 - v); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.setLineDash([]);
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 40; i++) { const v = i / 40 * 0.93; i ? c.lineTo(X(v), Y(v)) : c.moveTo(X(v), Y(v)); } c.stroke();
      const v = u * 0.93; c.fillStyle = '#fff'; c.beginPath(); c.arc(X(v), Y(v), 8, 0, 7); c.fill(); c.fillRect(8, H - 14, W - 16, 3); },
    sp(c, t) { const y = 96 + 28 * Math.cos(t * 3.9); c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(W / 2 - 45, 6, 90, 6); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(W / 2, 12);
      for (let i = 1; i <= 10; i++) c.lineTo(W / 2 + (i % 2 ? -14 : 14), 12 + (y - 42) * i / 10); c.lineTo(W / 2, y - 14); c.stroke(); c.fillStyle = '#fff'; c.fillRect(W / 2 - 24, y - 14, 48, 28); },
    wv(c, t) { const lam = 470 + 130 * (0.5 + 0.5 * Math.sin(t * 0.9));
      for (let x = 0; x < W; x += 2) { const u = (x - W / 2) / W * 14, I = Math.cos(u * (520 / lam) * Math.PI) ** 2 * Math.exp(-u * u / 40); c.fillStyle = SIM.rgb(lam, I); c.fillRect(x, 16, 2, H - 32); }
      c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x <= W; x += 2) { const u = (x - W / 2) / W * 14, I = Math.cos(u * (520 / lam) * Math.PI) ** 2 * Math.exp(-u * u / 40); x ? c.lineTo(x, H - 18 - I * 52) : c.moveTo(x, H - 18 - I * 52); } c.stroke(); },
    bb(c, t) { const T = 3200 + 2800 * (0.5 + 0.5 * Math.sin(t * 0.9)), X = l => 14 + (l - 100) / 2000 * (W - 28);
      for (let l = 380; l <= 750; l += 3) { c.fillStyle = SIM.rgb(l, 0.5); c.fillRect(X(l), 10, 1.6, H - 30); }
      let mx = 0; for (let l = 100; l <= 2100; l += 25) mx = Math.max(mx, SIM2.planck(l * 1e-9, T));
      c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); for (let l = 100; l <= 2100; l += 25) { const y = H - 14 - (H - 44) * SIM2.planck(l * 1e-9, T) / mx; l === 100 ? c.moveTo(X(l), y) : c.lineTo(X(l), y); } c.stroke();
      c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.fillText(Math.round(T / 10) * 10 + ' K', 106, 22); },
    ph(c, t) { c.fillStyle = 'rgba(255,255,255,.8)'; c.fillRect(24, 12, 14, H - 24); c.fillRect(W - 38, 12, 14, H - 24);
      for (let i = 0; i < 7; i++) { const u = (t * 0.55 + i / 7) % 1, y = 22 + ((i * 37) % (H - 50));
        if (u < 0.4) { const x = -10 + u / 0.4 * 40; c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 12, y - 7); c.lineTo(x, y); c.stroke(); }
        else { const x = 40 + (u - 0.4) / 0.6 * (W - 80); c.fillStyle = '#cdf3ff'; c.beginPath(); c.arc(x, y, 4.5, 0, 7); c.fill(); } } },
    hy(c, t) { const ys = [124, 84, 62, 48], ph = (t * 0.6) % 1;
      for (let i = 0; i < 4; i++) { c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 2; c.beginPath(); c.moveTo(30, ys[i]); c.lineTo(150, ys[i]); c.stroke(); }
      const y = ph < 0.5 ? ys[2] : ys[2] + (ys[1] - ys[2]) * Math.min(1, (ph - 0.5) * 4); c.fillStyle = '#fff'; c.beginPath(); c.arc(90, y, 7, 0, 7); c.fill();
      if (ph >= 0.5) { c.strokeStyle = '#ff6b6b'; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 70; i++) { const x = 104 + i * 1.9 + (ph - 0.5) * 50, yy = ys[1] + Math.sin(i * 0.8) * 7 * (1 - i / 80); i ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.stroke(); } },
    rd(c, t) { const rem = Math.pow(2, -(t % 9) / 2.2); let n = 0;
      for (let i = 0; i < 60; i++) { const r = ((i * 9301 + 49297) % 233280) / 233280, alive = r < rem; if (alive) n++; c.fillStyle = alive ? '#fff' : 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(22 + (i % 10) * 24, 26 + Math.floor(i / 10) * 20, 6, 0, 7); c.fill(); }
      c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.fillText(n + ' left', 12, H - 8); },
    br(c, t) { const th = 0.35 + 0.2 * Math.sin(t * 1.2), d = 34;
      for (let k = 0; k < 3; k++) for (let x = 20; x < W - 10; x += 26) { c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(x, 70 + k * d, 5, 0, 7); c.fill(); }
      const ray = (xh, yh, col) => { c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.moveTo(xh - 70 * Math.cos(th), yh - 70 * Math.sin(th)); c.lineTo(xh, yh); c.lineTo(xh + 70 * Math.cos(th), yh - 70 * Math.sin(th)); c.stroke(); };
      ray(100, 70, '#fff'); ray(150, 70 + d, '#ffe9a8'); },
    dc(c, t) { const a = W - 60, b = H - 60, len = 2 * (a + b); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(30, 30); c.lineTo(W - 30, 30); c.lineTo(W - 30, H - 30); c.lineTo(30, H - 30); c.lineTo(30, 30); c.stroke();
      c.clearRect(95, 20, 80, 20); c.beginPath(); c.moveTo(95, 30); for (let i = 0; i < 8; i++) c.lineTo(95 + (i + .5) * 10, 30 + (i % 2 ? 9 : -9)); c.lineTo(175, 30); c.stroke();
      c.clearRect(22, H / 2 - 14, 16, 28); c.lineWidth = 3; c.beginPath(); c.moveTo(20, H / 2 - 5); c.lineTo(40, H / 2 - 5); c.stroke(); c.lineWidth = 6; c.beginPath(); c.moveTo(25, H / 2 + 6); c.lineTo(35, H / 2 + 6); c.stroke();
      c.fillStyle = '#cdf3ff'; for (let k = 0; k < 16; k++) { let s = ((k / 16 + t * 0.22) % 1) * len, x, y; if (s < a) { x = 30 + s; y = 30; } else if ((s -= a) < b) { x = W - 30; y = 30 + s; } else if ((s -= b) < a) { x = W - 30 - s; y = H - 30; } else { s -= a; x = 30; y = H - 30 - s; } c.beginPath(); c.arc(x, y, 3.6, 0, 7); c.fill(); } }
  };

  /* ---------- build the gallery ---------- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  root.innerHTML = '<div class="sim-filters" role="group" aria-label="Filter simulations">' + CATS.map((c, i) => '<button type="button" class="sim-chip' + (i ? '' : ' on') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>' +
    '<div class="sim-grid">' + SIMS.map(s => '<button type="button" class="sim-card" data-id="' + s.id + '" data-cat="' + esc(s.cat) + '" style="--a:' + s.a + ';--b:' + s.b + '" aria-label="Open the ' + esc(s.t) + ' simulation">' +
      '<canvas width="' + W * 2 + '" height="' + H * 2 + '" aria-hidden="true"></canvas><span class="go" aria-hidden="true">&#9654;</span>' +
      '<span class="meta"><span class="tag">' + esc(s.cat) + '</span><strong class="ttl">' + esc(s.t) + '</strong><span class="dsc">' + esc(s.d) + '</span></span></button>').join('') + '</div>';
  const cards = Array.from(root.querySelectorAll('.sim-card')), ctxs = cards.map(c => { const x = c.querySelector('canvas').getContext('2d'); x.scale(2, 2); return x; });
  root.querySelectorAll('.sim-chip').forEach(b => b.addEventListener('click', () => {
    root.querySelectorAll('.sim-chip').forEach(x => x.classList.toggle('on', x === b));
    cards.forEach(c => { c.hidden = b.dataset.cat !== 'All' && c.dataset.cat !== b.dataset.cat; });
  }));
  cards.forEach(c => c.addEventListener('click', () => { location.hash = c.dataset.id; }));

  /* ---------- panel banners (same colours as the card) ---------- */
  const panels = {}; SIMS.forEach((s, i) => {
    const p = $('panel-' + s.id); if (!p) return; panels[s.id] = p; p.style.setProperty('--a', s.a); p.style.setProperty('--b', s.b);
    const prev = SIMS[(i + SIMS.length - 1) % SIMS.length], next = SIMS[(i + 1) % SIMS.length], bn = document.createElement('div'); bn.className = 'sim-banner';
    bn.innerHTML = '<button type="button" class="sim-back">&larr; All simulations</button><div class="sim-bt"><span class="tag">' + esc(s.cat) + '</span><b>' + esc(s.t) + '</b></div>' +
      '<div class="sim-nav"><button type="button" data-go="' + prev.id + '" aria-label="Previous: ' + esc(prev.t) + '" title="' + esc(prev.t) + '">&lsaquo;</button><button type="button" data-go="' + next.id + '" aria-label="Next: ' + esc(next.t) + '" title="' + esc(next.t) + '">&rsaquo;</button></div>';
    p.querySelector('.calc-card').prepend(bn);
    bn.querySelector('.sim-back').addEventListener('click', () => { location.hash = ''; });
    bn.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { location.hash = b.dataset.go; }));
  });

  function route() {
    const id = location.hash.slice(1), open = panels[id];
    ['pe-go', 'sp-go', 'rd-go'].forEach(b => { const e = $(b); if (e && e.textContent.includes('Pause')) e.click(); });   /* pause anything still running */
    Object.values(panels).forEach(p => p.classList.remove('active'));
    root.hidden = !!open; $('explorer').classList.toggle('sim-open', !!open);
    if (open) { open.classList.add('active'); const s = SIMS.find(x => x.id === id); document.title = s.t + ' | Physics Simulations | Balamurugan Dhandapani'; window.scrollTo({ top: 0 }); }
    else document.title = 'Physics Simulations | Balamurugan Dhandapani';
  }
  window.addEventListener('hashchange', route); route();

  /* ---------- animation loop (static frame if the visitor prefers reduced motion) ---------- */
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(ms) {
    if (!root.hidden && !document.hidden) { const t = ms / 1000;
      cards.forEach((card, i) => { if (card.hidden) return; const c = ctxs[i]; c.clearRect(0, 0, W, H); c.save(); D[card.dataset.id](c, still ? 1.2 : t); c.restore(); }); }
    if (!still) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
