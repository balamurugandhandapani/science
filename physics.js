/* ==============================
   Physics Tools
   - Photon energy / wavelength / frequency
   - Bragg's law, Scherrer equation
   - Projectile motion, Ohm's law, resistors
   - Unit converter, constants table
   Pure calculation functions live in PHY (testable);
   the DOM wiring at the bottom runs only in a browser.
============================== */
const PHY = (function () {

  /* SI 2019 exact constants */
  const K = {
    c: 299792458,
    h: 6.62607015e-34,
    e: 1.602176634e-19,
    NA: 6.02214076e23
  };

  /* ---------- number formatting ---------- */
  function fmt(x) {
    if (!isFinite(x)) return String(x);
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e-3 && a < 1e6) return String(parseFloat(x.toPrecision(7)));
    return x.toExponential(5).replace('e+', 'e').replace(/\.?0+e/, 'e');
  }


  /* number -> LaTeX, e.g. 3.61172e-19 -> 3.61172\times10^{-19} */
  function texNum(x) {
    const s = fmt(x);
    const m = s.match(/^(-?[\d.]+)e(-?\d+)$/);
    return m ? m[1] + '\\times10^{' + m[2] + '}' : s;
  }

  /* unit name (plain text) -> LaTeX */
  function unitTeX(u) {
    let out = '', seg = '';
    const flush = () => { if (seg) { out += '\\mathrm{' + seg + '}'; seg = ''; } };
    for (const ch of String(u)) {
      if (ch === '\u00b5') { flush(); out += '\\mu '; }
      else if (ch === '\u00c5') { flush(); out += '\\mathrm{\\AA}'; }
      else if (ch === '\u00b0') { flush(); out += '{}^{\\circ}'; }
      else if (ch === ' ') { flush(); out += '\\,'; }
      else if (/[A-Za-z0-9\/()]/.test(ch)) seg += ch;
      /* any other character is dropped so user text can never inject LaTeX */
    }
    flush();
    return out;
  }

  /* ---------- Photon ---------- */
  const PHOTON_UNITS = {
    nm:  { type: 'wl', f: 1e-9 },
    A:   { type: 'wl', f: 1e-10 },
    um:  { type: 'wl', f: 1e-6 },
    eV:  { type: 'E',  f: K.e },
    keV: { type: 'E',  f: K.e * 1e3 },
    J:   { type: 'E',  f: 1 },
    THz: { type: 'f',  f: 1e12 },
    GHz: { type: 'f',  f: 1e9 },
    cm1: { type: 'k',  f: 100 }
  };

  function photonWavelength(value, unit) {
    const u = PHOTON_UNITS[unit];
    if (!u) throw new Error('Unknown unit.');
    if (!(value > 0)) throw new Error('Enter a value greater than zero.');
    const v = value * u.f;
    if (u.type === 'wl') return v;
    if (u.type === 'E') return K.h * K.c / v;
    if (u.type === 'f') return K.c / v;
    return 1 / v; /* wavenumber, per metre */
  }

  function photonAll(lambda) {
    const E = K.h * K.c / lambda;
    return {
      lambda_m: lambda,
      nm: lambda * 1e9,
      A: lambda * 1e10,
      um: lambda * 1e6,
      eV: E / K.e,
      J: E,
      kJmol: E * K.NA / 1000,
      Hz: K.c / lambda,
      THz: K.c / lambda / 1e12,
      cm1: 1 / (lambda * 100)
    };
  }

  function spectralRegion(nm) {
    if (nm < 0.01) return 'Gamma ray';
    if (nm < 10) return 'X-ray';
    if (nm < 380) return 'Ultraviolet';
    if (nm <= 750) {
      let c = 'Red';
      if (nm < 450) c = 'Violet';
      else if (nm < 495) c = 'Blue';
      else if (nm < 570) c = 'Green';
      else if (nm < 590) c = 'Yellow';
      else if (nm < 620) c = 'Orange';
      return 'Visible (' + c + ')';
    }
    if (nm < 1e6) return 'Infrared';
    if (nm < 1e9) return 'Microwave';
    return 'Radio';
  }

  /* approximate colour of visible light (Bruton) */
  function wavelengthToRGB(nm) {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
    else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
    else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
    else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
    else if (nm <= 750) { r = 1; }
    let f = 1;
    if (nm < 420) f = 0.3 + 0.7 * (nm - 380) / 40;
    else if (nm > 700) f = 0.3 + 0.7 * (750 - nm) / 50;
    const c = v => Math.round(255 * Math.pow(Math.max(0, v) * f, 0.8));
    return 'rgb(' + c(r) + ',' + c(g) + ',' + c(b) + ')';
  }

  /* ---------- Bragg ---------- */
  function braggD(lambda, twoThetaDeg, n) {
    if (!(lambda > 0)) throw new Error('Wavelength must be greater than zero.');
    if (!(n >= 1) || Math.floor(n) !== n) throw new Error('Order n must be a whole number (1, 2, 3 ...).');
    if (!(twoThetaDeg > 0 && twoThetaDeg < 180)) throw new Error('2\u03b8 must be between 0\u00b0 and 180\u00b0.');
    const theta = (twoThetaDeg / 2) * Math.PI / 180;
    return n * lambda / (2 * Math.sin(theta));
  }

  function braggTwoTheta(lambda, d, n) {
    if (!(lambda > 0)) throw new Error('Wavelength must be greater than zero.');
    if (!(d > 0)) throw new Error('d-spacing must be greater than zero.');
    if (!(n >= 1) || Math.floor(n) !== n) throw new Error('Order n must be a whole number (1, 2, 3 ...).');
    const s = n * lambda / (2 * d);
    if (s > 1) throw new Error('No diffraction possible: n\u03bb/2d = ' + fmt(s) + ' is greater than 1. Use a shorter wavelength or a larger d.');
    return 2 * Math.asin(s) * 180 / Math.PI;
  }

  /* ---------- Scherrer ---------- */
  function scherrer(Kf, lambda, twoThetaDeg, betaDeg, instDeg) {
    if (!(Kf > 0)) throw new Error('Shape factor K must be greater than zero.');
    if (!(lambda > 0)) throw new Error('Wavelength must be greater than zero.');
    if (!(twoThetaDeg > 0 && twoThetaDeg < 180)) throw new Error('2\u03b8 must be between 0\u00b0 and 180\u00b0.');
    if (!(betaDeg > 0)) throw new Error('FWHM \u03b2 must be greater than zero.');
    const inst = instDeg > 0 ? instDeg : 0;
    if (inst >= betaDeg) throw new Error('Instrumental broadening must be smaller than the observed FWHM.');
    const corrDeg = Math.sqrt(betaDeg * betaDeg - inst * inst);
    const betaRad = corrDeg * Math.PI / 180;
    const theta = (twoThetaDeg / 2) * Math.PI / 180;
    const D = Kf * lambda / (betaRad * Math.cos(theta));
    return { D_A: D, D_nm: D / 10, corrDeg: corrDeg, betaRad: betaRad };
  }

  /* ---------- Projectile ---------- */
  function projectile(v0, angleDeg, h0, g) {
    if (!(v0 >= 0)) throw new Error('Launch speed must be zero or positive.');
    if (!(g > 0)) throw new Error('Gravity must be greater than zero.');
    if (!(h0 >= 0)) throw new Error('Launch height must be zero or positive.');
    if (!(angleDeg >= -90 && angleDeg <= 90)) throw new Error('Angle must be between \u221290\u00b0 and 90\u00b0.');
    const a = angleDeg * Math.PI / 180;
    const vx = v0 * Math.cos(a);
    const vy = v0 * Math.sin(a);
    const T = (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
    if (!(T > 0)) throw new Error('The projectile starts on the ground with no upward speed, so there is no flight.');
    const tPeak = vy > 0 ? vy / g : 0;
    const H = h0 + (vy > 0 ? vy * vy / (2 * g) : 0);
    const R = vx * T;
    const vyEnd = vy - g * T;
    return {
      vx: vx, vy: vy, T: T, R: R, H: H, tPeak: tPeak,
      vImpact: Math.sqrt(vx * vx + vyEnd * vyEnd),
      angleImpact: Math.atan2(Math.abs(vyEnd), Math.abs(vx)) * 180 / Math.PI
    };
  }

  /* ---------- Ohm's law ---------- */
  function ohm(inp) {
    const known = ['V', 'I', 'R', 'P'].filter(k => isFinite(inp[k]));
    if (known.length !== 2) throw new Error('Fill in exactly two of the four boxes (you filled ' + known.length + ').');
    let { V, I, R, P } = inp;
    const key = known.join('');
    for (const k of known) {
      if ((k === 'R') && !(inp[k] > 0)) throw new Error('Resistance must be greater than zero.');
      if (k === 'P' && inp[k] < 0) throw new Error('Power cannot be negative here.');
    }
    if (key === 'VI') { if (I === 0) throw new Error('Current cannot be zero when voltage is given.'); R = V / I; P = V * I; }
    else if (key === 'VR') { I = V / R; P = V * V / R; }
    else if (key === 'VP') { if (V === 0) throw new Error('Voltage cannot be zero when power is given.'); I = P / V; R = V * V / P; }
    else if (key === 'IR') { V = I * R; P = I * I * R; }
    else if (key === 'IP') { if (I === 0) throw new Error('Current cannot be zero when power is given.'); V = P / I; R = P / (I * I); }
    else if (key === 'RP') { V = Math.sqrt(P * R); I = Math.sqrt(P / R); }
    if (!isFinite(R) || R <= 0) throw new Error('These two values give no valid resistance \u2014 check the signs and zeros.');
    return { V: V, I: I, R: R, P: P };
  }

  function resistors(list) {
    if (!list.length) throw new Error('Enter at least one resistor value.');
    for (const r of list) if (!(r >= 0)) throw new Error('Resistor values must be zero or positive numbers.');
    const series = list.reduce((a, b) => a + b, 0);
    const parallel = list.some(r => r === 0) ? 0 : 1 / list.reduce((a, b) => a + 1 / b, 0);
    return { series: series, parallel: parallel };
  }

  /* ---------- Units ---------- */
  const UNITS = {
    'Length': { base: 'm', u: { 'm': 1, 'km': 1e3, 'cm': 1e-2, 'mm': 1e-3, '\u00b5m': 1e-6, 'nm': 1e-9, '\u00c5': 1e-10, 'pm': 1e-12, 'in': 0.0254, 'ft': 0.3048 } },
    'Energy': { base: 'J', u: { 'J': 1, 'kJ': 1e3, 'eV': K.e, 'keV': K.e * 1e3, 'MeV': K.e * 1e6, 'erg': 1e-7, 'cal': 4.184, 'kWh': 3.6e6 } },
    'Pressure': { base: 'Pa', u: { 'Pa': 1, 'kPa': 1e3, 'MPa': 1e6, 'GPa': 1e9, 'bar': 1e5, 'atm': 101325, 'Torr': 101325 / 760, 'mmHg': 133.322387415, 'psi': 6894.757293168 } },
    'Mass': { base: 'kg', u: { 'kg': 1, 'g': 1e-3, 'mg': 1e-6, 'u (amu)': 1.66053906892e-27, 'lb': 0.45359237 } },
    'Angle': { base: 'rad', u: { 'rad': 1, 'degree': Math.PI / 180, 'arcminute': Math.PI / 10800, 'arcsecond': Math.PI / 648000, 'mrad': 1e-3 } },
    'Magnetic field H': { base: 'A/m', u: { 'A/m': 1, 'kA/m': 1e3, 'Oe': 1000 / (4 * Math.PI) } },
    'Magnetic flux density B': { base: 'T', u: { 'T': 1, 'mT': 1e-3, '\u00b5T': 1e-6, 'G': 1e-4, 'kG': 0.1 } },
    'Temperature': { base: 'K', u: { 'K': 1, '\u00b0C': 1, '\u00b0F': 1 } }
  };

  function toKelvin(v, u) {
    if (u === 'K') return v;
    if (u === '\u00b0C') return v + 273.15;
    return (v - 32) * 5 / 9 + 273.15;
  }
  function fromKelvin(k, u) {
    if (u === 'K') return k;
    if (u === '\u00b0C') return k - 273.15;
    return (k - 273.15) * 9 / 5 + 32;
  }

  function convert(cat, value, from, to) {
    const c = UNITS[cat];
    if (!c || !(from in c.u) || !(to in c.u)) throw new Error('Unknown unit.');
    if (!isFinite(value)) throw new Error('Enter a number to convert.');
    if (cat === 'Temperature') {
      const k = toKelvin(value, from);
      if (k < 0) throw new Error('That temperature is below absolute zero.');
      return fromKelvin(k, to);
    }
    return value * c.u[from] / c.u[to];
  }

  /* ---------- Constants table ---------- */
  const CONSTANTS = [
    /* [name, symbol (LaTeX), value (LaTeX), unit (LaTeX), type] */
    ['Speed of light in vacuum', 'c', '299\\,792\\,458', '\\mathrm{m\\,s^{-1}}', 'Exact'],
    ['Planck constant', 'h', '6.626\\,070\\,15\\times10^{-34}', '\\mathrm{J\\,s}', 'Exact'],
    ['Reduced Planck constant', '\\hbar=\\dfrac{h}{2\\pi}', '1.054\\,571\\,817\\ldots\\times10^{-34}', '\\mathrm{J\\,s}', 'Exact'],
    ['Elementary charge', 'e', '1.602\\,176\\,634\\times10^{-19}', '\\mathrm{C}', 'Exact'],
    ['Boltzmann constant', 'k_{\\mathrm{B}}', '1.380\\,649\\times10^{-23}', '\\mathrm{J\\,K^{-1}}', 'Exact'],
    ['Avogadro constant', 'N_{\\mathrm{A}}', '6.022\\,140\\,76\\times10^{23}', '\\mathrm{mol^{-1}}', 'Exact'],
    ['Molar gas constant', 'R', '8.314\\,462\\,618\\ldots', '\\mathrm{J\\,mol^{-1}\\,K^{-1}}', 'Exact'],
    ['Faraday constant', 'F', '96\\,485.332\\,12\\ldots', '\\mathrm{C\\,mol^{-1}}', 'Exact'],
    ['Stefan\u2013Boltzmann constant', '\\sigma', '5.670\\,374\\,419\\ldots\\times10^{-8}', '\\mathrm{W\\,m^{-2}\\,K^{-4}}', 'Exact'],
    ['Standard acceleration of gravity', 'g_{\\mathrm{n}}', '9.806\\,65', '\\mathrm{m\\,s^{-2}}', 'Exact (conventional)'],
    ['Standard atmosphere', '\\mathrm{atm}', '101\\,325', '\\mathrm{Pa}', 'Exact (conventional)'],
    ['Electron volt', '\\mathrm{eV}', '1.602\\,176\\,634\\times10^{-19}', '\\mathrm{J}', 'Exact'],
    ['Photon energy\u2013wavelength product', 'hc', '1239.841\\,984\\ldots', '\\mathrm{eV\\,nm}', 'Exact'],
    ['Newtonian gravitational constant', 'G', '6.674\\,30(15)\\times10^{-11}', '\\mathrm{m^{3}\\,kg^{-1}\\,s^{-2}}', 'Measured'],
    ['Vacuum electric permittivity', '\\varepsilon_{0}', '8.854\\,187\\,8188(14)\\times10^{-12}', '\\mathrm{F\\,m^{-1}}', 'Measured'],
    ['Vacuum magnetic permeability', '\\mu_{0}', '1.256\\,637\\,061\\,27(20)\\times10^{-6}', '\\mathrm{N\\,A^{-2}}', 'Measured'],
    ['Electron mass', 'm_{\\mathrm{e}}', '9.109\\,383\\,7139(28)\\times10^{-31}', '\\mathrm{kg}', 'Measured'],
    ['Proton mass', 'm_{\\mathrm{p}}', '1.672\\,621\\,925\\,95(52)\\times10^{-27}', '\\mathrm{kg}', 'Measured'],
    ['Neutron mass', 'm_{\\mathrm{n}}', '1.674\\,927\\,500\\,56(85)\\times10^{-27}', '\\mathrm{kg}', 'Measured'],
    ['Atomic mass constant', 'm_{\\mathrm{u}}=1\\,\\mathrm{u}', '1.660\\,539\\,068\\,92(52)\\times10^{-27}', '\\mathrm{kg}', 'Measured'],
    ['Fine-structure constant', '\\alpha', '7.297\\,352\\,5643(11)\\times10^{-3}', '\\text{dimensionless}', 'Measured'],
    ['Rydberg constant', 'R_{\\infty}', '10\\,973\\,731.568\\,157(12)', '\\mathrm{m^{-1}}', 'Measured'],
    ['Bohr radius', 'a_{0}', '5.291\\,772\\,105\\,44(82)\\times10^{-11}', '\\mathrm{m}', 'Measured'],
    ['Bohr magneton', '\\mu_{\\mathrm{B}}', '9.274\\,010\\,0657(29)\\times10^{-24}', '\\mathrm{J\\,T^{-1}}', 'Measured'],
    ['Cu K\u03b11 X-ray wavelength', '\\lambda(\\mathrm{Cu\\,K}\\alpha_{1})', '1.540\\,562', '\\mathrm{\\AA}', 'Reference line (Bearden 1967)']
  ];

  return {
    K, fmt, texNum, unitTeX, photonWavelength, photonAll, spectralRegion, wavelengthToRGB,
    braggD, braggTwoTheta, scherrer, projectile, ohm, resistors,
    UNITS, convert, CONSTANTS
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PHY;

/* ==============================
   Browser UI
============================== */
if (typeof document !== 'undefined') {
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const num = id => { const v = $(id).value.trim(); return v === '' ? NaN : Number(v); };
  const f = PHY.fmt;

  const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const T = tex => '<span data-tex="' + attr(tex) + '"></span>';               /* inline LaTeX */
  const N = (x, unit) => T(PHY.texNum(x) + (unit ? '\\,' + unit : ''));        /* number + unit */
  const DEG = x => T(PHY.texNum(x) + '^{\\circ}');                              /* number in degrees */
  function typeset(el) { if (window.renderTeX) window.renderTeX(el); }
  function showError(el, msg) { el.innerHTML = '<div class="calc-error">' + esc(msg) + '</div>'; }
  function table(rows) {
    return '<table class="result-table">' + rows.map(r =>
      '<tr' + (r[2] ? ' class="result-highlight"' : '') + '><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'
    ).join('') + '</table>';
  }
  function show(el, rows) { el.innerHTML = table(rows); typeset(el); }
  function safe(el, fn) { try { fn(); } catch (e) { showError(el, e.message); } }

  /* ----- tabs ----- */
  document.querySelectorAll('.calc-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.calc-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      $('panel-' + btn.dataset.tab).classList.add('active');
    });
  });

  /* ----- Photon ----- */
  function doPhoton() {
    const out = $('ph-result');
    safe(out, () => {
      const lam = PHY.photonWavelength(num('ph-value'), $('ph-unit').value);
      const r = PHY.photonAll(lam);
      const region = PHY.spectralRegion(r.nm);
      let tag = esc(region);
      if (r.nm >= 380 && r.nm <= 750) {
        tag = '<span class="color-swatch" style="background:' + PHY.wavelengthToRGB(r.nm) + '"></span> ' + tag;
      }
      show(out, [
        ['Wavelength ' + T('\\lambda'), N(r.nm, '\\mathrm{nm}') + ' &nbsp;(' + N(r.A, '\\mathrm{\\AA}') + ' &middot; ' + N(r.um, '\\mu\\mathrm{m}') + ')', true],
        ['Photon energy ' + T('E'), N(r.eV, '\\mathrm{eV}'), true],
        ['Energy in joules', N(r.J, '\\mathrm{J}')],
        ['Energy per mole of photons', N(r.kJmol, '\\mathrm{kJ\\,mol^{-1}}')],
        ['Frequency ' + T('\\nu'), N(r.THz, '\\mathrm{THz}') + ' &nbsp;(' + N(r.Hz, '\\mathrm{Hz}') + ')'],
        ['Wavenumber ' + T('\\tilde{\\nu}'), N(r.cm1, '\\mathrm{cm^{-1}}')],
        ['Spectral region', tag]
      ]);
    });
  }

  /* ----- Bragg ----- */
  function updateBraggMode() {
    const m = $('br-mode').value;
    $('br-tt-wrap').style.display = m === 'd' ? '' : 'none';
    $('br-d-wrap').style.display = m === 'tt' ? '' : 'none';
  }
  function doBragg() {
    const out = $('br-result');
    safe(out, () => {
      const lam = num('br-lambda'), n = num('br-n');
      let d, tt;
      if ($('br-mode').value === 'd') {
        tt = num('br-tt');
        d = PHY.braggD(lam, tt, n);
      } else {
        d = num('br-d');
        tt = PHY.braggTwoTheta(lam, d, n);
      }
      const rows = [
        ['Peak position ' + T('2\\theta'), DEG(tt) + ' &nbsp;(' + T('\\theta=' + PHY.texNum(tt / 2) + '^{\\circ}') + ')', $('br-mode').value === 'tt'],
        [T('d') + '-spacing', N(d, '\\mathrm{\\AA}') + ' &nbsp;(' + N(d / 10, '\\mathrm{nm}') + ')', $('br-mode').value === 'd'],
        ['Scattering vector ' + T('Q=2\\pi/d'), N(2 * Math.PI / d, '\\mathrm{\\AA^{-1}}')]
      ];
      const h = num('br-h'), k = num('br-k'), l = num('br-l');
      if (isFinite(h) && isFinite(k) && isFinite(l)) {
        const s = h * h + k * k + l * l;
        if (s > 0) {
          rows.push(['Cubic lattice parameter ' + T('a') + ' for ' + T('(h\\,k\\,l)=(' + h + '\\,' + k + '\\,' + l + ')'), N(d * Math.sqrt(s), '\\mathrm{\\AA}'), true]);
        } else {
          rows.push(['Cubic lattice parameter ' + T('a'), esc('h, k, l cannot all be zero')]);
        }
      }
      show(out, rows);
    });
  }

  /* ----- Scherrer ----- */
  function doScherrer() {
    const out = $('sc-result');
    safe(out, () => {
      const inst = num('sc-inst');
      const r = PHY.scherrer(num('sc-k'), num('sc-lambda'), num('sc-tt'), num('sc-beta'), isFinite(inst) ? inst : 0);
      show(out, [
        ['Corrected FWHM ' + T('\\beta_{\\mathrm{corr}}'), DEG(r.corrDeg) + ' &nbsp;(' + N(r.betaRad, '\\mathrm{rad}') + ')'],
        ['Crystallite size ' + T('D'), N(r.D_nm, '\\mathrm{nm}'), true],
        ['Crystallite size ' + T('D'), N(r.D_A, '\\mathrm{\\AA}')]
      ]);
    });
  }

  /* ----- Projectile ----- */
  function drawTrajectory(p, h0, g, v0, a) {
    const cv = $('pr-canvas'), ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, padL = 62, padR = 24, padT = 24, padB = 44;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    const xs = [], ys = [];
    const N = 160;
    for (let i = 0; i <= N; i++) {
      const t = p.T * i / N;
      xs.push(p.vx * t);
      ys.push(Math.max(0, h0 + p.vy * t - 0.5 * g * t * t));
    }
    const minX = Math.min(0, ...xs), maxX = Math.max(1e-9, ...xs), maxY = Math.max(1e-9, ...ys);
    const spanX = maxX - minX;
    const sc = Math.min((W - padL - padR) / spanX, (H - padT - padB) / maxY);
    const X = x => padL + (x - minX) * sc;
    const Y = y => H - padB - y * sc;
    const ink = '#013938', accent = '#800000';
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 1;
    ctx.font = '11px "IBM Plex Mono", monospace';
    /* axes */
    ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();
    /* ticks */
    for (let i = 0; i <= 4; i++) {
      const xv = minX + spanX * i / 4, yv = maxY * i / 4;
      ctx.textAlign = 'center'; ctx.fillText(f(+xv.toPrecision(3)), X(xv), H - padB + 16);
      ctx.textAlign = 'right'; ctx.fillText(f(+yv.toPrecision(3)), padL - 8, Y(yv) + 4);
      ctx.strokeStyle = 'rgba(1,57,56,0.10)';
      ctx.beginPath(); ctx.moveTo(padL, Y(yv)); ctx.lineTo(W - padR, Y(yv)); ctx.stroke();
      ctx.strokeStyle = ink;
    }
    ctx.textAlign = 'center'; ctx.fillText('horizontal distance x (m)', (padL + W - padR) / 2, H - 6);
    ctx.save(); ctx.translate(14, (padT + H - padB) / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('height y (m)', 0, 0); ctx.restore();
    /* path */
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.beginPath();
    xs.forEach((x, i) => { i ? ctx.lineTo(X(x), Y(ys[i])) : ctx.moveTo(X(x), Y(ys[i])); });
    ctx.stroke();
    /* markers */
    function dot(x, y, label, dx, dy, align) {
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(X(x), Y(y), 4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = ink; ctx.textAlign = align || 'center'; ctx.fillText(label, X(x) + dx, Y(y) + dy);
    }
    dot(0, h0, 'launch', 9, -8, 'left');
    if (p.vy > 0) dot(p.vx * p.tPeak, p.H, 'peak', 0, -10);
    dot(p.R, 0, 'landing', 0, -10);
  }
  function doProjectile() {
    const out = $('pr-result');
    safe(out, () => {
      const v0 = num('pr-v'), a = num('pr-a'), h0 = num('pr-h'), g = num('pr-g');
      const p = PHY.projectile(v0, a, h0, g);
      show(out, [
        ['Time of flight ' + T('T'), N(p.T, '\\mathrm{s}'), true],
        ['Horizontal range ' + T('R'), N(p.R, '\\mathrm{m}'), true],
        ['Maximum height ' + T('H'), N(p.H, '\\mathrm{m}')],
        ['Time to maximum height ' + T('t_{\\mathrm{peak}}'), N(p.tPeak, '\\mathrm{s}')],
        ['Launch velocity components', T('v_x=' + PHY.texNum(p.vx) + '\\,\\mathrm{m\\,s^{-1}},\\quad v_y=' + PHY.texNum(p.vy) + '\\,\\mathrm{m\\,s^{-1}}')],
        ['Impact speed', N(p.vImpact, '\\mathrm{m\\,s^{-1}}')],
        ['Impact angle below horizontal', DEG(p.angleImpact)]
      ]);
      drawTrajectory(p, h0, g, v0, a);
    });
  }

  /* ----- Ohm ----- */
  function doOhm() {
    const out = $('oh-result');
    safe(out, () => {
      const given = { V: num('oh-v'), I: num('oh-i'), R: num('oh-r'), P: num('oh-p') };
      const r = PHY.ohm(given);
      const hl = k => !isFinite(given[k]);
      show(out, [
        ['Voltage ' + T('V'), N(r.V, '\\mathrm{V}'), hl('V')],
        ['Current ' + T('I'), N(r.I, '\\mathrm{A}'), hl('I')],
        ['Resistance ' + T('R'), N(r.R, '\\Omega'), hl('R')],
        ['Power ' + T('P'), N(r.P, '\\mathrm{W}'), hl('P')]
      ]);
    });
  }
  function doResistors() {
    const out = $('rs-result');
    safe(out, () => {
      const parts = $('rs-list').value.split(/[,\s;]+/).filter(s => s !== '');
      const vals = parts.map(Number);
      if (vals.some(v => !isFinite(v))) throw new Error('Use numbers only, separated by commas.');
      const r = PHY.resistors(vals);
      show(out, [
        ['Number of resistors ' + T('n'), String(vals.length)],
        ['Series equivalent ' + T('R_{\\mathrm{series}}'), N(r.series, '\\Omega'), true],
        ['Parallel equivalent ' + T('R_{\\mathrm{parallel}}'), N(r.parallel, '\\Omega'), true]
      ]);
    });
  }

  /* ----- Units ----- */
  function fillUnits() {
    const cat = $('un-cat').value, names = Object.keys(PHY.UNITS[cat].u);
    ['un-from', 'un-to'].forEach((id, i) => {
      const sel = $(id);
      sel.innerHTML = names.map(n => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
      sel.selectedIndex = Math.min(i, names.length - 1);
    });
  }
  function doUnits() {
    const out = $('un-result');
    safe(out, () => {
      const v = num('un-value'), from = $('un-from').value, to = $('un-to').value;
      const r = PHY.convert($('un-cat').value, v, from, to);
      show(out, [[T(PHY.texNum(v) + '\\,' + PHY.unitTeX(from) + '\\;='), T(PHY.texNum(r) + '\\,' + PHY.unitTeX(to)), true]]);
    });
  }

  /* ----- Constants ----- */
  function drawConstants(q) {
    const term = q.toLowerCase().trim();
    const plain = c => (c[0] + ' ' + c[1]).replace(/\\mathrm|\\text|\\dfrac|\\/g, '').replace(/[{}]/g, '').toLowerCase();
    const rows = PHY.CONSTANTS.filter(c => !term || plain(c).includes(term));
    const el = $('cs-rows');
    el.innerHTML = rows.length
      ? rows.map(c => '<tr><td>' + c[0] + '</td><td>' + T(c[1]) + '</td><td>' + T(c[2]) + '</td><td>' + T(c[3]) + '</td><td>' + c[4] + '</td></tr>').join('')
      : '<tr><td colspan="5">No constant matches &ldquo;' + esc(q) + '&rdquo;.</td></tr>';
    typeset(el);
  }

  /* ----- wire up ----- */
  $('ph-btn').addEventListener('click', doPhoton);
  $('br-btn').addEventListener('click', doBragg);
  $('br-mode').addEventListener('change', () => { updateBraggMode(); doBragg(); });
  $('br-preset').addEventListener('change', () => {
    const v = $('br-preset').value;
    if (v !== 'custom') $('br-lambda').value = v;
    doBragg();
  });
  $('br-lambda').addEventListener('input', () => {
    const match = Array.from($('br-preset').options).find(o => o.value !== 'custom' && Number(o.value) === num('br-lambda'));
    $('br-preset').value = match ? match.value : 'custom';
  });
  $('sc-btn').addEventListener('click', doScherrer);
  $('pr-btn').addEventListener('click', doProjectile);
  $('oh-btn').addEventListener('click', doOhm);
  $('oh-clear').addEventListener('click', () => {
    ['oh-v', 'oh-i', 'oh-r', 'oh-p'].forEach(id => { $(id).value = ''; });
    $('oh-result').innerHTML = '';
  });
  $('rs-btn').addEventListener('click', doResistors);
  $('un-btn').addEventListener('click', doUnits);
  $('un-cat').innerHTML = Object.keys(PHY.UNITS).map(n => '<option>' + esc(n) + '</option>').join('');
  $('un-cat').addEventListener('change', () => { fillUnits(); doUnits(); });
  $('cs-search').addEventListener('input', e => drawConstants(e.target.value));

  /* Enter key runs the card's main button */
  document.querySelectorAll('.calc-card').forEach(card => {
    card.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.target.tagName === 'BUTTON') return;
      const wrap = e.target.closest('.calc-card');
      const sec = e.target.id.startsWith('rs-') ? $('rs-btn') : wrap.querySelector('.calc-btn');
      if (sec) sec.click();
    });
  });

  updateBraggMode();
  fillUnits();
  drawConstants('');
  doPhoton(); doBragg(); doScherrer(); doProjectile(); doOhm(); doResistors(); doUnits();
})();
}
