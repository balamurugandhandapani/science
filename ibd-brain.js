/* IBD Bot built-in thinking engine v1.0
   100% self-contained: no model download, no API, no external library, no network request.
   All reasoning (parsing, symbolic calculus, equation solving, chemistry, physics formulas, units,
   statistics, rule-based English checks, knowledge retrieval, LaTeX rendering, .docx export) is plain
   JavaScript in this file. Data embedded: 118 elements (from the site's data.js), constants, formulas, notes.
   Usage:  const r = IBDBrain.think("differentiate x^2 sin x", ctx);  // r.answer, r.trace, r.conf
*/
(function (root) {
  'use strict';
  const VERSION = '1.0';
  /* ===== core helpers ===== */
  const NA = 6.02214076e23;
  const hasTamil = (s) => /[\u0B80-\u0BFF]/.test(s);
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function ratify(x, maxDen, tol) {
    maxDen = maxDen || 1000; tol = tol || 1e-9;
    if (!isFinite(x)) return null;
    if (Number.isInteger(x)) return [x, 1];
    const sign = x < 0 ? -1 : 1, v = Math.abs(x);
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = v;
    for (let i = 0; i < 40; i++) {
      const a = Math.floor(b), h2 = a * h1 + h0, k2 = a * k1 + k0;
      h0 = h1; h1 = h2; k0 = k1; k1 = k2;
      if (k1 > maxDen) return null;
      if (Math.abs(v - h1 / k1) < tol * Math.max(1, v)) return [sign * h1, k1];
      const fr = b - a; if (fr < 1e-12) break; b = 1 / fr;
    }
    return null;
  }
  function fmt(x, sig) {
    sig = sig || 6;
    if (typeof x !== 'number') return String(x);
    if (!isFinite(x)) return String(x);
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e6 || ax < 1e-4) {
      const parts = x.toExponential(sig - 1).split('e');
      const m = parts[0].replace(/\.?0+$/, '');
      const e = parseInt(parts[1], 10);
      return m + 'e' + e;
    }
    return String(Number(x.toPrecision(sig)));
  }
  function fmtTeX(x, sig) {
    const s = fmt(x, sig);
    const m = /^(-?[\d.]+)e(-?\d+)$/.exec(s);
    if (m) return (m[1] === '1' ? '' : m[1] + '\\times ') + '10^{' + m[2] + '}';
    return s;
  }

  /* ===== expression parser (own implementation, no eval) ===== */
  const FUNCS = new Set(['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'ln', 'log', 'log10', 'log2', 'exp', 'sqrt', 'abs', 'cbrt', 'sec', 'csc', 'cot']);
  const FALIAS = { arcsin: 'asin', arccos: 'acos', arctan: 'atan', lg: 'log10' };
  const GREEK_WORDS = new Set(['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'mu', 'nu', 'rho', 'sigma', 'phi', 'psi', 'omega', 'Delta', 'Omega']);
  const GREEK_TEX = { alpha: '\\alpha', beta: '\\beta', gamma: '\\gamma', delta: '\\delta', epsilon: '\\epsilon', theta: '\\theta', lambda: '\\lambda', mu: '\\mu', nu: '\\nu', rho: '\\rho', sigma: '\\sigma', phi: '\\phi', psi: '\\psi', omega: '\\omega', Delta: '\\Delta', Omega: '\\Omega', pi: '\\pi', tau: '\\tau', lam: '\\lambda', th: '\\theta' };
  const SUP = { '\u2070': 0, '\u00B9': 1, '\u00B2': 2, '\u00B3': 3, '\u2074': 4, '\u2075': 5, '\u2076': 6, '\u2077': 7, '\u2078': 8, '\u2079': 9 };

  function normalize(s) {
    s = String(s).replace(/[\u2070\u00B9\u00B2\u00B3\u2074-\u2079]+/g, (m) => '^' + [...m].map((c) => SUP[c]).join(''));
    s = s.replace(/(\d+(?:\.\d+)?)\s*\u00B0/g, '($1*pi/180)');
    return s.replace(/\*\*/g, '^').replace(/[\u00D7\u00B7\u22C5]/g, '*').replace(/\u00F7/g, '/').replace(/[\u2212\u2013]/g, '-')
      .replace(/\u03C0/g, 'pi').replace(/\u221A/g, 'sqrt ').replace(/[\[{]/g, '(').replace(/[\]}]/g, ')').replace(/\u03B8/g, 'theta').replace(/\u03BB/g, 'lambda').replace(/\u03BC/g, 'mu');
  }
  function tokenize(src, opts) {
    const names = opts && opts.names;
    const out = []; let i = 0;
    const pushId = (id) => {
      if (names && names.has(id)) { out.push({ k: 'id', v: id }); return; }
      const low = id.toLowerCase();
      const al = FALIAS[low] || low;
      if (FUNCS.has(al)) { out.push({ k: 'fn', v: al }); return; }
      if (low === 'pi' || low === 'tau') { out.push({ k: 'id', v: low }); return; }
      if (id === 'e' || id === 'ans') { out.push({ k: 'id', v: id }); return; }
      if (GREEK_WORDS.has(id)) { out.push({ k: 'id', v: id }); return; }
      const m = /^([A-Za-z]+)(\d+)$/.exec(id);
      if (m) { for (const ch of m[1]) out.push({ k: 'id', v: ch }); out.push({ k: 'num', v: parseFloat(m[2]) }); return; }
      for (const ch of id.replace(/_/g, '')) out.push({ k: 'id', v: ch });
    };
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      const rest = src.slice(i); let m;
      if ((m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(rest))) { out.push({ k: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_\u0370-\u03FF][A-Za-z0-9_\u0370-\u03FF]*/.exec(rest))) { i += m[0].length; pushId(m[0]); continue; }
      if ('+-*/^()!,'.includes(c)) { out.push({ k: 'op', v: c }); i++; continue; }
      throw new Error('I cannot read the character "' + c + '" in the expression.');
    }
    return out;
  }
  function parse(src, opts) {
    const toks = tokenize(normalize(src), opts); let p = 0;
    const peek = () => toks[p];
    const isOp = (v) => toks[p] && toks[p].k === 'op' && toks[p].v === v;
    const startsPrimary = (t) => t && (t.k === 'num' || t.k === 'id' || t.k === 'fn' || (t.k === 'op' && t.v === '('));
    const close = () => { if (!isOp(')')) throw new Error('A closing bracket ")" is missing.'); p++; };
    function expr() {
      let a = term();
      while (peek() && peek().k === 'op' && (peek().v === '+' || peek().v === '-')) { const op = toks[p++].v; const b = term(); a = { t: op, a, b }; }
      return a;
    }
    function term() {
      let a = unary();
      for (;;) {
        const t = peek();
        if (t && t.k === 'op' && (t.v === '*' || t.v === '/')) { p++; const b = unary(); a = { t: t.v, a, b }; }
        else if (startsPrimary(t)) { const b = unary(); a = { t: '*', a, b }; }
        else break;
      }
      return a;
    }
    function unary() {
      if (isOp('-')) { p++; return { t: 'neg', a: unary() }; }
      if (isOp('+')) { p++; return unary(); }
      return power();
    }
    function power() {
      const a = postfix();
      if (isOp('^')) { p++; const b = unary(); return { t: '^', a, b }; }
      return a;
    }
    function postfix() {
      let a = primary();
      while (isOp('!')) { p++; a = { t: 'f', n: 'fact', a }; }
      return a;
    }
    function fnArg() {
      if (isOp('-')) { p++; return { t: 'neg', a: fnArg() }; }
      let a = power();
      while (startsPrimary(peek()) && peek().k !== 'fn') { const b = power(); a = { t: '*', a, b }; }
      return a;
    }
    function primary() {
      const t = toks[p++];
      if (!t) throw new Error('The expression ends too early.');
      if (t.k === 'num') return { t: 'n', v: t.v };
      if (t.k === 'id') return { t: 'v', n: t.v };
      if (t.k === 'fn') {
        if (isOp('^')) { p++; const ex = primary(); const arg = isOp('(') ? (p++, (() => { const e = expr(); close(); return e; })()) : fnArg(); return { t: '^', a: { t: 'f', n: t.v, a: arg }, b: ex }; }
        let arg;
        if (isOp('(')) { p++; arg = expr(); close(); } else arg = fnArg();
        return { t: 'f', n: t.v, a: arg };
      }
      if (t.k === 'op' && t.v === '(') { const e = expr(); close(); return e; }
      throw new Error('Unexpected "' + t.v + '" in the expression.');
    }
    if (!toks.length) throw new Error('The expression is empty.');
    const tree = expr();
    if (p < toks.length) throw new Error('Unexpected "' + toks[p].v + '" in the expression.');
    return tree;
  }

  /* ===== evaluation ===== */
  const FN = {
    sin: (x, d) => Math.sin(d ? x * Math.PI / 180 : x), cos: (x, d) => Math.cos(d ? x * Math.PI / 180 : x), tan: (x, d) => Math.tan(d ? x * Math.PI / 180 : x),
    asin: (x, d) => (d ? 180 / Math.PI : 1) * Math.asin(x), acos: (x, d) => (d ? 180 / Math.PI : 1) * Math.acos(x), atan: (x, d) => (d ? 180 / Math.PI : 1) * Math.atan(x),
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, ln: Math.log, log: Math.log10, log10: Math.log10, log2: Math.log2, exp: Math.exp, sqrt: Math.sqrt, abs: Math.abs, cbrt: Math.cbrt,
    sec: (x, d) => 1 / Math.cos(d ? x * Math.PI / 180 : x), csc: (x, d) => 1 / Math.sin(d ? x * Math.PI / 180 : x), cot: (x, d) => 1 / Math.tan(d ? x * Math.PI / 180 : x),
    fact: (x) => { if (!Number.isInteger(x) || x < 0 || x > 170) return NaN; let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; },
  };
  function ev(n, env, deg) {
    switch (n.t) {
      case 'n': return n.v;
      case 'v':
        if (env && n.n in env) return env[n.n];
        if (n.n === 'pi') return Math.PI; if (n.n === 'e') return Math.E; if (n.n === 'tau') return 2 * Math.PI;
        throw new Error('The value of "' + n.n + '" is not known.');
      case '+': return ev(n.a, env, deg) + ev(n.b, env, deg);
      case '-': return ev(n.a, env, deg) - ev(n.b, env, deg);
      case '*': return ev(n.a, env, deg) * ev(n.b, env, deg);
      case '/': return ev(n.a, env, deg) / ev(n.b, env, deg);
      case '^': return Math.pow(ev(n.a, env, deg), ev(n.b, env, deg));
      case 'neg': return -ev(n.a, env, deg);
      case 'f': return FN[n.n](ev(n.a, env, deg), deg);
    }
    throw new Error('Unknown node');
  }
  function varsOf(n, set) {
    set = set || new Set();
    if (n.t === 'v') { if (!['pi', 'e', 'tau', 'ans'].includes(n.n)) set.add(n.n); }
    else { if (n.a) varsOf(n.a, set); if (n.b) varsOf(n.b, set); }
    return set;
  }
  const has = (n, x) => { if (n.t === 'v') return n.n === x; return (n.a ? has(n.a, x) : false) || (n.b ? has(n.b, x) : false); };

  /* ===== symbolic construction with light simplification ===== */
  const N = (v) => ({ t: 'n', v });
  const Vr = (n) => ({ t: 'v', n });
  const isN = (a, v) => a.t === 'n' && (v === undefined || a.v === v);
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // rational value of a constant node, or null
  function ratOf(n) {
    if (n.t === 'n') return ratify(n.v, 100000, 1e-12);
    if (n.t === '/' && n.a.t === 'n' && n.b.t === 'n' && Number.isInteger(n.a.v) && Number.isInteger(n.b.v) && n.b.v !== 0) return [n.a.v, n.b.v];
    return null;
  }
  function Rat(p, q) {
    const g = gcd(p, q) || 1; p /= g; q /= g; if (q < 0) { p = -p; q = -q; }
    return q === 1 ? N(p) : { t: '/', a: N(p), b: N(q) };
  }
  const Nr = (v) => { const r = ratify(v, 1000, 1e-9); return r ? Rat(r[0], r[1]) : N(v); };
  function Neg(a) {
    if (a.t === 'n') return N(-a.v);
    if (a.t === 'neg') return a.a;
    if (a.t === '*' && a.a.t === 'n') return M(N(-a.a.v), a.b);
    if (a.t === '/' && a.a.t === 'n') return D(N(-a.a.v), a.b);
    return { t: 'neg', a };
  }
  function A(a, b) {
    if (isN(a, 0)) return b; if (isN(b, 0)) return a;
    const ra = ratOf(a), rb = ratOf(b);
    if (ra && rb) return Rat(ra[0] * rb[1] + rb[0] * ra[1], ra[1] * rb[1]);
    if (a.t === 'n' && b.t === 'n') return N(a.v + b.v);
    if (b.t === 'neg') return { t: '-', a, b: b.a };
    return { t: '+', a, b };
  }
  function Sub(a, b) {
    if (b.t === '+') return Sub(Sub(a, b.a), b.b);
    if (b.t === '-') return A(Sub(a, b.a), b.b);
    return A(a, Neg(b));
  }
  function M(a, b) {
    if (isN(a, 0) || isN(b, 0)) return N(0);
    if (isN(a, 1)) return b; if (isN(b, 1)) return a;
    const ra = ratOf(a), rb = ratOf(b);
    if (ra && rb) return Rat(ra[0] * rb[0], ra[1] * rb[1]);
    if (a.t === 'n' && b.t === 'n') return N(a.v * b.v);
    if (a.t === 'n' && b.t === '*' && b.a.t === 'n') return M(N(a.v * b.a.v), b.b);
    if (b.t === 'n' && a.t !== 'n') return M(b, a);
    if (a.t === 'neg') return Neg(M(a.a, b));
    if (b.t === 'neg') return Neg(M(a, b.a));
    if (isN(a, -1)) return Neg(b);
    if (eq(a, b)) return P(a, N(2));
    if (b.t === '^' && eq(b.a, a) && b.b.t === 'n') return P(a, N(b.b.v + 1));
    if (a.t === '^' && eq(a.a, b) && a.b.t === 'n') return P(b, N(a.b.v + 1));
    if (a.t === '/' && isN(a.a, 1) && eq(a.b, b)) return N(1);
    if (b.t === '/' && isN(b.a, 1) && eq(b.b, a)) return N(1);
    return { t: '*', a, b };
  }
  function D(a, b) {
    if (isN(a, 0)) return N(0);
    if (isN(b, 1)) return a;
    const ra = ratOf(a), rb = ratOf(b);
    if (ra && rb) { if (rb[0] === 0) return N(NaN); return Rat(ra[0] * rb[1], ra[1] * rb[0]); }
    if (a.t === 'n' && b.t === 'n') return N(a.v / b.v);
    if (eq(a, b)) return N(1);
    if (a.t === '^' && eq(a.a, b) && a.b.t === 'n') return P(b, N(a.b.v - 1));
    if (a.t === '*' && eq(a.b, b)) return a.a;
    if (a.t === 'neg') return Neg(D(a.a, b));
    if (b.t === 'neg') return Neg(D(a, b.a));
    if (a.t === '*' && a.a.t === 'n' && a.a.v < 0) return Neg(D(M(N(-a.a.v), a.b), b));
    if (a.t === '*' && a.a.t === 'n' && b.t === '*' && b.a.t === 'n') {
      const r = ratOf(N(a.a.v / b.a.v));
      if (r) return D(M(Rat(r[0], 1), a.b), M(N(r[1]), b.b));
    }
    if (b.t === 'n' && a.t === '*' && a.a.t === 'n') return M(D(a.a, b), a.b);
    if (rb && b.t === 'n' && a.t !== 'n') return M(Rat(1, rb[0]), a);
    return { t: '/', a, b };
  }
  function P(a, b) {
    if (isN(b, 0)) return N(1); if (isN(b, 1)) return a; if (isN(a, 1)) return N(1);
    if (a.t === 'n' && b.t === 'n') { const r = Math.pow(a.v, b.v); if (Number.isInteger(r)) return N(r); }
    return { t: '^', a, b };
  }
  const Fn = (n, a) => ({ t: 'f', n, a });

  // canonical clean-up: rational coefficients pulled to the front, like terms combined
  function split(n) {
    const rt = ratOf(n);
    if (rt) return { p: rt[0], q: rt[1], r: null };
    const norm = (s) => { const g = gcd(s.p, s.q) || 1; let p = s.p / g, q = s.q / g; if (q < 0) { p = -p; q = -q; } return { p, q, r: s.r }; };
    if (n.t === 'neg') { const s = split(n.a); return { p: -s.p, q: s.q, r: s.r }; }
    if (n.t === '*') {
      const a = split(n.a), b = split(n.b);
      const mulR = (x, y) => {
        if (!x || !y) return x || y;
        const nx = x.t === '/' ? x.a : x, dx = x.t === '/' ? x.b : null, ny = y.t === '/' ? y.a : y, dy = y.t === '/' ? y.b : null;
        const rank = (z) => ((z.t === 'v' && z.n !== 'e') || (z.t === '^' && z.a.t === 'v' && z.a.n !== 'e')) ? 0 : 1;
        const num = rank(nx) > rank(ny) ? M(ny, nx) : M(nx, ny), den = dx && dy ? M(dx, dy) : (dx || dy);
        return den ? D(num, den) : num;
      };
      return norm({ p: a.p * b.p, q: a.q * b.q, r: mulR(a.r, b.r) });
    }
    if (n.t === '/') {
      const a = split(n.a), b = split(n.b);
      if (!b.r) return b.p === 0 ? { p: 1, q: 1, r: n } : norm({ p: a.p * b.q, q: a.q * b.p, r: a.r });
      return norm({ p: a.p * b.q, q: a.q * b.p, r: D(a.r || N(1), b.r) });
    }
    return { p: 1, q: 1, r: tidyInner(n) };
  }
  function build(p, q, r) {
    if (!r) return D(N(p), N(q));
    if (r.t === '/' && q === 1) return D(M(N(p), r.a), r.b);
    if (q === 1) return p === 1 ? r : M(N(p), r);
    return p === 1 ? D(r, N(q)) : M(D(N(p), N(q)), r);
  }
  function tidyInner(n) {
    switch (n.t) {
      case '+': case '-': return tidySum(n);
      case '^': return P(tidy(n.a), tidy(n.b));
      case 'f': return Fn(n.n, tidy(n.a));
      case 'neg': return tidy(n);
      case '*': case '/': return tidy(n);
    }
    return n;
  }
  function tidySum(n) {
    const terms = [];
    const walk = (m, sg) => {
      if (m.t === '+') { walk(m.a, sg); walk(m.b, sg); }
      else if (m.t === '-') { walk(m.a, sg); walk(m.b, -sg); }
      else if (m.t === 'neg') walk(m.a, -sg);
      else { const s = split(m); terms.push({ p: sg * s.p, q: s.q, r: s.r }); }
    };
    walk(n, 1);
    const map = new Map(), order = [];
    terms.forEach((t) => {
      const key = t.r ? plain(t.r) : '#const';
      if (!map.has(key)) { map.set(key, { p: 0, q: 1, r: t.r }); order.push(key); }
      const c = map.get(key);
      const np = c.p * t.q + t.p * c.q, nq = c.q * t.q, g = gcd(np, nq) || 1; c.p = np / g; c.q = nq / g;
    });
    // polynomial-like display: put the constant term last
    const keys = order.filter((k) => k !== '#const').concat(order.filter((k) => k === '#const'));
    let acc = null;
    keys.forEach((k) => {
      const c = map.get(k); if (c.p === 0) return;
      const t = build(Math.abs(c.p), c.q, c.r), neg = c.p < 0;
      acc = acc ? (neg ? Sub(acc, t) : A(acc, t)) : (neg ? Neg(t) : t);
    });
    return acc || N(0);
  }
  function tidy(n) {
    if (n.t === '+' || n.t === '-') return tidySum(n);
    if (n.t === 'n' || n.t === 'v') return n;
    const s = split(n);
    if (s.p === 0) return N(0);
    const t = build(Math.abs(s.p), s.q, s.r);
    return s.p < 0 ? Neg(t) : t;
  }
  // rebuild a parsed tree through the constructors (canonical numbers, merged factors)
  function simp(n) {
    switch (n.t) {
      case 'n': case 'v': return n;
      case 'neg': return Neg(simp(n.a));
      case '+': return A(simp(n.a), simp(n.b));
      case '-': return Sub(simp(n.a), simp(n.b));
      case '*': return M(simp(n.a), simp(n.b));
      case '/': return D(simp(n.a), simp(n.b));
      case '^': return P(simp(n.a), simp(n.b));
      case 'f': return Fn(n.n, simp(n.a));
    }
    return n;
  }

  /* ===== TeX output ===== */
  const pr = (n) => (n.t === '+' || n.t === '-') ? 1 : (n.t === 'n' && n.v < 0) ? 1 : (n.t === 'neg' || n.t === '*') ? 2 : n.t === '/' ? 3 : n.t === '^' ? 4 : 6;
  const par = (s) => '\\left(' + s + '\\right)';
  const TRIG = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh', 'ln', 'log']);
  function tx(n, min) {
    const s = txRaw(n);
    return pr(n) < (min || 0) ? par(s) : s;
  }
  function numTeX(v) { return Number.isInteger(v) ? String(v) : fmtTeX(v, 6); }
  function txRaw(n) {
    switch (n.t) {
      case 'n': return numTeX(n.v);
      case 'v': return GREEK_TEX[n.n] || (n.n.length > 1 ? '\\mathrm{' + n.n + '}' : n.n);
      case 'neg': return '-' + tx(n.a, 2);
      case '+': {
        if (n.b.t === 'n' && n.b.v < 0) return tx(n.a, 1) + ' - ' + numTeX(-n.b.v);
        if (n.b.t === '*' && n.b.a.t === 'n' && n.b.a.v < 0) return tx(n.a, 1) + ' - ' + tx(M(N(-n.b.a.v), n.b.b), 2);
        return tx(n.a, 1) + ' + ' + tx(n.b, 1);
      }
      case '-': return tx(n.a, 1) + ' - ' + tx(n.b, 2);
      case '*': {
        const negNum = n.a.t === 'n' && n.a.v < 0;
        const a = negNum ? numTeX(-n.a.v) : tx(n.a, 2), b = tx(n.b, 2);
        const sign = negNum ? '-' : '';
        if (n.a.t === 'n' && (n.b.t === 'n' || /^\d/.test(b))) return sign + a + '\\cdot ' + b;
        return sign + a + (n.a.t === 'n' ? '' : ' ') + b;
      }
      case '/': return '\\frac{' + tx(n.a, 0) + '}{' + tx(n.b, 0) + '}';
      case '^': {
        if (n.a.t === 'f' && TRIG.has(n.a.n) && n.b.t === 'n') return '\\' + n.a.n + '^{' + tx(n.b, 0) + '}' + fnArgTeX(n.a.a);
        return tx(n.a, 5) + '^{' + tx(n.b, 0) + '}';
      }
      case 'f': {
        if (n.n === 'sqrt') return '\\sqrt{' + tx(n.a, 0) + '}';
        if (n.n === 'cbrt') return '\\sqrt[3]{' + tx(n.a, 0) + '}';
        if (n.n === 'exp') return 'e^{' + tx(n.a, 0) + '}';
        if (n.n === 'abs') return '\\left|' + tx(n.a, 0) + '\\right|';
        if (n.n === 'ln' && n.a.t === 'f' && n.a.n === 'abs') return '\\ln\\left|' + tx(n.a.a, 0) + '\\right|';
        if (n.n === 'fact') return tx(n.a, 5) + '!';
        const nm = { asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan', log10: '\\log_{10}', log2: '\\log_{2}' }[n.n] || '\\' + n.n;
        return nm + fnArgTeX(n.a);
      }
    }
    return '?';
  }
  function fnArgTeX(a) { return (a.t === 'v' || (a.t === 'n' && a.v >= 0)) ? ' ' + tx(a, 0) : par(tx(a, 0)); }
  const texOf = (n) => tx(n, 0);

  /* plain-text rendering of an AST (for showing what was understood) */
  function plain(n, min) {
    const w = (s, p) => (p < (min || 0) ? '(' + s + ')' : s);
    switch (n.t) {
      case 'n': return w(fmt(n.v), n.v < 0 ? 1 : 6);
      case 'v': return n.n;
      case 'neg': return w('-' + plain(n.a, 2), 2);
      case '+':
        if (n.b.t === 'n' && n.b.v < 0) return w(plain(n.a, 1) + ' - ' + fmt(-n.b.v), 1);
        return w(plain(n.a, 1) + ' + ' + plain(n.b, 1), 1);
      case '-': return w(plain(n.a, 1) + ' - ' + plain(n.b, 2), 1);
      case '*': return w(plain(n.a, 2) + '*' + plain(n.b, 2), 2);
      case '/': return w(plain(n.a, 2) + '/' + plain(n.b, 3), 2);
      case '^': return w(plain(n.a, 5) + '^' + plain(n.b, 5), 4);
      case 'f': return n.n + '(' + plain(n.a, 0) + ')';
    }
    return '?';
  }

  /* ===== polynomial detection (numeric fit, verified at extra points) ===== */
  function gaussSolve(Am, b) {
    const n = b.length; const a = Am.map((r, i) => r.concat([b[i]]));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
      if (Math.abs(a[p][c]) < 1e-12) return null;
      [a[c], a[p]] = [a[p], a[c]];
      for (let r = 0; r < n; r++) { if (r === c) continue; const f = a[r][c] / a[c][c]; for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k]; }
    }
    return a.map((r, i) => r[n] / r[i]);
  }
  function polyCoeffs(node, x, maxDeg, env) {
    const pts = [1, 2, -1, -2, 3, -3, 4, -4, 5, -5, 6, -6].slice(0, maxDeg + 1);
    const f = (t) => ev(node, Object.assign({}, env || {}, { [x]: t }));
    try {
      const ys = pts.map(f); if (ys.some((y) => !isFinite(y))) return null;
      const V = pts.map((t) => Array.from({ length: maxDeg + 1 }, (_, k) => Math.pow(t, k)));
      const c = gaussSolve(V, ys); if (!c) return null;
      const ref = Math.max(...ys.map(Math.abs)), cmax = Math.max(...c.map(Math.abs)), snap = cmax >= 1e-3;
      const scale = Math.max(1, cmax);
      const cl = c.map((v) => {
        if (Math.abs(v) < 1e-10 * cmax) return 0;
        if (!snap) return v;
        const r = Math.round(v); if (Math.abs(v - r) < 1e-7 * scale) return r;
        const q = ratify(v, 1000, 1e-8); return q ? q[0] / q[1] : v;
      });
      for (const t of [0.37, 1.31, -1.7, 2.9, -3.3, 5.1, 17.3, -11.7, 40.9, 63.1]) {
        const y = f(t); const p = cl.reduce((s2, v, k) => s2 + v * Math.pow(t, k), 0);
        const mag = cl.reduce((s2, v, k) => s2 + Math.abs(v * Math.pow(t, k)), 0);
        if (!isFinite(y) || Math.abs(y - p) > 1e-8 * Math.max(Math.abs(y), mag * 1e-3, 1e-6 * ref)) return null;
      }
      while (cl.length > 1 && cl[cl.length - 1] === 0) cl.pop();
      return cl;
    } catch (e) { return null; }
  }
  const polyTeXOf = (c, x) => {
    let out = null;
    for (let k = c.length - 1; k >= 0; k--) {
      if (!c[k]) continue;
      let term = k === 0 ? N(c[k]) : M(N(c[k]), k === 1 ? Vr(x) : P(Vr(x), N(k)));
      out = out ? A(out, term) : term;
    }
    return out || N(0);
  };

  /* ===== differentiation ===== */
  function diff(n, x, rules) {
    const R = (r) => { if (rules) rules.add(r); };
    switch (n.t) {
      case 'n': return N(0);
      case 'v': return N(n.n === x ? 1 : 0);
      case 'neg': return Neg(diff(n.a, x, rules));
      case '+': return A(diff(n.a, x, rules), diff(n.b, x, rules));
      case '-': return Sub(diff(n.a, x, rules), diff(n.b, x, rules));
      case '*':
        if (!has(n.a, x)) { R('constant multiple rule'); return M(n.a, diff(n.b, x, rules)); }
        if (!has(n.b, x)) { R('constant multiple rule'); return M(n.b, diff(n.a, x, rules)); }
        R('product rule'); return A(M(diff(n.a, x, rules), n.b), M(n.a, diff(n.b, x, rules)));
      case '/':
        if (!has(n.b, x)) { R('constant multiple rule'); return D(diff(n.a, x, rules), n.b); }
        R('quotient rule');
        return D(Sub(M(diff(n.a, x, rules), n.b), M(n.a, diff(n.b, x, rules))), P(n.b, N(2)));
      case '^': {
        if (!has(n.b, x)) { R('power rule'); const dn = diff(n.a, x, rules); if (!isN(dn, 1)) R('chain rule'); return M(M(n.b, P(n.a, Sub(n.b, N(1)))), dn); }
        if (!has(n.a, x)) { R('exponential rule'); if (n.a.t === 'v' && n.a.n === 'e') return M(n, diff(n.b, x, rules)); return M(M(n, Fn('ln', n.a)), diff(n.b, x, rules)); }
        R('logarithmic differentiation');
        return M(n, A(M(diff(n.b, x, rules), Fn('ln', n.a)), D(M(n.b, diff(n.a, x, rules)), n.a)));
      }
      case 'f': {
        const u = n.a, du = diff(u, x, rules); let d, den = null, sgn = 1;
        switch (n.n) {
          case 'sin': d = Fn('cos', u); break;
          case 'cos': d = Neg(Fn('sin', u)); break;
          case 'tan': den = P(Fn('cos', u), N(2)); break;
          case 'sec': d = M(Fn('sec', u), Fn('tan', u)); break;
          case 'csc': d = Neg(M(Fn('csc', u), Fn('cot', u))); break;
          case 'cot': den = P(Fn('sin', u), N(2)); sgn = -1; break;
          case 'asin': den = Fn('sqrt', Sub(N(1), P(u, N(2)))); break;
          case 'acos': den = Fn('sqrt', Sub(N(1), P(u, N(2)))); sgn = -1; break;
          case 'atan': den = A(N(1), P(u, N(2))); break;
          case 'sinh': d = Fn('cosh', u); break;
          case 'cosh': d = Fn('sinh', u); break;
          case 'tanh': den = P(Fn('cosh', u), N(2)); break;
          case 'exp': d = Fn('exp', u); break;
          case 'ln': den = u; break;
          case 'log': case 'log10': den = M(u, Fn('ln', N(10))); break;
          case 'log2': den = M(u, Fn('ln', N(2))); break;
          case 'sqrt': den = M(N(2), Fn('sqrt', u)); break;
          case 'cbrt': den = M(N(3), P(Fn('cbrt', u), N(2))); break;
          case 'abs': den = Fn('abs', u); d = u; break;
          default: throw new Error('I cannot differentiate ' + n.n + '.');
        }
        if (!isN(du, 1)) R('chain rule');
        if (den) { const r = D(n.n === 'abs' ? M(d, du) : du, den); return sgn < 0 ? Neg(r) : r; }
        return M(d, du);
      }
    }
    throw new Error('Cannot differentiate this expression.');
  }

  /* ===== integration (rule table; every result is verified numerically) ===== */
  function peel(n, x) {
    if (n.t === '*') { if (!has(n.a, x)) { const r = peel(n.b, x); return { c: M(n.a, r.c), g: r.g }; } if (!has(n.b, x)) { const r = peel(n.a, x); return { c: M(n.b, r.c), g: r.g }; } }
    if (n.t === '/' && !has(n.b, x)) { const r = peel(n.a, x); return { c: D(r.c, n.b), g: r.g }; }
    if (n.t === 'neg') { const r = peel(n.a, x); return { c: Neg(r.c), g: r.g }; }
    return { c: N(1), g: n };
  }
  function linearOf(n, x) {
    if (!has(n, x)) return null;
    const c = polyCoeffs(n, x, 1);
    return c && c.length === 2 && c[1] !== 0 ? { a: c[1], b: c[0] } : null;
  }
  const SPECIAL_FN_INT = new Set(['sin', 'cos', 'exp', 'sinh', 'cosh']);
  function integ(n, x, depth) {
    depth = depth || 0; if (depth > 12) return null;
    if (!has(n, x)) return M(n, Vr(x));
    const pe = peel(n, x);
    if (!isN(pe.c, 1)) { const r = integ(pe.g, x, depth + 1); return r && M(pe.c, r); }
    // polynomial in x: integrate term by term
    const pc = polyCoeffs(n, x, 8);
    if (pc) {
      let out = null;
      for (let k = pc.length - 1; k >= 0; k--) {
        const c = pc[k]; if (!c) continue;
        const q = ratify(c, 1000, 1e-9) || [c, 1];
        const coef = D(N(q[0]), N(q[1] * (k + 1)));
        const term = M(coef, k + 1 === 1 ? Vr(x) : P(Vr(x), N(k + 1)));
        out = out ? A(out, term) : term;
      }
      return out || N(0);
    }
    switch (n.t) {
      case '+': { const a = integ(n.a, x, depth + 1), b = a && integ(n.b, x, depth + 1); return a && b && A(a, b); }
      case '-': { const a = integ(n.a, x, depth + 1), b = a && integ(n.b, x, depth + 1); return a && b && Sub(a, b); }
      case '*': {
        if (n.a.t === 'f' && n.b.t === 'f' && ((n.a.n === 'sin' && n.b.n === 'cos') || (n.a.n === 'cos' && n.b.n === 'sin')) && eq(n.a.a, n.b.a)) {
          const l = linearOf(n.a.a, x); if (l) return D(P(Fn('sin', n.a.a), N(2)), N(2 * l.a));
        }
        for (const [p, f] of [[n.a, n.b], [n.b, n.a]]) {
          const pcoef = polyCoeffs(p, x, 6);
          const g = peel(f, x).g;
          const okF = (g.t === 'f' && SPECIAL_FN_INT.has(g.n) && linearOf(g.a, x)) || (g.t === '^' && !has(g.b, x) === false && linearOf(g.b, x) && !has(g.a, x));
          if (pcoef && pcoef.length > 1 && okF) {
            const F1 = integ(f, x, depth + 1); if (!F1) continue;
            const dp = diff(p, x);
            const rest = integ(M(dp, F1), x, depth + 1); if (!rest) continue;
            return Sub(M(p, F1), rest);
          }
          // x^n * ln(x)
          if (pcoef && pcoef.length > 1 && f.t === 'f' && f.n === 'ln' && f.a.t === 'v' && f.a.n === x) {
            const F1 = integ(p, x, depth + 1); if (!F1) continue;
            const rest = integ(D(F1, Vr(x)), x, depth + 1); if (!rest) continue;
            return Sub(M(F1, f), rest);
          }
        }
        return null;
      }
      case '/': {
        if (!has(n.a, x)) { if (n.b.t === 'f' && n.b.n === 'sqrt') return integRecipSqrt(n.a, n.b.a, x); return integRecip(n.a, n.b, x); }
        // u'/u pattern
        const db = diff(n.b, x);
        const pts = [0.31, 0.77, 1.4, 2.3]; let ratio = null, ok = true;
        for (const t of pts) { try { const r = ev(n.a, { [x]: t }) / ev(db, { [x]: t }); if (!isFinite(r)) continue; if (ratio === null) ratio = r; else if (Math.abs(r - ratio) > 1e-9 * Math.max(1, Math.abs(ratio))) ok = false; } catch (e) { ok = false; } }
        if (ok && ratio !== null && ratio !== 0) { const q = ratify(ratio, 1000, 1e-9); return M(q ? D(N(q[0]), N(q[1])) : N(ratio), Fn('ln', Fn('abs', n.b))); }
        return null;
      }
      case '^': {
        if (!has(n.b, x)) {
          const lin = linearOf(n.a, x);
          if (lin && n.b.t === 'n') {
            if (n.b.v === -1) return D(Fn('ln', Fn('abs', n.a)), N(lin.a));
            return D(P(n.a, Nr(n.b.v + 1)), M(N(lin.a), N(n.b.v + 1)));
          }
          if (n.b.t === 'n' && n.b.v === -1) return integRecip(N(1), n.a, x);
          if (n.b.t === 'n' && n.b.v === -0.5) return integRecipSqrt(N(1), n.a, x);
          if (n.b.t === 'n' && n.b.v === 2 && n.a.t === 'f' && (n.a.n === 'sin' || n.a.n === 'cos')) {
            const l = linearOf(n.a.a, x); if (!l) return null;
            const dbl = Fn('sin', M(N(2), n.a.a));
            const sgn = n.a.n === 'sin' ? -1 : 1;
            return A(M(Rat(1, 2), Vr(x)), M(D(N(sgn), N(4 * l.a)), dbl));
          }
          return null;
        }
        if (!has(n.a, x) && (n.a.t === 'n' ? n.a.v > 0 && n.a.v !== 1 : (n.a.t === 'v' && n.a.n === 'e'))) {
          const l = linearOf(n.b, x); if (!l) return null;
          return n.a.t === 'v' ? D(n, N(l.a)) : D(n, M(N(l.a), Fn('ln', n.a)));
        }
        return null;
      }
      case 'f': {
        const l = linearOf(n.a, x); if (!l) return null;
        const u = n.a, a = N(l.a);
        switch (n.n) {
          case 'sin': return D(Neg(Fn('cos', u)), a);
          case 'cos': return D(Fn('sin', u), a);
          case 'tan': return D(Neg(Fn('ln', Fn('abs', Fn('cos', u)))), a);
          case 'exp': return D(Fn('exp', u), a);
          case 'sinh': return D(Fn('cosh', u), a);
          case 'cosh': return D(Fn('sinh', u), a);
          case 'ln': return D(Sub(M(u, Fn('ln', u)), u), a);
          case 'sqrt': return D(M(Rat(2, 3), P(u, Rat(3, 2))), a);
          case 'sec': return D(Fn('ln', Fn('abs', A(Fn('sec', u), Fn('tan', u)))), a);
          case 'atan': if (u.t === 'v') return Sub(M(u, Fn('atan', u)), M(N(0.5), Fn('ln', A(N(1), P(u, N(2)))))); return null;
          default: return null;
        }
      }
    }
    return null;
  }
  // c / q(x) with q quadratic
  function integRecip(c, q, x) {
    const co = polyCoeffs(q, x, 2); if (!co) return null;
    while (co.length < 3) co.push(0);
    const [C0, B, A2] = co;
    if (A2 === 0) { if (B === 0) return null; return D(M(c, Fn('ln', Fn('abs', q))), N(B)); }
    const disc = B * B - 4 * A2 * C0;
    if (disc < 0) {
      const sq = Math.sqrt(-disc), sNode = Number.isInteger(sq) ? N(sq) : Fn('sqrt', N(-disc));
      return M(D(M(N(2), c), sNode), Fn('atan', D(A(M(N(2 * A2), Vr(x)), N(B)), sNode)));
    }
    if (disc === 0) return null;
    const sq = Math.sqrt(disc), r1 = (-B + sq) / (2 * A2), r2 = (-B - sq) / (2 * A2);
    return M(D(c, N(A2 * (r1 - r2))), Fn('ln', Fn('abs', D(Sub(Vr(x), N(r1)), Sub(Vr(x), N(r2))))));
  }
  function integRecipSqrt(c, q, x) {
    const co = polyCoeffs(q, x, 2); if (!co) return null;
    while (co.length < 3) co.push(0);
    const [C0, B, A2] = co;
    if (B === 0 && A2 < 0 && C0 > 0) { const k = Math.sqrt(-A2); return M(D(c, N(k)), Fn('asin', M(N(k / Math.sqrt(C0)), Vr(x)))); }
    return null;
  }

  function numDeriv(f, t) { const h = 1e-5 * Math.max(1, Math.abs(t)); return (f(t + h) - f(t - h)) / (2 * h); }
  // check that d/dx F == f at several points; returns {ok, n, maxErr}
  function verifyAntiderivative(F, f, x) {
    let n = 0, maxErr = 0;
    for (const t of [0.31, 0.77, 1.4, 2.3, -0.6, -1.7, 3.1]) {
      try {
        const a = numDeriv((u) => ev(F, { [x]: u }), t), b = ev(f, { [x]: t });
        if (!isFinite(a) || !isFinite(b)) continue;
        const err = Math.abs(a - b) / Math.max(1, Math.abs(b)); n++; if (err > maxErr) maxErr = err;
      } catch (e) { /* skip point */ }
    }
    return { ok: n >= 2 && maxErr < 1e-5, n, maxErr };
  }
  function simpson(f, a, b, n) {
    n = n || 4000; if (n % 2) n++;
    const h = (b - a) / n; let s = f(a) + f(b);
    for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return s * h / 3;
  }
  /* ===== polynomial / equation solving ===== */
  function polyRoots(c) { // c[0] + c[1] x + ... ; returns [{re,im}]
    const n = c.length - 1;
    if (n < 1) return [];
    if (n === 1) return [{ re: -c[0] / c[1], im: 0 }];
    if (n === 2) {
      const [C, B, A2] = c, d = B * B - 4 * A2 * C;
      if (d >= 0) { const s = Math.sqrt(d); return [{ re: (-B + s) / (2 * A2), im: 0 }, { re: (-B - s) / (2 * A2), im: 0 }]; }
      const s = Math.sqrt(-d); return [{ re: -B / (2 * A2), im: s / (2 * A2) }, { re: -B / (2 * A2), im: -s / (2 * A2) }];
    }
    const lead = c[n], a = c.map((v) => v / lead);
    const mul = (p, q) => ({ re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re });
    const sub = (p, q) => ({ re: p.re - q.re, im: p.im - q.im });
    const div = (p, q) => { const d = q.re * q.re + q.im * q.im; return { re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d }; };
    const horner = (z) => { let r = { re: 1, im: 0 }; for (let k = n - 1; k >= 0; k--) { r = mul(r, z); r.re += a[k]; } return r; };
    let roots = Array.from({ length: n }, (_, k) => { let z = { re: 1, im: 0 }; const b = { re: 0.4, im: 0.9 }; for (let i = 0; i < k; i++) z = mul(z, b); return z; });
    for (let it = 0; it < 800; it++) {
      let delta = 0;
      roots = roots.map((z, i) => {
        let den = { re: 1, im: 0 };
        roots.forEach((w, j) => { if (j !== i) den = mul(den, sub(z, w)); });
        const corr = div(horner(z), den), nz = sub(z, corr);
        delta = Math.max(delta, Math.abs(corr.re) + Math.abs(corr.im)); return nz;
      });
      if (delta < 1e-14) break;
    }
    return roots.map((z) => ({ re: Math.abs(z.re) < 1e-10 ? 0 : z.re, im: Math.abs(z.im) < 1e-9 ? 0 : z.im }));
  }
  function scanRoots(f, lo, hi, steps) {
    const out = []; let px = lo, py = f(px);
    for (let i = 1; i <= steps; i++) {
      const x = lo + (hi - lo) * i / steps, y = f(x);
      if (isFinite(py) && isFinite(y)) {
        if (py === 0) out.push(px);
        else if (py * y < 0) {
          let a = px, b = x, fa = py;
          for (let k = 0; k < 200; k++) { const m = (a + b) / 2, fm = f(m); if (fm === 0) { a = b = m; break; } if (fa * fm < 0) b = m; else { a = m; fa = fm; } }
          const r = (a + b) / 2, fr = f(r);
          if (Math.abs(fr) < 1e-6 * Math.max(1, Math.abs(py), Math.abs(y))) out.push(r);
        }
      }
      px = x; py = y;
    }
    const uniq = [];
    out.sort((p, q) => p - q).forEach((r) => { if (!uniq.length || Math.abs(r - uniq[uniq.length - 1]) > 1e-9 * Math.max(1, Math.abs(r))) uniq.push(r); });
    return uniq;
  }
  function geomRoots(f) { // search across magnitudes, both signs
    const out = [];
    for (const sg of [1, -1]) {
      const g = (t) => f(sg * t);
      let prev = null, pt = null;
      for (let e = -14; e <= 14.001; e += 0.01) {
        const t = Math.pow(10, e), y = g(t);
        if (prev !== null && isFinite(prev) && isFinite(y) && prev * y < 0) {
          let a = pt, b = t, fa = prev;
          for (let k = 0; k < 200; k++) { const m = Math.sqrt(a * b), fm = g(m); if (fa * fm < 0) b = m; else { a = m; fa = fm; } }
          const r = Math.sqrt(a * b); if (Math.abs(g(r)) < 1e-6 * Math.max(1, Math.abs(prev), Math.abs(y))) out.push(sg * r);
        }
        prev = y; pt = t;
      }
    }
    return out;
  }
  function splitEquation(txt) {
    const i = txt.indexOf('=');
    if (i < 0) throw new Error('There is no "=" sign in the equation.');
    if (txt.indexOf('=', i + 1) >= 0) throw new Error('More than one "=" sign in one equation.');
    return [txt.slice(0, i), txt.slice(i + 1)];
  }

  /* ===== chemistry data ===== */
  const ELEMENTS_RAW = [[1,"H","Hydrogen",1.008,1,1,"s","Nonmetals","1s1","+1, -1",2.2,"Gas",13.99,20.27,0.000082],[2,"He","Helium",4.002602,1,18,"s","Noble gases","1s2","None typical","Not applicable / not determined","Not experimentally determined","Not determined",4.22,0.000164],[3,"Li","Lithium",6.94,2,1,"s","Alkali metals","[He] 2s1","+1",0.98,"Solid",453.65,1615.15,0.534],[4,"Be","Beryllium",9.0121831,2,2,"s","Alkaline earth metals","[He] 2s2","+2",1.57,"Solid",1560.15,2741.15,1.85],[5,"B","Boron",10.81,2,13,"p","Metalloids","[He] 2s2 2p1","+3",2.04,"Solid",2350.15,4273.15,2.34],[6,"C","Carbon",12.011,2,14,"p","Nonmetals","[He] 2s2 2p2","+4, -4",2.55,"Not experimentally determined","Not determined",4098.15,2.2],[7,"N","Nitrogen",14.007,2,15,"p","Nonmetals","[He] 2s2 2p3","+5, +3, -3",3.04,"Gas",63.15,77.35,0.001145],[8,"O","Oxygen",15.999,2,16,"p","Nonmetals","[He] 2s2 2p4","-2",3.44,"Gas",54.36,90.19,0.001308],[9,"F","Fluorine",18.998403163,2,17,"p","Halogens","[He] 2s2 2p5","-1",3.98,"Gas",53.48,85.04,0.001553],[10,"Ne","Neon",20.1797,2,18,"p","Noble gases","[He] 2s2 2p6","None typical","Not applicable / not determined","Gas",24.56,27.1,0.000825],[11,"Na","Sodium",22.98976928,3,1,"s","Alkali metals","[Ne] 3s1","+1",0.93,"Solid",370.94,1156.09,0.97],[12,"Mg","Magnesium",24.305,3,2,"s","Alkaline earth metals","[Ne] 3s2","+2",1.31,"Solid",923.15,1363.15,1.74],[13,"Al","Aluminum",26.9815385,3,13,"p","Post-transition metals","[Ne] 3s2 3p1","+3",1.61,"Solid",933.47,2792.15,2.7],[14,"Si","Silicon",28.085,3,14,"p","Metalloids","[Ne] 3s2 3p2","+4, -4",1.9,"Solid",1687.15,3538.15,2.3296],[15,"P","Phosphorus",30.973761998,3,15,"p","Nonmetals","[Ne] 3s2 3p3","+5, +3, -3",2.19,"Not experimentally determined","Not determined","Not determined",1.823],[16,"S","Sulfur",32.06,3,16,"p","Nonmetals","[Ne] 3s2 3p4","+6, +4, +2, -2",2.58,"Not experimentally determined","Not determined",717.76,2.07],[17,"Cl","Chlorine",35.45,3,17,"p","Halogens","[Ne] 3s2 3p5","+7, +5, +3, +1, -1",3.16,"Gas",171.65,239.11,0.002898],[18,"Ar","Argon",39.948,3,18,"p","Noble gases","[Ne] 3s2 3p6","None typical","Not applicable / not determined","Gas",83.81,87.3,0.001633],[19,"K","Potassium",39.0983,4,1,"s","Alkali metals","[Ar] 4s1","+1",0.82,"Solid",336.65,1032.15,0.89],[20,"Ca","Calcium",40.078,4,2,"s","Alkaline earth metals","[Ar] 4s2","+2",1,"Solid",1115.15,1757.15,1.54],[21,"Sc","Scandium",44.955908,4,3,"d","Transition metals","[Ar] 3d1 4s2","+3",1.36,"Solid",1814.15,3109.15,2.99],[22,"Ti","Titanium",47.867,4,4,"d","Transition metals","[Ar] 3d2 4s2","+4",1.54,"Solid",1943.15,3560.15,4.506],[23,"V","Vanadium",50.9415,4,5,"d","Transition metals","[Ar] 3d3 4s2","+5",1.63,"Solid",2183.15,3680.15,6],[24,"Cr","Chromium",51.9961,4,6,"d","Transition metals","[Ar] 3d5 4s1","+6, +3",1.66,"Solid",2180.15,2944.15,7.15],[25,"Mn","Manganese",54.938044,4,7,"d","Transition metals","[Ar] 3d5 4s2","+7, +4, +2",1.55,"Solid",1519.15,2334.15,7.3],[26,"Fe","Iron",55.845,4,8,"d","Transition metals","[Ar] 3d6 4s2","+3, +2",1.83,"Solid",1811.15,3134.15,7.87],[27,"Co","Cobalt",58.933194,4,9,"d","Transition metals","[Ar] 3d7 4s2","+3, +2",1.88,"Solid",1768.15,3200.15,8.86],[28,"Ni","Nickel",58.6934,4,10,"d","Transition metals","[Ar] 3d8 4s2","+2",1.91,"Solid",1728.15,3186.15,8.9],[29,"Cu","Copper",63.546,4,11,"d","Transition metals","[Ar] 3d10 4s1","+2",1.9,"Solid",1357.77,2833.15,8.96],[30,"Zn","Zinc",65.38,4,12,"d","Transition metals","[Ar] 3d10 4s2","+2",1.65,"Solid",692.68,1180.15,7.134],[31,"Ga","Gallium",69.723,4,13,"p","Post-transition metals","[Ar] 3d10 4s2 4p1","+3",1.81,"Solid",302.91,2502.15,5.91],[32,"Ge","Germanium",72.63,4,14,"p","Metalloids","[Ar] 3d10 4s2 4p2","+4, +2, -4",2.01,"Solid",1211.4,3106.15,5.3234],[33,"As","Arsenic",74.921595,4,15,"p","Metalloids","[Ar] 3d10 4s2 4p3","+5, +3, -3",2.18,"Solid",1090.15,889.15,5.75],[34,"Se","Selenium",78.971,4,16,"p","Nonmetals","[Ar] 3d10 4s2 4p4","+6, +4, +2, -2",2.55,"Not experimentally determined","Not determined",958.15,4.809],[35,"Br","Bromine",79.904,4,17,"p","Halogens","[Ar] 3d10 4s2 4p5","+5, +3, +1, -1",2.96,"Liquid",265.95,331.95,3.1028],[36,"Kr","Krypton",83.798,4,18,"p","Noble gases","[Ar] 3d10 4s2 4p6","+2","Not applicable / not determined","Gas",115.78,119.73,0.003425],[37,"Rb","Rubidium",85.4678,5,1,"s","Alkali metals","[Kr] 5s1","+1",0.82,"Solid",312.45,961.15,1.53],[38,"Sr","Strontium",87.62,5,2,"s","Alkaline earth metals","[Kr] 5s2","+2",0.95,"Solid",1050.15,1650.15,2.64],[39,"Y","Yttrium",88.90584,5,3,"d","Transition metals","[Kr] 4d1 5s2","+3",1.22,"Solid",1795.15,3618.15,4.47],[40,"Zr","Zirconium",91.224,5,4,"d","Transition metals","[Kr] 4d2 5s2","+4",1.33,"Solid",2127.15,4679.15,6.52],[41,"Nb","Niobium",92.90637,5,5,"d","Transition metals","[Kr] 4d4 5s1","+5",1.6,"Solid",2750.15,5014.15,8.57],[42,"Mo","Molybdenum",95.95,5,6,"d","Transition metals","[Kr] 4d5 5s1","+6, +4",2.16,"Solid",2895.15,4912.15,10.2],[43,"Tc","Technetium",97.90721,5,7,"d","Transition metals","[Kr] 4d5 5s2","+7, +4",2.1,"Solid",2430.15,4535.15,11],[44,"Ru","Ruthenium",101.07,5,8,"d","Transition metals","[Kr] 4d7 5s1","+4, +3",2.2,"Solid",2606.15,4420.15,12.1],[45,"Rh","Rhodium",102.9055,5,9,"d","Transition metals","[Kr] 4d8 5s1","+3",2.28,"Solid",2236.15,3968.15,12.4],[46,"Pd","Palladium",106.42,5,10,"d","Transition metals","[Kr] 4d10","+4, +2",2.2,"Solid",1827.95,3236.15,12],[47,"Ag","Silver",107.8682,5,11,"d","Transition metals","[Kr] 4d10 5s1","+1",1.93,"Solid",1234.93,2435.15,10.5],[48,"Cd","Cadmium",112.414,5,12,"d","Transition metals","[Kr] 4d10 5s2","+2",1.69,"Solid",594.22,1040.15,8.69],[49,"In","Indium",114.818,5,13,"p","Post-transition metals","[Kr] 4d10 5s2 5p1","+3",1.78,"Solid",429.75,2300.15,7.31],[50,"Sn","Tin",118.71,5,14,"p","Post-transition metals","[Kr] 4d10 5s2 5p2","+4, +2, -4",1.96,"Not experimentally determined","Not determined",2859.15,7.287],[51,"Sb","Antimony",121.76,5,15,"p","Metalloids","[Kr] 4d10 5s2 5p3","+5, +3, -3",2.05,"Solid",903.78,1860.15,6.68],[52,"Te","Tellurium",127.6,5,16,"p","Metalloids","[Kr] 4d10 5s2 5p4","+6, +4, +2, -2",2.1,"Solid",722.66,1261.15,6.232],[53,"I","Iodine",126.90447,5,17,"p","Halogens","[Kr] 4d10 5s2 5p5","+7, +5, +3, +1, -1",2.66,"Solid",386.85,457.55,4.933],[54,"Xe","Xenon",131.293,5,18,"p","Noble gases","[Kr] 4d10 5s2 5p6","+6, +4, +2",2.6,"Gas",161.4,165.05,0.005365999999999999],[55,"Cs","Cesium",132.90545196,6,1,"s","Alkali metals","[Xe] 6s1","+1",0.79,"Solid",301.65,944.15,1.873],[56,"Ba","Barium",137.327,6,2,"s","Alkaline earth metals","[Xe] 6s2","+2",0.89,"Solid",1000.15,2118.15,3.62],[57,"La","Lanthanum",138.90547,6,3,"d","Lanthanides","[Xe] 5d1 6s2","+3",1.1,"Solid",1193.15,3737.15,6.15],[58,"Ce","Cerium",140.116,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f1 5d1 6s2","+4, +3",1.12,"Solid",1072.15,3716.15,6.77],[59,"Pr","Praseodymium",140.90766,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f3 6s2","+3",1.13,"Solid",1204.15,3793.15,6.773],[60,"Nd","Neodymium",144.242,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f4 6s2","+3",1.14,"Solid",1289.15,3347.15,7.01],[61,"Pm","Promethium",144.91276,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f5 6s2","+3","Not applicable / not determined","Solid",1315.15,"Not determined",7.26],[62,"Sm","Samarium",150.36,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f6 6s2","+3",1.17,"Solid",1345.15,2067.15,7.52],[63,"Eu","Europium",151.964,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f7 6s2","+3, +2","Not applicable / not determined","Solid",1095.15,1802.15,5.24],[64,"Gd","Gadolinium",157.25,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f7 5d1 6s2","+3",1.2,"Solid",1586.15,3546.15,7.9],[65,"Tb","Terbium",158.92535,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f9 6s2","+3","Not applicable / not determined","Solid",1632.15,3503.15,8.23],[66,"Dy","Dysprosium",162.5,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f10 6s2","+3",1.22,"Solid",1685.15,2840.15,8.55],[67,"Ho","Holmium",164.93033,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f11 6s2","+3",1.23,"Solid",1745.15,2973.15,8.8],[68,"Er","Erbium",167.259,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f12 6s2","+3",1.24,"Solid",1802.15,3141.15,9.07],[69,"Tm","Thulium",168.93422,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f13 6s2","+3",1.25,"Solid",1818.15,2223.15,9.321],[70,"Yb","Ytterbium",173.045,6,"f-block (unnumbered in 18-column IUPAC system)","f","Lanthanides","[Xe] 4f14 6s2","+3","Not applicable / not determined","Solid",1097.15,1469.15,6.9],[71,"Lu","Lutetium",174.9668,6,"f-block (unnumbered in 18-column IUPAC system)","f","Transition metals","[Xe] 4f14 5d1 6s2","+3",1,"Solid",1936.15,3675.15,9.84],[72,"Hf","Hafnium",178.49,6,4,"d","Transition metals","[Xe] 4f14 5d2 6s2","+4",1.3,"Solid",2506.15,4873.15,13.3],[73,"Ta","Tantalum",180.94788,6,5,"d","Transition metals","[Xe] 4f14 5d3 6s2","+5",1.5,"Solid",3290.15,5728.15,16.4],[74,"W","Tungsten",183.84,6,6,"d","Transition metals","[Xe] 4f14 5d4 6s2","+6, +4",1.7,"Solid",3687.15,5828.15,19.3],[75,"Re","Rhenium",186.207,6,7,"d","Transition metals","[Xe] 4f14 5d5 6s2","+4",1.9,"Solid",3458.15,5863.15,20.8],[76,"Os","Osmium",190.23,6,8,"d","Transition metals","[Xe] 4f14 5d6 6s2","+4",2.2,"Solid",3306.15,5281.15,22.5872],[77,"Ir","Iridium",192.217,6,9,"d","Transition metals","[Xe] 4f14 5d7 6s2","+4, +3",2.2,"Solid",2719.15,4701.15,22.5622],[78,"Pt","Platinum",195.084,6,10,"d","Transition metals","[Xe] 4f14 5d9 6s1","+4, +2",2.2,"Solid",2041.35,4098.15,21.5],[79,"Au","Gold",196.966569,6,11,"d","Transition metals","[Xe] 4f14 5d10 6s1","+3",2.4,"Solid",1337.33,3109.15,19.3],[80,"Hg","Mercury",200.592,6,12,"d","Transition metals","[Xe] 4f14 5d10 6s2","+2, +1",1.9,"Liquid",234.32,629.77,13.5336],[81,"Tl","Thallium",204.38,6,13,"p","Post-transition metals","[Xe] 4f14 5d10 6s2 6p1","+3, +1",1.8,"Solid",577.15,1746.15,11.8],[82,"Pb","Lead",207.2,6,14,"p","Post-transition metals","[Xe] 4f14 5d10 6s2 6p2","+4, +2",1.8,"Solid",600.61,2022.15,11.3],[83,"Bi","Bismuth",208.9804,6,15,"p","Post-transition metals","[Xe] 4f14 5d10 6s2 6p3","+3",1.9,"Solid",544.55,1837.15,9.79],[84,"Po","Polonium",209,6,16,"p","Metalloids","[Xe] 4f14 5d10 6s2 6p4","+4, +2, -2",2,"Solid",527.15,1235.15,9.2],[85,"At","Astatine",210,6,17,"p","Halogens","[Xe] 4f14 5d10 6s2 6p5","+1, -1",2.2,"Solid",575.15,"Not determined",7],[86,"Rn","Radon",222,6,18,"p","Noble gases","[Xe] 4f14 5d10 6s2 6p6","None typical","Not applicable / not determined","Gas",202.15,211.45,0.009074],[87,"Fr","Francium",223,7,1,"s","Alkali metals","[Rn] 7s1","+1",0.7,"Gas",294.15,"Not determined",1.87],[88,"Ra","Radium",226,7,2,"s","Alkaline earth metals","[Rn] 7s2","+2",0.9,"Solid",969.15,"Not determined",5],[89,"Ac","Actinium",227,7,3,"d","Actinides","[Rn] 6d1 7s2","+3",1.1,"Solid",1323.15,3473.15,10],[90,"Th","Thorium",232.0377,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 6d2 7s2","+4",1.3,"Solid",2023.15,5058.15,11.7],[91,"Pa","Protactinium",231.03588,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 5f2 6d1 7s2","+5",1.5,"Solid",1845.15,"Not determined",15.4],[92,"U","Uranium",238.02891,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 5f3 6d1 7s2","+6",1.7,"Solid",1408.15,4404.15,19.1],[93,"Np","Neptunium",237,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 5f4 6d1 7s2","+5",1.3,"Solid",917.15,"Not determined",20.2],[94,"Pu","Plutonium",244,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 5f6 7s2","+4",1.3,"Solid",913.15,3501.15,19.7],[95,"Am","Americium",243,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 5f7 7s2","+3","Not applicable / not determined","Solid",1449.15,"Not determined",12],[96,"Cm","Curium",247,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 5f7 6d1 7s2","+3","Not applicable / not determined","Solid",1618.15,"Not determined",13.51],[97,"Bk","Berkelium",247,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 5f9 7s2","+3","Not applicable / not determined","Solid",1259.15,"Not determined",14.78],[98,"Cf","Californium",251,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 5f10 7s2","+3","Not applicable / not determined","Solid",1173.15,"Not determined",15.1],[99,"Es","Einsteinium",252,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 5f11 7s2","+3","Not applicable / not determined","Solid",1133.15,"Not determined",8.84],[100,"Fm","Fermium",257,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 5f12 7s2","+3","Not applicable / not determined","Solid",1800.15,"Not determined",9.7],[101,"Md","Mendelevium",258,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 5f13 7s2","+3","Not applicable / not determined","Solid",1100.15,"Not determined",10.3],[102,"No","Nobelium",259,7,"f-block (unnumbered in 18-column IUPAC system)","f","Actinides","[Rn] 5f14 7s2","+3","Not applicable / not determined","Solid",1100.15,"Not determined",9.9],[103,"Lr","Lawrencium",262,7,"f-block (unnumbered in 18-column IUPAC system)","f","Transition metals","[Rn] 5f14 7s2 7p1","+3","Not applicable / not determined","Solid",1900.15,"Not determined",15.6],[104,"Rf","Rutherfordium",267,7,4,"d","Transition metals","[Rn] 5f14 6d2 7s2","+4","Not applicable / not determined","Solid (predicted, metallic) - unconfirmed, only atoms produced","Not determined","Not determined",23.3],[105,"Db","Dubnium",268,7,5,"d","Transition metals","[Rn] 5f14 6d3 7s2","None typical","Not applicable / not determined","Solid (predicted, metallic) - unconfirmed, only atoms produced","Not determined","Not determined",29.3],[106,"Sg","Seaborgium",271,7,6,"d","Transition metals","[Rn] 5f14 6d4 7s2","None typical","Not applicable / not determined","Solid (predicted, metallic) - unconfirmed, only atoms produced","Not determined","Not determined",35],[107,"Bh","Bohrium",274,7,7,"d","Transition metals","[Rn] 5f14 6d5 7s2","None typical","Not applicable / not determined","Solid (predicted, metallic) - unconfirmed, only atoms produced","Not determined","Not determined",37.1],[108,"Hs","Hassium",269,7,8,"d","Transition metals","[Rn] 5f14 6d6 7s2","None typical","Not applicable / not determined","Solid (predicted, metallic) - unconfirmed, only atoms produced","Not determined","Not determined",40.7],[109,"Mt","Meitnerium",276,7,9,"d","Transition metals","[Rn] 5f14 6d7 7s2","None typical","Not applicable / not determined","Solid (predicted, metallic) - unconfirmed, only atoms produced","Not determined","Not determined",37.4],[110,"Ds","Darmstadtium",281,7,10,"d","Transition metals","[Rn] 5f14 6d9 7s1","None typical","Not applicable / not determined","Solid (predicted, metallic) - unconfirmed, only atoms produced","Not determined","Not determined",34.8],[111,"Rg","Roentgenium",281,7,11,"d","Transition metals","[Rn] 5f14 6d10 7s1","None typical","Not applicable / not determined","Solid (predicted, metallic) - unconfirmed, only atoms produced","Not determined","Not determined",28.7],[112,"Cn","Copernicium",285,7,12,"d","Transition metals","[Rn] 5f14 6d10 7s2","None typical","Not applicable / not determined","Predicted liquid or volatile gas at STP (relativistic effects, Hg-like) - unconfirmed","Not determined","Not determined",14],[113,"Nh","Nihonium",286,7,13,"p","Post-transition metals","[Rn] 5f14 6d10 7s2 7p1","None typical","Not applicable / not determined","Solid (predicted, metallic) - unconfirmed, only atoms produced","Not determined","Not determined",16],[114,"Fl","Flerovium",289,7,14,"p","Post-transition metals","[Rn] 5f14 6d10 7s2 7p2","None typical","Not applicable / not determined","Predicted volatile liquid/gas at STP (relativistic effects) - unconfirmed","Not determined","Not determined",9.928],[115,"Mc","Moscovium",288,7,15,"p","Post-transition metals","[Rn] 5f14 6d10 7s2 7p3","None typical","Not applicable / not determined","Solid (predicted, metallic) - unconfirmed, only atoms produced","Not determined","Not determined",13.5],[116,"Lv","Livermorium",293,7,16,"p","Post-transition metals","[Rn] 5f14 6d10 7s2 7p4","None typical","Not applicable / not determined","Solid (predicted, metallic) - unconfirmed, only atoms produced","Not determined","Not determined",12.9],[117,"Ts","Tennessine",294,7,17,"p","Halogens","[Rn] 5f14 6d10 7s2 7p5","None typical","Not applicable / not determined","Solid (predicted; unlike lighter halogens, due to relativistic effects) - unconfirmed","Not determined","Not determined",7.2],[118,"Og","Oganesson",294,7,18,"p","Noble gases","[Rn] 5f14 6d10 7s2 7p6","None typical","Not applicable / not determined","Solid (predicted; unlike other noble gases, due to relativistic effects) - unconfirmed","Not determined","Not determined",7]];
  const EL = ELEMENTS_RAW.map((r) => ({ z: r[0], sym: r[1], name: r[2], mass: r[3], period: r[4], group: r[5], block: r[6], family: r[7], config: r[8], ox: r[9], en: r[10], state: r[11], mp: r[12], bp: r[13], dens: r[14] }));
  const BYSYM = {}, BYNAME = {}, BYZ = {};
  EL.forEach((e) => { BYSYM[e.sym] = e; BYNAME[e.name.toLowerCase()] = e; BYZ[e.z] = e; });
  BYNAME.aluminium = BYNAME.aluminum; BYNAME.sulphur = BYNAME.sulfur; BYNAME.caesium = BYNAME.cesium;
  const COMMON = {
    'water': 'H2O', 'carbon dioxide': 'CO2', 'carbon monoxide': 'CO', 'glucose': 'C6H12O6', 'ammonia': 'NH3', 'methane': 'CH4', 'ethane': 'C2H6', 'propane': 'C3H8', 'butane': 'C4H10', 'ethanol': 'C2H5OH', 'methanol': 'CH3OH',
    'acetic acid': 'CH3COOH', 'sulfuric acid': 'H2SO4', 'sulphuric acid': 'H2SO4', 'hydrochloric acid': 'HCl', 'nitric acid': 'HNO3', 'phosphoric acid': 'H3PO4', 'sodium chloride': 'NaCl', 'table salt': 'NaCl', 'sodium hydroxide': 'NaOH',
    'potassium hydroxide': 'KOH', 'calcium hydroxide': 'Ca(OH)2', 'calcium carbonate': 'CaCO3', 'sodium bicarbonate': 'NaHCO3', 'baking soda': 'NaHCO3', 'sodium carbonate': 'Na2CO3', 'potassium permanganate': 'KMnO4',
    'copper sulfate': 'CuSO4', 'copper sulphate': 'CuSO4', 'silver nitrate': 'AgNO3', 'zinc oxide': 'ZnO', 'titanium dioxide': 'TiO2', 'silica': 'SiO2', 'silicon dioxide': 'SiO2', 'magnetite': 'Fe3O4', 'hematite': 'Fe2O3',
    'ferric oxide': 'Fe2O3', 'iron(iii) oxide': 'Fe2O3', 'cobalt ferrite': 'CoFe2O4', 'nickel ferrite': 'NiFe2O4', 'zinc ferrite': 'ZnFe2O4', 'zinc acetate': 'Zn(CH3COO)2', 'ferric nitrate': 'Fe(NO3)3', 'iron nitrate': 'Fe(NO3)3',
    'cobalt nitrate': 'Co(NO3)2', 'tetraethyl orthosilicate': 'Si(OC2H5)4', 'teos': 'Si(OC2H5)4', 'hydrogen peroxide': 'H2O2', 'urea': 'CH4N2O', 'sucrose': 'C12H22O11', 'aluminium oxide': 'Al2O3', 'aluminum oxide': 'Al2O3', 'alumina': 'Al2O3',
  };
  const COMMON_KEYS = Object.keys(COMMON).sort((a, b) => b.length - a.length);

  function parseGroup(str) {
    let i = 0; const stack = [{}];
    while (i < str.length) {
      const c = str[i];
      if (c === '(' || c === '[') { stack.push({}); i++; continue; }
      if (c === ')' || c === ']') {
        if (stack.length < 2) return null;
        const g = stack.pop(); i++;
        const m = /^\d+/.exec(str.slice(i)); let k = 1; if (m) { k = +m[0]; i += m[0].length; }
        const top = stack[stack.length - 1]; for (const e in g) top[e] = (top[e] || 0) + g[e] * k; continue;
      }
      const m = /^[A-Z][a-z]?/.exec(str.slice(i)); if (!m) return null;
      let sym = m[0]; if (!BYSYM[sym]) { if (sym.length === 2 && BYSYM[sym[0]]) sym = sym[0]; else return null; }
      i += sym.length;
      const nn = /^\d+/.exec(str.slice(i)); let k = 1; if (nn) { k = +nn[0]; i += nn[0].length; }
      const top = stack[stack.length - 1]; top[sym] = (top[sym] || 0) + k;
    }
    return stack.length === 1 ? stack[0] : null;
  }
  function parseFormula(raw) {
    let s = String(raw).trim().replace(/\s+/g, '').replace(/[\u2080-\u2089]/g, (d) => String(d.charCodeAt(0) - 0x2080)).replace(/\((?:s|l|g|aq)\)$/, '');
    if (!s) return null;
    const parts = s.split(/[\u00B7\u2022*]|\.(?=\d*[A-Z(])/);
    const total = {};
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i], mult = 1;
      if (i > 0) { const m = /^(\d+)(.*)$/.exec(part); if (m) { mult = +m[1]; part = m[2]; } }
      if (!part) return null;
      const g = parseGroup(part); if (!g) return null;
      for (const e in g) total[e] = (total[e] || 0) + g[e] * mult;
    }
    return Object.keys(total).length ? total : null;
  }
  const massOf = (counts) => Object.keys(counts).reduce((s, e) => s + BYSYM[e].mass * counts[e], 0);
  function formulaTeX(f) {
    return '\\mathrm{' + String(f).replace(/\s+/g, '').replace(/\((?:s|l|g|aq)\)$/, '').replace(/[\u00B7\u2022*]/g, '\\cdot ').replace(/(\d+)/g, (m, d, off, str) => (off > 0 && /[A-Za-z)\]]/.test(str[off - 1]) ? '_{' + d + '}' : d)) + '}';
  }
  function resolveSpecies(tok) { // tok: formula or common name -> {formula, counts}
    const t = String(tok).trim(); if (!t) return null;
    const low = t.toLowerCase().replace(/\s+/g, ' ');
    if (COMMON[low]) return { formula: COMMON[low], counts: parseFormula(COMMON[low]), name: low };
    const c = parseFormula(t); return c ? { formula: t.replace(/\s+/g, ''), counts: c } : null;
  }

  /* exact rational nullspace for balancing */
  function balanceEquation(eqText) {
    const sides = eqText.split(/\s*(?:<->|<=>|->|\u2192|=>|\u21CC|\u27F6|\u21D2|=)\s*/);
    if (sides.length !== 2 || !sides[0].trim() || !sides[1].trim()) return { ok: false, error: 'Write the equation with an arrow, for example: H2 + O2 -> H2O' };
    const readSide = (s) => s.split(/\s*\+\s*(?=[\d(A-Z\[])/).map((x) => x.trim()).filter(Boolean).map((x) => {
      const m = /^(\d+)\s*(.+)$/.exec(x); const body = m && parseFormula(m[2]) && !parseFormula(x) ? m[2] : x;
      return body.replace(/\s+/g, '');
    });
    const L = readSide(sides[0]), R = readSide(sides[1]);
    const species = L.map((f) => ({ f, side: 1 })).concat(R.map((f) => ({ f, side: -1 })));
    for (const sp of species) { sp.counts = parseFormula(sp.f); if (!sp.counts) return { ok: false, error: '"' + sp.f + '" is not a valid chemical formula (check capital letters, e.g. NaCl, CO2).' }; }
    const elems = [...new Set(species.flatMap((sp) => Object.keys(sp.counts)))];
    const miss = elems.filter((e) => !species.some((sp) => sp.side === 1 && sp.counts[e]) || !species.some((sp) => sp.side === -1 && sp.counts[e]));
    if (miss.length) return { ok: false, error: 'Element ' + miss.join(', ') + ' appears on only one side, so the equation cannot be balanced.' };
    // BigInt fractions
    const n = species.length, rows = elems.length;
    const gcdB = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) { [a, b] = [b, a % b]; } return a; };
    const fr = (p, q) => { q = q === undefined ? 1n : q; if (q < 0n) { p = -p; q = -q; } const g = gcdB(p, q) || 1n; return [p / g, q / g]; };
    const fsub = (a, b) => fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
    const fmul = (a, b) => fr(a[0] * b[0], a[1] * b[1]);
    const fdiv = (a, b) => fr(a[0] * b[1], a[1] * b[0]);
    const Mx = elems.map((e) => species.map((sp) => fr(BigInt((sp.counts[e] || 0) * sp.side))));
    const piv = []; let r = 0;
    for (let c = 0; c < n && r < rows; c++) {
      let p = -1; for (let i = r; i < rows; i++) if (Mx[i][c][0] !== 0n) { p = i; break; }
      if (p < 0) continue;
      [Mx[r], Mx[p]] = [Mx[p], Mx[r]];
      const pv = Mx[r][c]; Mx[r] = Mx[r].map((x) => fdiv(x, pv));
      for (let i = 0; i < rows; i++) if (i !== r && Mx[i][c][0] !== 0n) { const f = Mx[i][c]; Mx[i] = Mx[i].map((x, k) => fsub(x, fmul(f, Mx[r][k]))); }
      piv.push(c); r++;
    }
    const free = []; for (let c = 0; c < n; c++) if (!piv.includes(c)) free.push(c);
    if (free.length === 0) return { ok: false, error: 'No set of positive whole-number coefficients balances this equation (check the formulas).' };
    if (free.length > 1) return { ok: false, error: 'This equation can be balanced in more than one independent way, so there is no single answer. Check that the formulas are correct.' };
    const f0 = free[0]; const vec = Array(n).fill(null); vec[f0] = fr(1n);
    piv.forEach((pc, ri) => { vec[pc] = fr(-Mx[ri][f0][0], Mx[ri][f0][1]); });
    let lcm = 1n; vec.forEach((v) => { lcm = lcm * v[1] / gcdB(lcm, v[1]); });
    let ints = vec.map((v) => v[0] * lcm / v[1]);
    let g = 0n; ints.forEach((v) => { g = gcdB(g, v); }); ints = ints.map((v) => v / (g || 1n));
    if (ints.every((v) => v <= 0n)) ints = ints.map((v) => -v);
    if (ints.some((v) => v <= 0n)) return { ok: false, error: 'No set of positive whole-number coefficients balances this equation (check the formulas).' };
    const coefs = ints.map(Number);
    species.forEach((sp, i) => { sp.coef = coefs[i]; sp.mass = massOf(sp.counts); });
    // verification: atoms on both sides
    const tot = (side) => { const t = {}; species.filter((sp) => sp.side === side).forEach((sp) => { for (const e in sp.counts) t[e] = (t[e] || 0) + sp.counts[e] * sp.coef; }); return t; };
    const tl = tot(1), tr = tot(-1);
    const verified = elems.every((e) => tl[e] === tr[e]);
    const side = (arr) => arr.map((sp) => (sp.coef === 1 ? '' : sp.coef + ' ') + sp.f).join(' + ');
    const sideT = (arr) => arr.map((sp) => (sp.coef === 1 ? '' : sp.coef + '\\,') + formulaTeX(sp.f)).join(' + ');
    const lh = species.filter((sp) => sp.side === 1), rh = species.filter((sp) => sp.side === -1);
    return { ok: true, species, reactants: lh, products: rh, elems, text: side(lh) + ' \u2192 ' + side(rh), tex: sideT(lh) + ' \\rightarrow ' + sideT(rh), verified, atomsLeft: tl, atomsRight: tr };
  }

  /* ===== units, constants ===== */
  const UNIT_LIST = [
    ['length', { m: 1, km: 1e3, cm: 1e-2, mm: 1e-3, '\u00B5m': 1e-6, um: 1e-6, micron: 1e-6, nm: 1e-9, pm: 1e-12, '\u00C5': 1e-10, angstrom: 1e-10, in: 0.0254, inch: 0.0254, ft: 0.3048, foot: 0.3048, feet: 0.3048, yd: 0.9144, mi: 1609.344, mile: 1609.344, ly: 9.4607304725808e15, au: 1.495978707e11, pc: 3.0856775814913673e16, meter: 1, metre: 1, kilometer: 1e3, kilometre: 1e3, centimeter: 1e-2, millimeter: 1e-3, nanometer: 1e-9, micrometer: 1e-6 }],
    ['mass', { kg: 1, g: 1e-3, mg: 1e-6, '\u00B5g': 1e-9, ug: 1e-9, t: 1000, tonne: 1000, lb: 0.45359237, oz: 0.028349523125, amu: 1.66053906660e-27, u: 1.66053906660e-27, da: 1.66053906660e-27, dalton: 1.66053906660e-27, gram: 1e-3, kilogram: 1, milligram: 1e-6, pound: 0.45359237, ounce: 0.028349523125 }],
    ['time', { s: 1, ms: 1e-3, us: 1e-6, '\u00B5s': 1e-6, ns: 1e-9, ps: 1e-12, min: 60, h: 3600, hr: 3600, hour: 3600, day: 86400, d: 86400, yr: 3.15576e7, year: 3.15576e7, sec: 1, second: 1, minute: 60 }],
    ['energy', { J: 1, kJ: 1e3, MJ: 1e6, mJ: 1e-3, eV: 1.602176634e-19, keV: 1.602176634e-16, MeV: 1.602176634e-13, GeV: 1.602176634e-10, meV: 1.602176634e-22, cal: 4.184, kcal: 4184, erg: 1e-7, kWh: 3.6e6, Wh: 3600, hartree: 4.3597447222071e-18, Ry: 2.1798723611035e-18, joule: 1, kilojoule: 1e3, electronvolt: 1.602176634e-19 }],
    ['pressure', { Pa: 1, kPa: 1e3, MPa: 1e6, GPa: 1e9, bar: 1e5, mbar: 100, atm: 101325, mmHg: 133.322368421, torr: 133.322368421, psi: 6894.757293168, pascal: 1, atmosphere: 101325 }],
    ['force', { N: 1, kN: 1e3, dyn: 1e-5, dyne: 1e-5, kgf: 9.80665, lbf: 4.4482216152605, newton: 1 }],
    ['power', { W: 1, kW: 1e3, MW: 1e6, mW: 1e-3, hp: 745.69987158227, watt: 1 }],
    ['volume', { m3: 1, 'm^3': 1, cm3: 1e-6, 'cm^3': 1e-6, cc: 1e-6, mm3: 1e-9, L: 1e-3, l: 1e-3, litre: 1e-3, liter: 1e-3, mL: 1e-6, ml: 1e-6, '\u00B5L': 1e-9, uL: 1e-9, gal: 3.785411784e-3 }],
    ['frequency', { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9, THz: 1e12, hertz: 1 }],
    ['wavenumber', { 'm^-1': 1, 'm-1': 1, 'cm^-1': 100, 'cm-1': 100, '/cm': 100, wavenumber: 100 }],
    ['speed', { 'm/s': 1, 'km/h': 1 / 3.6, kmh: 1 / 3.6, kph: 1 / 3.6, kmph: 1 / 3.6, mph: 0.44704, 'cm/s': 0.01, knot: 0.5144444444, kn: 0.5144444444 }],
    ['magnetic flux density', { T: 1, mT: 1e-3, '\u00B5T': 1e-6, uT: 1e-6, G: 1e-4, kG: 0.1, gauss: 1e-4, tesla: 1 }],
    ['magnetic field strength', { 'A/m': 1, 'kA/m': 1e3, Oe: 79.57747154595, kOe: 79577.47154595, oersted: 79.57747154595 }],
    ['angle', { rad: 1, deg: Math.PI / 180, degree: Math.PI / 180, degrees: Math.PI / 180, mrad: 1e-3, arcmin: Math.PI / 10800, arcsec: Math.PI / 648000, '\u00B0': Math.PI / 180, radian: 1 }],
  ];
  const UNITS = {}, UNITS_LOW = {};
  UNIT_LIST.forEach(([cat, defs]) => { for (const k in defs) { UNITS[k] = { cat, f: defs[k], name: k }; if (k.length > 2 && !(k.toLowerCase() in UNITS_LOW)) UNITS_LOW[k.toLowerCase()] = UNITS[k]; } });
  const TEMPS = { K: 'K', kelvin: 'K', C: 'C', '\u00B0C': 'C', celsius: 'C', F: 'F', '\u00B0F': 'F', fahrenheit: 'F' };
  function lookupUnit(tok) {
    let t = String(tok || '').trim().replace(/\.$/, '').replace(/\u207B\u00B9/, '^-1');
    if (TEMPS[t]) return { cat: 'temperature', temp: TEMPS[t], name: t };
    if (TEMPS[t.toLowerCase()] && t.length > 1) return { cat: 'temperature', temp: TEMPS[t.toLowerCase()], name: t };
    if (UNITS[t]) return UNITS[t];
    const lw = t.toLowerCase();
    if (t.length > 2 && UNITS_LOW[lw]) return UNITS_LOW[lw];
    if (t.length > 3 && /s$/.test(lw) && UNITS_LOW[lw.slice(0, -1)]) return UNITS_LOW[lw.slice(0, -1)];
    if (lw === 'inches') return UNITS.in; if (lw === 'feet') return UNITS.ft;
    return null;
  }
  const PHOTON_CATS = new Set(['length', 'energy', 'frequency', 'wavenumber']);
  const H = 6.62607015e-34, CL = 299792458;
  function toEnergyJ(v, u) { // photon relation
    switch (u.cat) { case 'energy': return v * u.f; case 'length': return H * CL / (v * u.f); case 'frequency': return H * v * u.f; case 'wavenumber': return H * CL * v * u.f; }
  }
  function fromEnergyJ(E, u) {
    switch (u.cat) { case 'energy': return E / u.f; case 'length': return H * CL / E / u.f; case 'frequency': return E / H / u.f; case 'wavenumber': return E / (H * CL) / u.f; }
  }
  function convertUnit(v, fromTok, toTok) {
    const a = lookupUnit(fromTok), b = lookupUnit(toTok);
    if (!a) throw new Error('I do not know the unit "' + fromTok + '".');
    if (!b) throw new Error('I do not know the unit "' + toTok + '".');
    if (a.cat === 'temperature' && b.cat === 'temperature') {
      const K = a.temp === 'K' ? v : a.temp === 'C' ? v + 273.15 : (v - 32) * 5 / 9 + 273.15;
      const out = b.temp === 'K' ? K : b.temp === 'C' ? K - 273.15 : (K - 273.15) * 9 / 5 + 32;
      return { value: out, cat: 'temperature', note: '' };
    }
    if (a.cat === b.cat) return { value: v * a.f / b.f, cat: a.cat, note: '' };
    if (PHOTON_CATS.has(a.cat) && PHOTON_CATS.has(b.cat)) {
      if (!(v > 0)) throw new Error('A photon relation needs a positive value.');
      return { value: fromEnergyJ(toEnergyJ(v, a), b), cat: a.cat + ' \u2192 ' + b.cat, note: 'Used the photon relations E = hf = hc/\u03BB (not a plain unit conversion).' };
    }
    throw new Error('"' + fromTok + '" (' + a.cat + ') cannot be converted to "' + toTok + '" (' + b.cat + ').');
  }
  const CONSTANTS = [
    { n: ['speed of light', 'light speed', 'velocity of light'], s: 'c', v: 299792458, u: 'm/s', tex: 'c', note: 'exact' },
    { n: ['planck constant', "planck's constant", 'planck'], s: 'h', v: 6.62607015e-34, u: 'J\u00B7s', tex: 'h', note: 'exact' },
    { n: ['reduced planck constant', 'h-bar', 'hbar', 'dirac constant'], s: '\u0127', v: 1.054571817e-34, u: 'J\u00B7s', tex: '\\hbar', note: '= h/2\u03C0' },
    { n: ['boltzmann constant', "boltzmann's constant", 'boltzmann'], s: 'k_B', v: 1.380649e-23, u: 'J/K', tex: 'k_B', note: 'exact' },
    { n: ['avogadro constant', "avogadro's number", 'avogadro number', 'avogadro'], s: 'N_A', v: 6.02214076e23, u: 'mol\u207B\u00B9', tex: 'N_A', note: 'exact' },
    { n: ['elementary charge', 'electron charge', 'charge of electron', 'charge of an electron'], s: 'e', v: 1.602176634e-19, u: 'C', tex: 'e', note: 'exact' },
    { n: ['electron mass', 'mass of electron', 'mass of an electron'], s: 'm_e', v: 9.1093837015e-31, u: 'kg', tex: 'm_e', note: 'CODATA 2018' },
    { n: ['proton mass', 'mass of proton', 'mass of a proton'], s: 'm_p', v: 1.67262192369e-27, u: 'kg', tex: 'm_p', note: 'CODATA 2018' },
    { n: ['neutron mass', 'mass of neutron', 'mass of a neutron'], s: 'm_n', v: 1.67492749804e-27, u: 'kg', tex: 'm_n', note: 'CODATA 2018' },
    { n: ['gravitational constant', 'newton gravitational constant', 'big g'], s: 'G', v: 6.6743e-11, u: 'm\u00B3 kg\u207B\u00B9 s\u207B\u00B2', tex: 'G', note: 'CODATA 2018' },
    { n: ['standard gravity', 'acceleration due to gravity', 'gravitational acceleration'], s: 'g', v: 9.80665, u: 'm/s\u00B2', tex: 'g', note: 'standard value' },
    { n: ['gas constant', 'universal gas constant', 'molar gas constant'], s: 'R', v: 8.314462618, u: 'J/(mol\u00B7K)', tex: 'R', note: '= N_A k_B' },
    { n: ['vacuum permittivity', 'permittivity of free space', 'epsilon naught', 'epsilon 0'], s: '\u03B5\u2080', v: 8.8541878128e-12, u: 'F/m', tex: '\\varepsilon_0', note: 'CODATA 2018' },
    { n: ['vacuum permeability', 'permeability of free space', 'mu naught', 'mu 0'], s: '\u03BC\u2080', v: 1.25663706212e-6, u: 'N/A\u00B2', tex: '\\mu_0', note: 'CODATA 2018' },
    { n: ['stefan-boltzmann constant', 'stefan boltzmann constant', 'stefan boltzmann'], s: '\u03C3', v: 5.670374419e-8, u: 'W m\u207B\u00B2 K\u207B\u2074', tex: '\\sigma', note: 'exact from other constants' },
    { n: ['rydberg constant', 'rydberg'], s: 'R_\u221E', v: 10973731.56816, u: 'm\u207B\u00B9', tex: 'R_\\infty', note: 'CODATA 2018' },
    { n: ['bohr radius'], s: 'a\u2080', v: 5.29177210903e-11, u: 'm', tex: 'a_0', note: 'CODATA 2018' },
    { n: ['atomic mass unit', 'amu', 'dalton'], s: 'u', v: 1.66053906660e-27, u: 'kg', tex: 'u', note: 'CODATA 2018' },
    { n: ['faraday constant', 'faraday'], s: 'F', v: 96485.33212, u: 'C/mol', tex: 'F', note: '= N_A e' },
    { n: ['wien displacement constant', 'wien constant', 'wien'], s: 'b', v: 2.897771955e-3, u: 'm\u00B7K', tex: 'b', note: 'exact from other constants' },
    { n: ['bohr magneton'], s: '\u03BC_B', v: 9.2740100783e-24, u: 'J/T', tex: '\\mu_B', note: 'CODATA 2018' },
    { n: ['coulomb constant', "coulomb's constant"], s: 'k_e', v: 8.9875517923e9, u: 'N m\u00B2 C\u207B\u00B2', tex: 'k_e', note: '= 1/(4\u03C0\u03B5\u2080)' },
    { n: ['speed of sound'], s: 'v_s', v: 343, u: 'm/s', tex: 'v_s', note: 'in dry air at 20 \u00B0C (approximate)' },
  ];
  const CONST_BY_SYM = { c: 299792458, h: 6.62607015e-34 };

  /* ===== physics / chemistry formula library (SI units) ===== */
  const FORMULAS = [];
  function fm(id, name, kws, eq, tex, vars, opts) {
    const o = opts || {}; const v = {};
    vars.split(';').forEach((spec) => {
      const p = spec.split('|'); v[p[0]] = { u: p[1] || '', d: p[2] || p[0], al: (p[3] ? p[3].split(',') : []), alt: p[4] || '' };
    });
    const consts = o.consts || {};
    const names = new Set(Object.keys(v).concat(Object.keys(consts)));
    const [l, r] = eq.split('=');
    FORMULAS.push({ id, name, kws, eq, tex, vars: v, consts, dom: o.dom || {}, solve: o.solve || {}, note: o.note || '', names, L: parse(l, { names }), R: parse(r, { names }), G: parse('(' + l + ')-(' + r + ')', { names }) });
  }
  fm('kin1', 'First equation of motion', ['first equation of motion', 'v = u + at', 'final velocity'], 'v = u + a*t', 'v = u + at', 'v|m/s|final velocity|final velocity,velocity;u|m/s|initial velocity|initial velocity;a|m/s\u00B2|acceleration|acceleration;t|s|time|time');
  fm('kin2', 'Second equation of motion', ['second equation of motion', 'displacement', 'distance travelled', 'distance traveled'], 's = u*t + a*t^2/2', 's = ut + \\tfrac{1}{2}at^{2}', 's|m|displacement|displacement,distance;u|m/s|initial velocity|initial velocity;a|m/s\u00B2|acceleration|acceleration;t|s|time|time');
  fm('kin3', 'Third equation of motion', ['third equation of motion', 'v squared'], 'v^2 = u^2 + 2*a*s', 'v^{2} = u^{2} + 2as', 'v|m/s|final velocity|final velocity;u|m/s|initial velocity|initial velocity;a|m/s\u00B2|acceleration|acceleration;s|m|displacement|displacement');
  fm('speed', 'Speed = distance / time', ['speed', 'average speed'], 'v*t = d', 'v = \\dfrac{d}{t}', 'v|m/s|speed|speed;d|m|distance|distance;t|s|time|time');
  fm('newton2', "Newton's second law", ["newton's second law", 'newtons second law', 'second law', 'force'], 'F = m*a', 'F = ma', 'F|N|force|force;m|kg|mass|mass;a|m/s\u00B2|acceleration|acceleration');
  fm('momentum', 'Linear momentum', ['momentum'], 'p = m*v', 'p = mv', 'p|kg\u00B7m/s|momentum|momentum;m|kg|mass|mass;v|m/s|velocity|velocity');
  fm('ke', 'Kinetic energy', ['kinetic energy'], 'KE = m*v^2/2', 'KE = \\tfrac{1}{2}mv^{2}', 'KE|J|kinetic energy|kinetic energy,KE;m|kg|mass|mass;v|m/s|velocity|velocity,speed', {});
  fm('pe', 'Gravitational potential energy', ['potential energy', 'gravitational potential energy'], 'PE = m*g*h', 'PE = mgh', 'PE|J|potential energy|potential energy,PE;m|kg|mass|mass;h|m|height|height', { consts: { g: 9.80665 } });
  fm('work', 'Work done', ['work done', 'work'], 'W = F*d', 'W = Fd', 'W|J|work|work;F|N|force|force;d|m|displacement|displacement,distance');
  fm('power', 'Mechanical power', ['mechanical power', 'power'], 'P*t = W', 'P = \\dfrac{W}{t}', 'P|W|power|power;W|J|work|work;t|s|time|time');
  fm('density', 'Density', ['density'], 'rho*V = m', '\\rho = \\dfrac{m}{V}', 'rho|kg/m\u00B3|density|density,rho;m|kg|mass|mass;V|m\u00B3|volume|volume');
  fm('pressure', 'Pressure', ['pressure on', 'pressure = force'], 'P*A = F', 'P = \\dfrac{F}{A}', 'P|Pa|pressure|pressure;F|N|force|force;A|m\u00B2|area|area');
  fm('centripetal', 'Centripetal acceleration', ['centripetal'], 'a*r = v^2', 'a = \\dfrac{v^{2}}{r}', 'a|m/s\u00B2|acceleration|acceleration;v|m/s|speed|speed,velocity;r|m|radius|radius');
  fm('pendulum', 'Simple pendulum period', ['pendulum'], 'T^2*g = 4*pi^2*L', 'T = 2\\pi\\sqrt{\\dfrac{L}{g}}', 'T|s|period|period;L|m|length|length', { consts: { g: 9.80665 } });
  fm('spring', "Hooke's law", ["hooke's law", 'hookes law', 'spring force'], 'F = k*x', 'F = kx', 'F|N|force|force;k|N/m|spring constant|spring constant;x|m|extension|extension,displacement');
  fm('springE', 'Spring potential energy', ['spring energy', 'elastic potential energy', 'energy stored in a spring'], 'U = k*x^2/2', 'U = \\tfrac{1}{2}kx^{2}', 'U|J|energy|energy;k|N/m|spring constant|spring constant;x|m|extension|extension,displacement');
  fm('gravity', "Newton's law of gravitation", ['gravitation', 'gravitational force', 'law of gravitation'], 'F*r^2 = G*m1*m2', 'F = G\\dfrac{m_1 m_2}{r^{2}}', 'F|N|force|force;m1|kg|first mass|first mass;m2|kg|second mass|second mass;r|m|distance|distance', { consts: { G: 6.6743e-11 } });
  fm('coulomb', "Coulomb's law", ["coulomb's law", 'coulombs law', 'electrostatic force'], 'F*r^2 = kC*q1*q2', 'F = k\\dfrac{q_1 q_2}{r^{2}}', 'F|N|force|force;q1|C|first charge|first charge;q2|C|second charge|second charge;r|m|distance|distance', { consts: { kC: 8.9875517923e9 } });
  fm('ohm', "Ohm's law", ["ohm's law", 'ohms law', 'resistance', 'current through'], 'V = I*R', 'V = IR', 'V|V|voltage|voltage;I|A|current|current;R|\u03A9|resistance|resistance');
  fm('elecpower', 'Electrical power', ['electrical power', 'electric power'], 'P = V*I', 'P = VI', 'P|W|power|power;V|V|voltage|voltage;I|A|current|current');
  fm('gas', 'Ideal gas law', ['ideal gas', 'pv = nrt', 'gas law'], 'P*V = n*R*T', 'PV = nRT', 'P|Pa|pressure|pressure;V|m\u00B3|volume|volume;n|mol|amount|moles,amount;T|K|temperature|temperature', { consts: { R: 8.314462618 }, note: 'Use P in Pa, V in m\u00B3 (1 L = 0.001 m\u00B3), T in K.' });
  fm('gas2', 'Combined gas law', ['combined gas law'], 'P1*V1*T2 = P2*V2*T1', '\\dfrac{P_1V_1}{T_1} = \\dfrac{P_2V_2}{T_2}', 'P1|Pa|initial pressure;V1|m\u00B3|initial volume;T1|K|initial temperature;P2|Pa|final pressure;V2|m\u00B3|final volume;T2|K|final temperature');
  fm('photonL', 'Photon energy from wavelength', ['photon energy', 'energy of a photon', 'photon wavelength'], 'E*lam = h*c', 'E = \\dfrac{hc}{\\lambda}', 'E|J|photon energy|energy,photon energy,E|eV;lam|m|wavelength|wavelength,lambda,lam|nm', { consts: { h: 6.62607015e-34, c: 299792458 } });
  fm('photonF', 'Photon energy from frequency', ['planck relation', 'e = hf'], 'E = h*f', 'E = hf', 'E|J|photon energy|photon energy,energy,E|eV;f|Hz|frequency|frequency|THz', { consts: { h: 6.62607015e-34 } });
  fm('debroglie', 'de Broglie wavelength', ['de broglie', 'debroglie', 'matter wave'], 'lam*m*v = h', '\\lambda = \\dfrac{h}{mv}', 'lam|m|wavelength|wavelength,lambda,lam|nm;m|kg|mass|mass;v|m/s|velocity|velocity,speed', { consts: { h: 6.62607015e-34 } });
  fm('emc2', 'Mass\u2013energy equivalence', ['mass energy', 'e = mc', 'mass-energy'], 'E = m*c^2', 'E = mc^{2}', 'E|J|energy|energy,E|eV;m|kg|mass|mass', { consts: { c: 299792458 } });
  fm('photoelectric', 'Photoelectric effect', ['photoelectric', 'work function'], 'KE = h*f - phi', 'KE_{max} = hf - \\phi', 'KE|J|max kinetic energy|kinetic energy,KE|eV;f|Hz|frequency|frequency|THz;phi|J|work function|work function,phi|eV', { consts: { h: 6.62607015e-34 } });
  fm('bragg', "Bragg's law", ["bragg's law", 'braggs law', 'bragg', 'xrd peak', 'd-spacing'], 'n*lam = 2*d*sin(th*pi/180)', 'n\\lambda = 2d\\sin\\theta', 'n||order;lam|m|wavelength|wavelength,lambda,lam|nm;d|m|lattice spacing|d-spacing,spacing,d|nm;th|deg|Bragg angle \u03B8|theta,angle,th', { dom: { th: [0, 90] }, note: 'The angle \u03B8 is the Bragg angle (not 2\u03B8), in degrees.' });
  fm('scherrer', 'Scherrer equation (XRD crystallite size)', ['scherrer', 'crystallite size', 'crystal size'], 'D*beta*cos(th*pi/180) = K*lam', 'D = \\dfrac{K\\lambda}{\\beta\\cos\\theta}', 'D|m|crystallite size|crystallite size,size,D|nm;beta|rad|peak width FWHM|beta,fwhm;th|deg|Bragg angle \u03B8|theta,th;lam|m|X-ray wavelength|wavelength,lambda,lam|nm', { consts: { K: 0.9 }, dom: { th: [0, 90] }, note: 'FWHM \u03B2 must be in radians; default shape factor K = 0.9 (give K= to change it).' });
  fm('wien', "Wien's displacement law", ['wien', 'peak wavelength', 'blackbody peak'], 'lam*T = b', '\\lambda_{max}T = b', 'lam|m|peak wavelength|wavelength,lambda,lam|nm;T|K|temperature|temperature', { consts: { b: 2.897771955e-3 } });
  fm('stefan', 'Stefan\u2013Boltzmann law', ['stefan', 'blackbody power', 'radiated power'], 'P = sg*A*T^4', 'P = \\sigma A T^{4}', 'P|W|radiated power|power;A|m\u00B2|area|area;T|K|temperature|temperature', { consts: { sg: 5.670374419e-8 } });
  fm('snell', "Snell's law", ["snell's law", 'snells law', 'refraction'], 'n1*sin(t1*pi/180) = n2*sin(t2*pi/180)', 'n_1\\sin\\theta_1 = n_2\\sin\\theta_2', 'n1||index 1;t1|deg|angle 1;n2||index 2;t2|deg|angle 2', { dom: { t1: [0, 90], t2: [0, 90] } });
  fm('lens', 'Thin lens / mirror formula', ['lens formula', 'mirror formula', 'focal length', 'thin lens'], 'u*v = f*(u+v)', '\\dfrac{1}{f} = \\dfrac{1}{u} + \\dfrac{1}{v}', 'f|m|focal length|focal length;u|m|object distance|object distance;v|m|image distance|image distance', { note: 'Real-is-positive convention: distances measured as positive for real objects/images.' });
  fm('dilution', 'Dilution (M\u2081V\u2081 = M\u2082V\u2082)', ['dilution', 'dilute'], 'M1*V1 = M2*V2', 'M_1V_1 = M_2V_2', 'M1|M|initial molarity;V1|L|initial volume;M2|M|final molarity;V2|L|final volume', { note: 'Any one volume unit works if both volumes use the same unit.' });
  fm('beer', 'Beer\u2013Lambert law', ['beer-lambert', 'beer lambert', 'absorbance'], 'A = eps*l*c', 'A = \\varepsilon l c', 'A||absorbance;eps|L/(mol\u00B7cm)|molar absorptivity|molar absorptivity,eps;l|cm|path length|path length,l;c|mol/L|concentration|concentration,c');
  fm('moles', 'Moles = mass / molar mass', ['moles from mass', 'number of moles'], 'n*Mm = m', 'n = \\dfrac{m}{M}', 'n|mol|amount|moles,amount;m|g|mass|mass;Mm|g/mol|molar mass|molar mass,Mm');
  fm('molarity', 'Molarity', ['molarity'], 'Mol*V = n', 'M = \\dfrac{n}{V}', 'Mol|mol/L|molarity|molarity;n|mol|amount|moles,amount;V|L|volume|volume');
  fm('heat', 'Heat energy (specific heat)', ['specific heat', 'heat energy', 'heat required'], 'Q = m*cs*dT', 'Q = mc\\,\\Delta T', 'Q|J|heat|heat;m|kg|mass|mass;cs|J/(kg\u00B7K)|specific heat capacity|specific heat;dT|K|temperature change|temperature change,dT');
  fm('hydrogen', 'Hydrogen atom energy levels', ['hydrogen energy level', 'bohr energy', 'energy level of hydrogen'], 'E*n^2 = -13.605693122994', 'E_n = -\\dfrac{13.6\\ \\mathrm{eV}}{n^{2}}', 'E|eV|energy|energy,E;n||principal quantum number|n');
  fm('rydberg', 'Rydberg formula (hydrogen spectrum)', ['rydberg formula', 'hydrogen spectrum', 'spectral line'], 'lam*Ry*(n2^2-n1^2) = n1^2*n2^2', '\\dfrac{1}{\\lambda} = R_\\infty\\left(\\dfrac{1}{n_1^{2}} - \\dfrac{1}{n_2^{2}}\\right)', 'lam|m|wavelength|wavelength,lambda,lam|nm;n1||lower level;n2||upper level', { consts: { Ry: 10973731.56816 } });
  fm('decay', 'Radioactive decay (half-life)', ['half-life', 'half life', 'radioactive decay'], 'N = N0*2^(-t/T12)', 'N = N_0\\,2^{-t/T_{1/2}}', 'N||remaining amount;N0||initial amount;t|s|elapsed time|time;T12|s|half-life|half-life,half life', {
    solve: { t: (e) => -e.T12 * Math.log2(e.N / e.N0), T12: (e) => -e.t / Math.log2(e.N / e.N0) }, note: 't and half-life must use the same unit.' });
  fm('Bfield', 'Magnetic induction B = \u03BC\u2080(H + M)', ['magnetic induction', 'b = mu0', 'flux density from'], 'B = mu0*(H+M)', 'B = \\mu_0 (H + M)', 'B|T|flux density|flux density,B;H|A/m|applied field|applied field,H;M|A/m|magnetization|magnetization,M', { consts: { mu0: 1.25663706212e-6 }, note: 'SI units: H and M in A/m, B in tesla (1 Oe = 79.577 A/m).' });
  fm('vdw', 'Wavelength of a wave (v = f\u03BB)', ['wave speed', 'wave equation'], 'v = f*lam', 'v = f\\lambda', 'v|m/s|wave speed|speed,velocity;f|Hz|frequency|frequency;lam|m|wavelength|wavelength,lambda,lam|nm');

  /* ===== statistics ===== */
  function numbersIn(text) { return (text.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || []).map(Number).filter((x) => isFinite(x)); }
  function describe(a) {
    const n = a.length, s = [...a].sort((x, y) => x - y), sum = a.reduce((p, q) => p + q, 0), mean = sum / n;
    const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    const ss = a.reduce((p, q) => p + (q - mean) * (q - mean), 0);
    const counts = new Map(); a.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
    const mx = Math.max(...counts.values()); const modes = mx > 1 ? [...counts].filter((e) => e[1] === mx).map((e) => e[0]) : [];
    return { n, sum, mean, med, min: s[0], max: s[n - 1], range: s[n - 1] - s[0], varP: ss / n, sdP: Math.sqrt(ss / n), varS: n > 1 ? ss / (n - 1) : NaN, sdS: n > 1 ? Math.sqrt(ss / (n - 1)) : NaN, sem: n > 1 ? Math.sqrt(ss / (n - 1) / n) : NaN, modes };
  }
  function linfit(x, y) {
    const n = x.length, mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
    let sxx = 0, sxy = 0, syy = 0; for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); syy += (y[i] - my) ** 2; }
    const m = sxy / sxx, c = my - m * mx, r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
    let sse = 0; for (let i = 0; i < n; i++) sse += (y[i] - (m * x[i] + c)) ** 2;
    const se = n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : NaN;
    return { m, c, r2, se };
  }
  fm('telescope', 'Telescope magnification', ['telescope magnification', 'telescope', 'eyepiece'], 'Mg*fe = fo', 'M = \\dfrac{f_o}{f_e}', 'Mg||magnification|magnification;fo|mm|objective focal length|objective focal length,fo;fe|mm|eyepiece focal length|eyepiece focal length,fe');
  /* ===== built-in knowledge base (hand-written notes; retrieved by keyword scoring) ===== */
  const r = String.raw;
  const KB = [
    { id: 'schrodinger', t: 'Schr\u00F6dinger equation', k: ['schrodinger', 'schr\u00F6dinger', 'wave function', 'wavefunction', 'psi', '\u0BB7\u0BCD\u0BB0\u0BCB\u0B9F\u0BBF\u0B99\u0BCD\u0B95\u0BB0\u0BCD', '\u0B85\u0BB2\u0BC8\u0B9A\u0BBE\u0BB0\u0BCD\u0BAA\u0BC1'],
      en: r`The Schrödinger equation is the basic law of non-relativistic quantum mechanics. It tells how the wavefunction $\Psi$ of a system changes in time:
$$i\hbar\,\frac{\partial \Psi}{\partial t} = \hat H\,\Psi$$
For a particle of mass $m$ in a potential $V$, the time-independent form is
$$-\frac{\hbar^{2}}{2m}\nabla^{2}\psi + V\psi = E\psi$$
Physical meaning:
• $|\Psi|^{2}$ is the probability density of finding the particle at a place.
• Boundary conditions allow only certain energies $E$ (quantisation).
• Examples: particle in a box $E_n=\dfrac{n^{2}\pi^{2}\hbar^{2}}{2mL^{2}}$; hydrogen atom $E_n=-\dfrac{13.6\ \mathrm{eV}}{n^{2}}$; harmonic oscillator $E_n=\hbar\omega\left(n+\tfrac12\right)$.`,
      ta: r`ஷ்ரோடிங்கர் சமன்பாடு குவாண்டம் இயந்திரவியலின் அடிப்படைச் சமன்பாடு. ஒரு அமைப்பின் அலைசார்பு $\Psi$ காலத்துடன் எப்படி மாறுகிறது என்பதை இது கூறுகிறது:
$$i\hbar\,\frac{\partial \Psi}{\partial t} = \hat H\,\Psi$$
• $|\Psi|^{2}$ என்பது துகளை ஓரிடத்தில் காணும் நிகழ்தகவு அடர்த்தி.
• எல்லை நிபந்தனைகளால் ஆற்றல் $E$ தனித்தனி மதிப்புகளையே பெறும் (குவாண்டமாக்கல்).
• எடுத்துக்காட்டு: ஹைட்ரஜன் அணு $E_n=-13.6\ \mathrm{eV}/n^{2}$.` },
    { id: 'uncertainty', t: 'Heisenberg uncertainty principle', k: ['uncertainty principle', 'heisenberg', 'uncertainty'],
      en: r`The Heisenberg uncertainty principle limits how precisely certain pairs of quantities can be known together:
$$\Delta x\,\Delta p \ge \frac{\hbar}{2}, \qquad \Delta E\,\Delta t \ge \frac{\hbar}{2}$$
It is not about clumsy measurement; it follows from the wave nature of matter. A narrow wave packet in position needs many wavelengths (a wide spread in momentum). It explains why electrons cannot collapse into the nucleus and why atoms have a minimum "zero-point" energy.` },
    { id: 'waveparticle', t: 'Wave\u2013particle duality and de Broglie wavelength', k: ['de broglie', 'wave particle', 'wave-particle', 'duality', 'matter wave'],
      en: r`Light shows particle behaviour (photoelectric effect, photons with $E=hf$) and matter shows wave behaviour (electron diffraction). de Broglie proposed that a particle of momentum $p$ has wavelength
$$\lambda=\frac{h}{p}=\frac{h}{mv}$$
Example: an electron accelerated through $V$ volts has $\lambda\approx \dfrac{1.226}{\sqrt{V}}$ nm. Ask me, for example: "de broglie wavelength m=9.109e-31 kg v=1e6 m/s".` },
    { id: 'photoelectric', t: 'Photoelectric effect', k: ['photoelectric', 'photo electric', 'threshold frequency', 'stopping potential', 'work function'],
      en: r`When light of high enough frequency falls on a metal, electrons are emitted instantly. Einstein's equation:
$$KE_{max}=hf-\phi, \qquad eV_0 = hf-\phi$$
where $\phi$ is the work function and $V_0$ the stopping potential.
• Below the threshold frequency $f_0=\phi/h$ there is no emission, however intense the light.
• Intensity changes the number of electrons (current), not their maximum energy.
• A graph of $V_0$ against $f$ is a straight line of slope $h/e$.` },
    { id: 'bohr', t: 'Bohr model and hydrogen spectrum', k: ['bohr model', 'bohr', 'hydrogen spectrum', 'balmer', 'lyman', 'rydberg formula', 'hydrogen atom'],
      en: r`Bohr's model gives the hydrogen energy levels
$$E_n=-\frac{13.6\ \mathrm{eV}}{n^{2}},\qquad r_n=n^{2}a_0\ (a_0=0.0529\ \mathrm{nm})$$
A transition between levels emits a photon; the wavelengths follow the Rydberg formula
$$\frac{1}{\lambda}=R_\infty\left(\frac{1}{n_1^{2}}-\frac{1}{n_2^{2}}\right),\quad R_\infty=1.097\times10^{7}\ \mathrm{m^{-1}}$$
Lyman ($n_1=1$, ultraviolet), Balmer ($n_1=2$, visible), Paschen ($n_1=3$, infrared). The model fails for atoms with more than one electron; full quantum mechanics is needed.` },
    { id: 'newton', t: "Newton's laws of motion", k: ["newton's laws", 'newtons laws', 'laws of motion', 'newton law', '\u0BA8\u0BBF\u0BAF\u0BC2\u0B9F\u0BCD\u0B9F\u0BA9\u0BCD'],
      en: r`1. First law (inertia): a body stays at rest or in uniform motion unless a net external force acts on it.
2. Second law: $\vec F_{net}=m\vec a$ (more generally $\vec F=\dfrac{d\vec p}{dt}$).
3. Third law: forces come in equal and opposite pairs acting on different bodies.
Useful results: weight $W=mg$; friction $f\le\mu N$; momentum $p=mv$ is conserved when no net external force acts.`,
      ta: r`1. முதல் விதி (நிலைமம்): புறவிசை செயல்படாவிட்டால் பொருள் ஓய்விலோ சீரான இயக்கத்திலோ தொடர்ந்து இருக்கும்.
2. இரண்டாம் விதி: $F=ma$.
3. மூன்றாம் விதி: ஒவ்வொரு விசைக்கும் சமமான, எதிர்த்திசை விசை வேறொரு பொருளின் மீது உண்டு.` },
    { id: 'energy', t: 'Work, energy and conservation', k: ['conservation of energy', 'work energy theorem', 'energy conservation', 'work-energy', 'law of conservation'],
      en: r`Work: $W=\vec F\cdot\vec d=Fd\cos\theta$. Work\u2013energy theorem: $W_{net}=\Delta KE$. Kinetic energy $KE=\tfrac12mv^{2}$; gravitational potential energy $PE=mgh$; spring energy $\tfrac12kx^{2}$.
In an isolated system with only conservative forces, total mechanical energy $KE+PE$ stays constant. In general, energy is never created or destroyed, only converted.`.replace(/\\u2013/g, '\u2013') },
    { id: 'shm', t: 'Simple harmonic motion', k: ['simple harmonic', 'shm', 'harmonic oscillator', 'oscillation'],
      en: r`A restoring force proportional to displacement, $F=-kx$, gives
$$x(t)=A\cos(\omega t+\varphi),\qquad \omega=\sqrt{\frac{k}{m}},\qquad T=2\pi\sqrt{\frac{m}{k}}$$
Total energy $E=\tfrac12kA^{2}$ is constant, exchanged between kinetic and potential. A simple pendulum (small angles) has $T=2\pi\sqrt{L/g}$.` },
    { id: 'ohm', t: "Ohm's law and circuits", k: ["ohm's law", 'ohms law', 'ohm law', 'kirchhoff', 'series and parallel', 'resistors', '\u0B93\u0BAE\u0BBF\u0BA9\u0BCD'],
      en: r`Ohm's law: $V=IR$ for an ohmic conductor at constant temperature. Power $P=VI=I^{2}R=V^{2}/R$.
• Series: $R_{eq}=R_1+R_2+\dots$ (same current).
• Parallel: $\dfrac{1}{R_{eq}}=\dfrac1{R_1}+\dfrac1{R_2}+\dots$ (same voltage).
• Kirchhoff: the sum of currents at a junction is zero; the sum of voltage changes around a loop is zero.`,
      ta: r`ஓமின் விதி: மாறா வெப்பநிலையில் ஒரு கடத்தியின் வழியே பாயும் மின்னோட்டம் அதன் முனைகளுக்கிடையேயான மின்னழுத்தத்திற்கு நேர்விகிதத்தில் இருக்கும்: $V=IR$. மின்திறன் $P=VI$.` },
    { id: 'maxwell', t: "Maxwell's equations", k: ["maxwell's equations", 'maxwell equations', 'maxwell', 'electromagnetic waves', 'electromagnetism'],
      en: r`In vacuum with sources $\rho$ and $\vec J$:
$$\nabla\cdot\vec E=\frac{\rho}{\varepsilon_0},\qquad \nabla\cdot\vec B=0$$
$$\nabla\times\vec E=-\frac{\partial\vec B}{\partial t},\qquad \nabla\times\vec B=\mu_0\vec J+\mu_0\varepsilon_0\frac{\partial\vec E}{\partial t}$$
Gauss's law, no magnetic monopoles, Faraday's law, and Ampère–Maxwell law. Together they predict electromagnetic waves travelling at $c=\dfrac{1}{\sqrt{\mu_0\varepsilon_0}}\approx3\times10^{8}$ m/s.` },
    { id: 'bragg', t: "Bragg's law and X-ray diffraction (XRD)", k: ['bragg', 'xrd', 'x-ray diffraction', 'x ray diffraction', 'scherrer', 'lattice constant', 'crystallite size', 'miller indices', 'd-spacing'],
      en: r`Constructive X-ray reflection from lattice planes of spacing $d$ occurs when
$$n\lambda=2d\sin\theta$$
(θ is the Bragg angle; diffractometers plot $2\theta$.) For a cubic crystal $d_{hkl}=\dfrac{a}{\sqrt{h^{2}+k^{2}+l^{2}}}$, so the lattice constant is $a=d\sqrt{h^{2}+k^{2}+l^{2}}$.
Average crystallite size from peak broadening (Scherrer):
$$D=\frac{K\lambda}{\beta\cos\theta}$$
with $K\approx0.9$ and $\beta$ the peak FWHM in radians (after instrument correction). Cu K$\alpha$: $\lambda=0.15406$ nm. I can solve these: try "bragg lam=0.15406 nm th=18.5 n=1 find d".` },
    { id: 'hysteresis', t: 'Magnetic hysteresis (M\u2013H) loop', k: ['hysteresis', 'coercivity', 'remanence', 'saturation magnetization', 'm-h loop', 'mh loop', 'squareness', 'vsm', 'coercive field', 'retentivity'],
      en: r`A hysteresis loop plots magnetisation $M$ against applied field $H$ for a ferro- or ferrimagnet.
• $M_s$: saturation magnetisation (plateau at high field).
• $M_r$: remanence, the value of $M$ at $H=0$ after saturation.
• $H_c$: coercivity, the reverse field that brings $M$ to zero.
• Squareness $M_r/M_s$; the loop area is the energy lost per cycle (per unit volume, $\oint H\,dB$).
Soft magnets: small $H_c$, narrow loop (transformer cores, Ni–Zn ferrite). Hard magnets: large $H_c$, wide loop (permanent magnets, Co ferrite). Nanoparticles below a critical size can be superparamagnetic: no hysteresis ($H_c\approx0$) above the blocking temperature.
Units: $M$ in emu/g (VSM), $H$ in Oe; 1 Oe = 79.577 A/m, 1 T = 10 000 G.
Analysis in Origin: import the data, plot M vs H; read $H_c$ and $M_r$ where the curve crosses $M=0$ and $H=0$ (Analysis → Mathematics → Interpolate/Extrapolate, or the Data Reader); average $|\pm|$ values; get $M_s$ from the high-field plateau (or a fit of $M=M_s(1-b/H)$); loop area with Analysis → Mathematics → Integrate on the closed loop.`,
      ta: r`காந்த ஹிஸ்டெரிசிஸ் வளையம் என்பது பயன்படுத்திய புலம் $H$-க்கு எதிராக காந்தமாக்கல் $M$ வரைபடம். $M_s$ – செறிவு காந்தமாக்கல்; $M_r$ – $H=0$ ஆகும்போது எஞ்சும் காந்தமாக்கல்; $H_c$ – $M=0$ ஆக்கத் தேவையான எதிர்ப்புலம் (கட்டாயப்புலம்). வளையத்தின் பரப்பு ஒரு சுழற்சிக்கான ஆற்றல் இழப்பைக் குறிக்கும்.` },
    { id: 'magnetism', t: 'Types of magnetism and ferrites', k: ['diamagnetic', 'paramagnetic', 'ferromagnetic', 'ferrimagnetic', 'antiferromagnetic', 'curie temperature', 'superparamagnetic', 'ferrite', 'spinel', 'magnetism'],
      en: r`• Diamagnetism: weak repulsion from a field, in all materials (e.g. Cu, water).
• Paramagnetism: unpaired spins align weakly with a field; Curie law $\chi=C/T$.
• Ferromagnetism: strong spontaneous alignment below the Curie temperature $T_C$ (Fe, Co, Ni).
• Antiferromagnetism: neighbouring moments cancel.
• Ferrimagnetism: unequal opposing sublattices give net moment; spinel ferrites $\mathrm{MFe_2O_4}$ (M = Co, Ni, Zn, Mn) are the common examples, with $\mathrm{Fe_3O_4}$ (magnetite) as the classic one.
Above $T_C$ a ferromagnet becomes paramagnetic. Very small particles can be superparamagnetic.` },
    { id: 'band', t: 'Band theory, band gap and Tauc plot', k: ['band gap', 'bandgap', 'band theory', 'tauc', 'semiconductor', 'valence band', 'conduction band', 'energy gap'],
      en: r`In a solid, atomic levels broaden into bands. The gap $E_g$ between the filled valence band and empty conduction band separates metals (no gap), semiconductors ($E_g\lesssim3$ eV, e.g. Si 1.12 eV) and insulators (large gap).
Optical gap from UV–Vis: Tauc relation $(\alpha h\nu)^{1/n}=B(h\nu-E_g)$ with $n=\tfrac12$ (direct) or $2$ (indirect). Plot $(\alpha h\nu)^{2}$ (direct) against $h\nu$ and extrapolate the straight part to the energy axis. Photon energy: $h\nu\,(\mathrm{eV})=1239.84/\lambda\,(\mathrm{nm})$. Anatase TiO$_2$ is about 3.2 eV.` },
    { id: 'blackbody', t: 'Blackbody radiation', k: ['blackbody', 'black body', 'planck law', 'wien displacement', 'stefan-boltzmann', 'stefan boltzmann'],
      en: r`A blackbody at temperature $T$ emits the Planck spectrum
$$B_\lambda(T)=\frac{2hc^{2}}{\lambda^{5}}\frac{1}{e^{hc/(\lambda k_BT)}-1}$$
• Wien: $\lambda_{max}T=2.898\times10^{-3}$ m·K.
• Stefan–Boltzmann: total power $P=\sigma A T^{4}$, $\sigma=5.670\times10^{-8}$ W m$^{-2}$K$^{-4}$.
The Sun ($T\approx5772$ K) peaks near 500 nm.` },
    { id: 'relativity', t: 'Special relativity basics', k: ['relativity', 'time dilation', 'length contraction', 'lorentz', 'einstein'],
      en: r`Postulates: physics is the same in all inertial frames and the speed of light $c$ is the same for all observers. With $\gamma=\dfrac{1}{\sqrt{1-v^{2}/c^{2}}}$:
• Time dilation $\Delta t=\gamma\,\Delta t_0$; length contraction $L=L_0/\gamma$.
• Energy $E=\gamma mc^{2}$, rest energy $E_0=mc^{2}$, and $E^{2}=(pc)^{2}+(mc^{2})^{2}$.` },
    { id: 'kepler', t: "Kepler's laws and orbits", k: ['kepler', 'planetary motion', 'orbit', 'orbital period'],
      en: r`1. Planets move in ellipses with the Sun at one focus.
2. A line from the Sun to a planet sweeps equal areas in equal times.
3. $T^{2}\propto a^{3}$; Newton's form $T^{2}=\dfrac{4\pi^{2}}{GM}a^{3}$. In years and AU for the Sun: $T^{2}=a^{3}$.
Circular orbital speed $v=\sqrt{GM/r}$; escape speed $v_{esc}=\sqrt{2GM/r}$.` },
    { id: 'telescope', t: 'Telescope basics', k: ['telescope', 'magnification', 'focal ratio', 'eyepiece', 'aperture', 'dawes limit', 'light gathering'],
      en: r`• Magnification $M=\dfrac{f_{objective}}{f_{eyepiece}}$ (e.g. 1000 mm with a 10 mm eyepiece gives 100×).
• Focal ratio $f/N = f_{objective}/D$.
• Light grasp grows as $D^{2}$: a 200 mm mirror collects about 8× the light of a 70 mm one.
• Resolution (Dawes limit) $\approx 116/D_{mm}$ arcseconds.
• Practical maximum magnification about $2\times D_{mm}$ (50× per inch); minimum about $D_{mm}/7$ so that the exit pupil is ≤ 7 mm.
• True field of view $\approx \dfrac{\text{eyepiece apparent field}}{M}$.
Try: "telescope magnification fo=1000 mm fe=10 mm".` },
    { id: 'magnitude', t: 'Stellar magnitudes and distances', k: ['magnitude', 'parallax', 'parsec', 'absolute magnitude', 'distance modulus'],
      en: r`Magnitude difference: $m_1-m_2=-2.5\log_{10}\dfrac{F_1}{F_2}$ (5 magnitudes = 100× in brightness). Distance modulus: $m-M=5\log_{10}\dfrac{d}{10\ \mathrm{pc}}$. Parallax: $d\,(\mathrm{pc})=\dfrac{1}{p\,(\mathrm{arcsec})}$; 1 pc = 3.26 light-years.` },
    { id: 'thermo', t: 'Laws of thermodynamics', k: ['thermodynamics', 'first law of thermodynamics', 'second law', 'entropy', 'gibbs', 'enthalpy', 'free energy'],
      en: r`• Zeroth law: bodies in thermal equilibrium with a third are in equilibrium with each other (defines temperature).
• First law: $\Delta U=Q-W$ (energy conservation).
• Second law: the entropy of an isolated system never decreases, $\Delta S\ge0$; heat flows spontaneously from hot to cold.
• Third law: entropy of a perfect crystal tends to zero as $T\to0$.
Spontaneity at constant $T,p$: $\Delta G=\Delta H-T\Delta S<0$. Relation to equilibrium: $\Delta G^\circ=-RT\ln K$.` },
    { id: 'gaslaws', t: 'Gas laws and kinetic theory', k: ['gas laws', 'boyle', 'charles law', 'gay-lussac', 'ideal gas law', 'kinetic theory', 'stp'],
      en: r`Boyle: $PV$ = constant (fixed $n,T$). Charles: $V/T$ = constant. Gay-Lussac: $P/T$ = constant. Together: $PV=nRT$ with $R=8.314$ J mol$^{-1}$K$^{-1}$ (0.08206 L atm mol$^{-1}$K$^{-1}$).
Molar volume of an ideal gas: 22.414 L at 0 °C and 1 atm (22.711 L at 1 bar). Kinetic theory: mean translational energy $\tfrac32k_BT$, and $v_{rms}=\sqrt{3RT/M}$.` },
    { id: 'mole', t: 'Mole concept', k: ['mole concept', 'what is a mole', 'avogadro', 'molar mass', 'moles', '\u0BAE\u0BCB\u0BB2\u0BCD', '\u0B85\u0BB5\u0B95\u0BBE\u0B9F\u0BCD\u0BB0\u0BCB'],
      en: r`One mole contains $N_A=6.022\times10^{23}$ entities (atoms, molecules, ions). Molar mass $M$ (g/mol) is numerically the formula mass in u. Then
$$n=\frac{m}{M},\qquad N=nN_A$$
Example: 18.015 g of water is 1 mol, i.e. $6.022\times10^{23}$ molecules. Ask me: "molar mass of Ca(OH)2" or "moles in 10 g of NaCl".`,
      ta: r`ஒரு மோல் என்பது $6.022\times10^{23}$ துகள்களைக் கொண்டது (அவகாட்ரோ எண்). மோல் எண்ணிக்கை $n=m/M$; இங்கு $m$ நிறை (கி), $M$ மோலார் நிறை (கி/மோல்).` },
    { id: 'stoich', t: 'Stoichiometry', k: ['stoichiometry', 'stoichiometric', 'mole ratio', 'theoretical yield', 'percent yield', '\u0BB8\u0BCD\u0B9F\u0BBE\u0BAF\u0BCD\u0B95\u0BBF\u0BAF\u0BCB\u0BAE\u0BC6\u0B9F\u0BCD\u0BB0\u0BBF'],
      en: r`Stoichiometry uses the mole ratios in a balanced equation to relate amounts of reactants and products.
1. Balance the equation (e.g. $2\,\mathrm{H_2}+\mathrm{O_2}\rightarrow2\,\mathrm{H_2O}$).
2. Convert the given mass to moles: $n=m/M$.
3. Use the coefficient ratio to get moles of the wanted substance.
4. Convert to mass: $m=nM$.
Percent yield $=\dfrac{\text{actual}}{\text{theoretical}}\times100$. I can do the whole calculation: try "H2 + O2 -> H2O with 4 g H2 and 40 g O2".`,
      ta: r`சமன் செய்யப்பட்ட சமன்பாட்டின் கெழுக்கள் தரும் மோல் விகிதங்களைக் கொண்டு வினைபொருட்கள் மற்றும் விளைபொருட்களின் அளவுகளைக் கணக்கிடுவதே ஸ்டாய்கியோமெட்ரி. படிகள்: 1) சமன்பாட்டைச் சமன் செய்க; 2) நிறையை மோலாக மாற்றுக ($n=m/M$); 3) மோல் விகிதத்தைப் பயன்படுத்துக; 4) மோலை மீண்டும் நிறையாக மாற்றுக.` },
    { id: 'limiting', t: 'Limiting reagent', k: ['limiting reagent', 'limiting reactant', 'excess reagent'],
      en: r`The limiting reagent is the reactant that runs out first and so fixes the amount of product. For each reactant compute (moles available) ÷ (its coefficient); the smallest value marks the limiting reagent. Product amounts are then calculated from it only. I can do this: give the equation and the masses, e.g. "N2 + H2 -> NH3 with 28 g N2 and 10 g H2".` },
    { id: 'molarity', t: 'Molarity, dilution and making solutions', k: ['molarity', 'molar solution', 'dilution', 'normality', 'concentration', 'prepare a solution'],
      en: r`Molarity $M=\dfrac{n}{V\,(\mathrm{L})}$. Mass of solute needed: $m=M\times V(\mathrm{L})\times M_{molar}$. Dilution: $M_1V_1=M_2V_2$.
To prepare 250 mL of 0.1 M NaOH: $0.1\times0.250\times40.00=1.000$ g NaOH, dissolved and made up to 250 mL in a volumetric flask. I can calculate this: "how much NaOH to prepare 250 mL of 0.1 M".` },
    { id: 'ph', t: 'pH, acids and bases', k: ['ph', 'acid base', 'acids and bases', 'buffer', 'henderson', 'pka', 'poh', 'kw'],
      en: r`$\mathrm{pH}=-\log_{10}[\mathrm{H^+}]$, $\mathrm{pOH}=-\log_{10}[\mathrm{OH^-}]$, and at 25 °C $K_w=10^{-14}$, so $\mathrm{pH}+\mathrm{pOH}=14$.
Strong acids/bases dissociate completely; weak ones use $K_a$ or $K_b$. Buffers (Henderson–Hasselbalch): $\mathrm{pH}=\mathrm{p}K_a+\log_{10}\dfrac{[\mathrm{A^-}]}{[\mathrm{HA}]}$. Ask: "pH of 0.01 M HCl".` },
    { id: 'econfig', t: 'Electron configuration', k: ['electron configuration', 'aufbau', 'hund', 'pauli', 'orbitals', 'quantum numbers'],
      en: r`Fill orbitals in order of increasing energy (Aufbau): 1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p 7s 5f 6d 7p. Pauli: at most two electrons per orbital with opposite spins. Hund: fill degenerate orbitals singly first with parallel spins.
Capacities: s 2, p 6, d 10, f 14. Exceptions arise from half-filled/filled stability, e.g. Cr $[\mathrm{Ar}]3d^{5}4s^{1}$ and Cu $[\mathrm{Ar}]3d^{10}4s^{1}$. Ask: "electron configuration of Fe".` },
    { id: 'trends', t: 'Periodic trends', k: ['periodic trends', 'atomic radius', 'ionization energy', 'electronegativity trend', 'electron affinity', 'periodic table trend'],
      en: r`Across a period (left to right): nuclear charge rises with similar shielding, so atomic radius decreases, ionisation energy and electronegativity increase, metallic character decreases. Down a group: extra shells, so radius increases, ionisation energy and electronegativity decrease, metallic character increases. Noble gases have the highest ionisation energies in their periods.` },
    { id: 'bonding', t: 'Chemical bonding and shapes', k: ['chemical bonding', 'ionic bond', 'covalent bond', 'vsepr', 'hydrogen bond', 'metallic bond', 'molecular shape', 'hybridization'],
      en: r`• Ionic: electron transfer between a metal and a non-metal (NaCl).
• Covalent: electron sharing (H$_2$O, CH$_4$); polar if electronegativities differ.
• Metallic: delocalised electrons in a lattice of cations.
• Hydrogen bond: H bonded to N, O or F attracted to a lone pair on another N, O or F.
VSEPR: electron pairs repel to minimise energy. 4 pairs: tetrahedral (CH$_4$, 109.5°); 3 bonds + 1 lone pair: pyramidal (NH$_3$); 2 + 2: bent (H$_2$O); 2 pairs: linear (CO$_2$).` },
    { id: 'equilibrium', t: "Chemical equilibrium and Le Chatelier's principle", k: ['equilibrium', 'le chatelier', 'equilibrium constant', 'reaction quotient'],
      en: r`For $a\mathrm{A}+b\mathrm{B}\rightleftharpoons c\mathrm{C}+d\mathrm{D}$: $K=\dfrac{[\mathrm{C}]^{c}[\mathrm{D}]^{d}}{[\mathrm{A}]^{a}[\mathrm{B}]^{b}}$. If $Q<K$ the reaction goes forward; if $Q>K$ it goes back.
Le Chatelier: a system at equilibrium shifts to oppose an imposed change. Adding reactant shifts right; raising pressure favours fewer gas moles; heating favours the endothermic direction. Only temperature changes $K$.` },
    { id: 'redox', t: 'Redox and electrochemistry', k: ['redox', 'oxidation number', 'nernst', 'electrochemical cell', 'electrode potential', 'galvanic', 'electrolysis'],
      en: r`Oxidation is loss of electrons (OIL), reduction is gain (RIG). Cell potential $E^\circ_{cell}=E^\circ_{cathode}-E^\circ_{anode}$; $\Delta G^\circ=-nFE^\circ$. Nernst equation at 298 K:
$$E=E^\circ-\frac{0.0592}{n}\log_{10}Q$$
Faraday's law of electrolysis: $m=\dfrac{M\,I\,t}{nF}$, $F=96485$ C/mol.` },
    { id: 'solgel', t: 'Sol\u2013gel synthesis', k: ['sol-gel', 'sol gel', 'solgel', 'xerogel', 'aerogel', 'hydrolysis and condensation', 'calcination', 'citrate', 'auto-combustion', 'auto combustion', 'pechini', 'nanoparticle synthesis', 'teos'],
      en: r`Sol–gel is a wet-chemical route in which a colloidal "sol" turns into a connected "gel" network.
1. Precursors: metal alkoxides (TEOS, titanium isopropoxide) or metal salts/nitrates with a chelating agent (citric acid).
2. Hydrolysis: M–OR + H₂O → M–OH + ROH. Condensation: M–OH + HO–M → M–O–M + H₂O (or M–OH + RO–M → M–O–M + ROH).
3. Gelation and ageing, then drying (xerogel by evaporation; aerogel by supercritical drying).
4. Heat treatment (calcination/annealing) removes organics and crystallises the oxide.
Controls: pH (acid catalysis gives chain-like, base catalysis particulate gels), water/precursor ratio, temperature, solvent, chelating ratio. Typical ferrite route: dissolve metal nitrates, add citric acid (about 1:1 metal : citrate), adjust pH to about 7 with ammonia, heat near 80 °C to a gel, auto-combust, then anneal at 500–900 °C. Characterise with XRD (phase, crystallite size), FTIR, SEM/TEM, VSM (hysteresis).` ,
      ta: r`சோல்-ஜெல் முறையில் முன்னோடிப் பொருட்கள் நீராற்பகுப்பு (hydrolysis) மற்றும் ஒடுக்கம் (condensation) வழியாகக் கூழ்மக் கரைசலாக (சோல்) மாறி, பின்னர் முப்பரிமாண வலைப்பின்னலான ஜெல்லாக மாறுகின்றன. உலர்த்தி, அனல் ஊட்டும் (calcination) போது நுண்துகள்கள் அல்லது மெல்லிய படலங்கள் கிடைக்கும். pH, நீர்-முன்னோடி விகிதம், வெப்பநிலை ஆகியவை முடிவைக் கட்டுப்படுத்தும்.` },
    { id: 'organic', t: 'Organic chemistry: functional groups', k: ['functional group', 'organic chemistry', 'alkane', 'alkene', 'alcohol', 'carboxylic', 'ester'],
      en: r`Alkane C–C (CₙH₂ₙ₊₂); alkene C=C; alkyne C≡C; alcohol –OH; ether C–O–C; aldehyde –CHO; ketone C=O (inside the chain); carboxylic acid –COOH; ester –COO–; amine –NH₂; amide –CONH₂; haloalkane –X. The functional group decides the characteristic reactions.` },
    { id: 'derivrules', t: 'Differentiation rules', k: ['differentiation rules', 'derivative rules', 'chain rule', 'product rule', 'quotient rule', 'power rule'],
      en: r`$\dfrac{d}{dx}x^{n}=nx^{n-1}$; $(uv)'=u'v+uv'$; $\left(\dfrac uv\right)'=\dfrac{u'v-uv'}{v^{2}}$; chain rule $\dfrac{d}{dx}f(g(x))=f'(g(x))\,g'(x)$.
Standard: $(\sin x)'=\cos x$, $(\cos x)'=-\sin x$, $(\tan x)'=\sec^{2}x$, $(e^{x})'=e^{x}$, $(\ln x)'=\dfrac1x$, $(\arctan x)'=\dfrac{1}{1+x^{2}}$. I can differentiate for you: "differentiate x^2 sin x".` },
    { id: 'integtech', t: 'Integration techniques', k: ['integration techniques', 'integration by parts', 'substitution', 'partial fractions', 'methods of integration'],
      en: r`• Substitution: set $u=g(x)$, so $\int f(g(x))g'(x)\,dx=\int f(u)\,du$.
• By parts: $\int u\,dv=uv-\int v\,du$ (choose $u$ by LIATE: Log, Inverse trig, Algebraic, Trig, Exponential).
• Partial fractions for rational functions; trigonometric substitution for $\sqrt{a^{2}-x^{2}}$ ($x=a\sin\theta$), $a^{2}+x^{2}$ ($x=a\tan\theta$).
Table: $\int x^{n}dx=\dfrac{x^{n+1}}{n+1}$, $\int\dfrac{dx}{x}=\ln|x|$, $\int\dfrac{dx}{1+x^{2}}=\arctan x$, $\int\dfrac{dx}{\sqrt{1-x^{2}}}=\arcsin x$, $\int e^{ax}dx=\dfrac{e^{ax}}{a}$. I can integrate for you: "integrate x e^x".` },
    { id: 'taylor', t: 'Taylor series', k: ['taylor series', 'maclaurin', 'power series', 'series expansion'],
      en: r`$$f(x)=\sum_{n=0}^{\infty}\frac{f^{(n)}(a)}{n!}(x-a)^{n}$$
Maclaurin ($a=0$): $e^{x}=1+x+\dfrac{x^{2}}{2!}+\dots$; $\sin x=x-\dfrac{x^{3}}{3!}+\dfrac{x^{5}}{5!}-\dots$; $\cos x=1-\dfrac{x^{2}}{2!}+\dots$; $\ln(1+x)=x-\dfrac{x^{2}}{2}+\dfrac{x^{3}}{3}-\dots$ ($|x|<1$); $\dfrac{1}{1-x}=1+x+x^{2}+\dots$ ($|x|<1$).` },
    { id: 'complex', t: 'Complex numbers and Euler formula', k: ['complex numbers', 'euler formula', "euler's formula", 'de moivre', 'imaginary'],
      en: r`$z=a+ib=re^{i\theta}$ with $r=\sqrt{a^{2}+b^{2}}$, $\theta=\arctan(b/a)$. Euler: $e^{i\theta}=\cos\theta+i\sin\theta$, so $e^{i\pi}+1=0$. De Moivre: $(\cos\theta+i\sin\theta)^{n}=\cos n\theta+i\sin n\theta$. Complex conjugate $\bar z=a-ib$, $z\bar z=r^{2}$.` },
    { id: 'matrix', t: 'Matrices and eigenvalues', k: ['matrix', 'matrices', 'eigenvalue', 'eigenvector', 'determinant', 'linear algebra'],
      en: r`Eigenvalue problem $A\vec v=\lambda\vec v$: solve $\det(A-\lambda I)=0$. For $A=\begin{pmatrix}a&b\\c&d\end{pmatrix}$: $\lambda^{2}-(a+d)\lambda+(ad-bc)=0$, so $\lambda_{1}+\lambda_{2}=\mathrm{tr}A$ and $\lambda_{1}\lambda_{2}=\det A$. $\det A=ad-bc$; inverse $A^{-1}=\dfrac{1}{ad-bc}\begin{pmatrix}d&-b\\-c&a\end{pmatrix}$.` },
    { id: 'normal', t: 'Normal distribution and error analysis', k: ['normal distribution', 'gaussian', 'standard deviation', 'error analysis', 'uncertainty in measurement', 'standard error', 'significant figures'],
      en: r`$$f(x)=\frac{1}{\sigma\sqrt{2\pi}}\exp\!\left[-\frac{(x-\mu)^{2}}{2\sigma^{2}}\right]$$
About 68 %, 95 %, 99.7 % of values lie within $\pm1\sigma,\pm2\sigma,\pm3\sigma$. For repeated measurements report mean $\bar x\pm s/\sqrt N$ (standard error), using the sample standard deviation $s$. Propagation (independent errors): for $z=x+y$, $\sigma_z^2=\sigma_x^2+\sigma_y^2$; for $z=xy$ or $x/y$, relative errors add in quadrature. Paste numbers and ask "mean and standard deviation of ..." and I will compute.` },
    { id: 'ode', t: 'Differential equations (basics)', k: ['differential equation', 'ode', 'separable', 'first order'],
      en: r`Separable: $\dfrac{dy}{dx}=f(x)g(y)\Rightarrow\int\dfrac{dy}{g(y)}=\int f(x)\,dx$. Linear first order $y'+p(x)y=q(x)$: multiply by $\mu=e^{\int p\,dx}$. Second order $my''+cy'+ky=0$: try $y=e^{rt}$, solve $mr^{2}+cr+k=0$ (oscillation if the roots are complex). Radioactive decay $\dfrac{dN}{dt}=-\lambda N\Rightarrow N=N_0e^{-\lambda t}$, $T_{1/2}=\dfrac{\ln2}{\lambda}$.` },
    { id: 'vectors', t: 'Vectors', k: ['vector', 'dot product', 'cross product', 'scalar product'],
      en: r`Dot product $\vec a\cdot\vec b=ab\cos\theta=a_xb_x+a_yb_y+a_zb_z$ (a scalar; work $=\vec F\cdot\vec d$). Cross product $|\vec a\times\vec b|=ab\sin\theta$, direction by the right-hand rule (torque $\vec\tau=\vec r\times\vec F$). Magnitude $|\vec a|=\sqrt{a_x^{2}+a_y^{2}+a_z^{2}}$.` },
    { id: 'fourier', t: 'Fourier series and transform', k: ['fourier', 'fourier series', 'fourier transform', 'fft', 'frequency spectrum'],
      en: r`A periodic function can be written $f(t)=\dfrac{a_0}{2}+\sum_{n\ge1}\left[a_n\cos n\omega t+b_n\sin n\omega t\right]$ with $a_n=\dfrac{2}{T}\int_0^{T}f\cos n\omega t\,dt$ and $b_n=\dfrac{2}{T}\int_0^{T}f\sin n\omega t\,dt$. The Fourier transform $F(\omega)=\int f(t)e^{-i\omega t}dt$ gives the frequency content; the FFT computes it quickly for sampled data (used for spectra, XRD smoothing, signal analysis).` },
    { id: 'simulation', t: 'Numerical simulation in science', k: ['numerical simulation', 'scientific computing', 'simulation', 'runge-kutta', 'rk4', 'euler method', 'monte carlo', 'finite difference', 'numerical methods'],
      en: r`Numerical simulation replaces an equation you cannot solve by hand with step-by-step computation.
• ODEs: Euler method (simple, first order), Runge–Kutta RK4 (accurate, fourth order); step size trades accuracy for time; check stability.
• PDEs: finite differences or finite elements on a grid (heat flow, waves, Schrödinger equation).
• Monte Carlo: random sampling to estimate integrals, particle transport or statistical-mechanics averages.
• Always validate against a known analytic case and test convergence (halve the step; results should agree).
Python RK4 for a harmonic oscillator:
~~~python
import numpy as np
def rk4(f, y0, t0, t1, n):
    t = np.linspace(t0, t1, n + 1); h = (t1 - t0) / n
    y = np.zeros((n + 1, len(y0))); y[0] = y0
    for i in range(n):
        k1 = f(t[i], y[i])
        k2 = f(t[i] + h/2, y[i] + h*k1/2)
        k3 = f(t[i] + h/2, y[i] + h*k2/2)
        k4 = f(t[i] + h, y[i] + h*k3)
        y[i + 1] = y[i] + h*(k1 + 2*k2 + 2*k3 + k4)/6
    return t, y
w = 2.0
t, y = rk4(lambda t, y: np.array([y[1], -w**2 * y[0]]), [1.0, 0.0], 0, 10, 1000)
~~~`,
      ta: r`எண்ணியல் உருவகப்படுத்துதல் (numerical simulation) என்பது கைகளால் தீர்க்க முடியாத சமன்பாடுகளைக் கணினியில் படிப்படியாகத் தீர்க்கும் முறை. எடுத்துக்காட்டுகள்: ஆய்லர் / ருங்கே-குட்டா முறைகள் (வகைக்கெழு சமன்பாடுகளுக்கு), மான்டே கார்லோ (சீரற்ற மாதிரிகள்). முடிவுகளை அறிந்த தீர்வுடன் ஒப்பிட்டுச் சரிபார்க்க வேண்டும்.` },
    { id: 'origin', t: 'OriginLab Origin: common tasks', k: ['origin', 'originlab', 'origin software', 'multiple peak fit', 'curve fitting in origin', 'origin graph'],
      en: r`• Import: File → Import → Single ASCII (or paste into a worksheet). Plot: select columns → Plot → Line / Scatter.
• Linear fit: Analysis → Fitting → Linear Fit. Nonlinear fit: Analysis → Fitting → Nonlinear Curve Fit.
• Peaks (XRD, spectra): Analysis → Peaks and Baseline → Multiple Peak Fit; use the fitted FWHM in the Scherrer equation.
• Area / derivative: Analysis → Mathematics → Integrate / Differentiate.
• Hysteresis loop: plot M vs H, use the Data Reader or interpolation for $H_c$ and $M_r$, integrate for loop area.
• Tauc plot: compute $(\alpha h\nu)^{2}$ in a column with Set Column Values, plot against $h\nu$, add a linear fit to the steep region and read the x-intercept.` },
    { id: 'python', t: 'Python for lab data (hysteresis example)', k: ['python', 'numpy', 'matplotlib', 'python code', 'plot data', 'load csv'],
      en: r`Plot a hysteresis loop and extract $H_c$, $M_r$, $M_s$ and loop area:
~~~python
import numpy as np, matplotlib.pyplot as plt
H, M = np.loadtxt("loop.csv", delimiter=",", skiprows=1, unpack=True)  # Oe, emu/g
def crossings(x, y):                       # x where y changes sign (linear interpolation)
    i = np.where(np.sign(y[:-1]) * np.sign(y[1:]) < 0)[0]
    return x[i] - y[i] * (x[i + 1] - x[i]) / (y[i + 1] - y[i])
Hc = np.abs(crossings(H, M)).mean()
Mr = np.abs(crossings(M, H)).mean()        # M where H = 0
Ms = np.abs([M.max(), M.min()]).mean()
area = abs(np.sum((H[1:] - H[:-1]) * (M[1:] + M[:-1]) / 2))
print(Hc, Mr, Ms, area)
plt.plot(H, M); plt.xlabel("H (Oe)"); plt.ylabel("M (emu/g)"); plt.grid(); plt.show()
~~~` },
    { id: 'latex', t: 'LaTeX tips for science writing', k: ['latex', 'tex', 'overleaf', 'equation environment', 'siunitx', 'amsmath'],
      en: r`Minimal article with equations (compile with pdfLaTeX; use XeLaTeX for Tamil):
~~~latex
\documentclass{article}
\usepackage{amsmath, amssymb, siunitx}
\begin{document}
Inline: $E = mc^2$. Display:
\begin{equation}
  i\hbar \frac{\partial \Psi}{\partial t} = \hat{H}\Psi
\end{equation}
\begin{align}
  a &= b + c \\
    &= d
\end{align}
Value with units: \SI{6.626e-34}{\joule\second}.
\end{document}
~~~
Fractions \frac{a}{b}, roots \sqrt{x}, sums \sum_{i=1}^{n}, integrals \int_a^b, Greek \alpha \beta \lambda, vectors \vec{F}, text in maths \text{...}.` },
    { id: 'word', t: 'Microsoft Word equations and tips', k: ['microsoft word', 'word equation', 'ms word', 'word document', 'insert equation'],
      en: r`Equations: press Alt + = (Insert → Equation), then type in linear format, e.g. "\alpha" + space gives α, "x^2" gives a superscript, "a/b" + space gives a fraction, "\sqrt(x)" + space gives a root. Use Styles (Heading 1/2) for structure, Insert → Caption for numbered figures and tables, References → Insert Citation for sources, and Review → Track Changes when sharing drafts.` },
    { id: 'matlab', t: 'MATLAB basics', k: ['matlab', 'octave', 'fzero', 'ode45'],
      en: r`~~~matlab
x = linspace(0, 10, 200); y = sin(x); plot(x, y); xlabel('x'); ylabel('sin x'); grid on
A = [2 1; 1 3]; b = [1; 2]; sol = A \ b;          % solve A*x = b
r = fzero(@(x) x.^2 - 2, [0 2]);                   % root of x^2 - 2
[t, Y] = ode45(@(t, y) [y(2); -4*y(1)], [0 10], [1 0]);   % harmonic oscillator
~~~` },
    { id: 'tenses', t: 'English tenses (summary)', k: ['tenses', 'present perfect', 'past simple', 'future tense', 'english grammar', 'tense'],
      en: r`• Simple present: habits and facts (She works here; Water boils at 100 °C).
• Present continuous: happening now (He is working).
• Simple past: finished past (I met him yesterday).
• Present perfect: past with present relevance (I have finished; I have lived here for 3 years). Do not use with a finished-time word such as "yesterday".
• Past continuous: was/were + -ing (I was reading when you called).
• Future: will + verb (decision, prediction), going to (plan or evidence), present continuous (fixed arrangement).` },
    { id: 'articles', t: 'English articles: a, an, the', k: ['articles', 'a an the', 'use of the', 'a or an'],
      en: r`Use "a" before a consonant sound (a book, a university) and "an" before a vowel sound (an hour, an MSc student). Use "the" for something specific or unique (the Sun, the result in Table 2). No article for general plurals and uncountable nouns (Metals conduct electricity; Water is essential).` },
    { id: 'writing', t: 'Scientific writing structure', k: ['scientific writing', 'research paper', 'report writing', 'abstract', 'imrad', 'thesis writing', 'lab report'],
      en: r`Standard structure (IMRaD): Title, Abstract, Introduction (background, gap, aim), Methods (enough detail to repeat; usually past tense), Results (data, figures, no interpretation), Discussion (meaning, comparison with literature, limits), Conclusion, References. Be concise; define symbols with units; every figure/table is referred to in the text; never invent citations.` },
    { id: 'tamilbasics', t: 'Tamil basics', k: ['tamil basics', 'tamil greetings', 'learn tamil', 'tamil phrases', '\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD'],
      en: r`Common phrases (Tamil, transliteration, meaning):
• வணக்கம் (vaṇakkam): hello / greetings
• நன்றி (naṉṟi): thank you
• எப்படி இருக்கிறீர்கள்? (eppaṭi irukkiṟīrkaḷ?): how are you?
• நன்றாக இருக்கிறேன் (naṉṟāka irukkiṟēṉ): I am fine
• மன்னிக்கவும் (maṉṉikkavum): sorry / excuse me
I cannot check Tamil grammar automatically; this engine contains no Tamil language model.` },
  ];
  KB.forEach((e) => { e.en = e.en.replace(/~~~/g, '```'); if (e.ta) e.ta = e.ta.replace(/~~~/g, '```'); });
  /* ===== helpers for modules ===== */
  const NUM = '[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?';
  const out = (...l) => l.filter((x) => x !== null && x !== undefined && x !== false).join('\n');
  const dd = (tex) => '$$' + tex + '$$';
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const FILLER = /\b(please|show|steps?|step by step|kindly|tell me|can you|could you)\b/gi;

  function splitAttach(raw) {
    const files = []; let q = raw;
    const re = /\n*\[Attached file: ([^\]]+)\]\n([\s\S]*?)(?=\n\n\[Attached file:|$)/g;
    let m; while ((m = re.exec(raw))) files.push({ name: m[1], text: m[2] });
    q = raw.replace(re, '').trim();
    return { q, files };
  }
  function cleanExpr(s) {
    return s.replace(FILLER, ' ').replace(/\b(with respect to|wrt|w\.r\.t\.?)\s*[a-zA-Z]\b/gi, ' ').replace(/^[\s:,\-]*(?:of|for|the|function|expression|result)?\s*/i, '')
      .replace(/^(?:of|for|the)\s+/i, '').replace(/\b(?:f|y|g|F)\s*\(\s*[a-z]\s*\)\s*=\s*/i, '').replace(/^\s*y\s*=\s*/i, '').replace(/[?.!]+\s*$/, '').trim();
  }
  function safeParse(txt) { return simp(parse(txt)); }
  function pickVar(set, wanted) {
    if (wanted) return wanted;
    if (set.has('x')) return 'x'; if (set.size === 1) return [...set][0];
    for (const c of ['t', 'y', 'z', 'r']) if (set.has(c)) return c;
    return [...set][0] || 'x';
  }
  const dexp = (n, v) => (n === 1 ? '\\frac{d}{d' + v + '}' : '\\frac{d^{' + n + '}}{d' + v + '^{' + n + '}}');
  const showEnv = (set, v, val) => { const e = {}; set.forEach((s) => { e[s] = s === v ? val : 1.3; }); return e; };

  /* ===== modules ===== */
  const MODULES = [];
  const add = (id, label, detect, run, example) => MODULES.push({ id, label, detect, run, example });

  /* --- capacity / greeting handled in think() --- */

  /* --- unit conversion --- */
  add('units', 'Unit conversion', (q) => {
    const m = new RegExp('(' + NUM + ')\\s*([A-Za-z\u00B5\u03BC\u00C5\u00B0][A-Za-z0-9\u00B5\u03BC\u00C5\u00B0/^\\-]*)\\s+(?:to|in|into|as|->|\u2192)\\s+([A-Za-z\u00B5\u03BC\u00C5\u00B0][A-Za-z0-9\u00B5\u03BC\u00C5\u00B0/^\\-]*)', 'i').exec(q);
    if (!m || !lookupUnit(m[2]) || !lookupUnit(m[3])) return 0;
    return /\b(convert|conversion)\b/i.test(q) ? 0.97 : 0.88;
  }, (q, ctx, T) => {
    const m = new RegExp('(' + NUM + ')\\s*([A-Za-z\u00B5\u03BC\u00C5\u00B0][A-Za-z0-9\u00B5\u03BC\u00C5\u00B0/^\\-]*)\\s+(?:to|in|into|as|->|\u2192)\\s+([A-Za-z\u00B5\u03BC\u00C5\u00B0][A-Za-z0-9\u00B5\u03BC\u00C5\u00B0/^\\-]*)', 'i').exec(q);
    const v = parseFloat(m[1]); T('Parse', v + ' ' + m[2] + ' \u2192 ' + m[3]);
    const r = convertUnit(v, m[2], m[3]); T('Convert', r.cat + (r.note ? ' (photon relation)' : ' (factor via SI base unit)'));
    const back = convertUnit(r.value, m[3], m[2]).value; const ok = Math.abs(back - v) <= 1e-9 * Math.max(1, Math.abs(v));
    T('Verify', 'converting back gives ' + fmt(back, 8) + (ok ? ' (matches)' : ' (mismatch)'));
    ctx.ans = r.value;
    return { answer: out('**' + fmt(v, 8) + ' ' + m[2] + ' = ' + fmt(r.value, 8) + ' ' + m[3] + '**', r.note || null), conf: ok ? 'verified' : 'computed' };
  }, 'convert 500 nm to eV');

  /* --- balance equation / stoichiometry --- */
  const AMT_RE = new RegExp('(' + NUM + ')\\s*(kg|mg|\u00B5g|ug|g|mmol|mol|moles?|grams?)\\b(?:\\s+of)?\\s+', 'ig');
  function formulaLike(tok) {
    const t = tok.replace(/^\d+/, ''); return /^[A-Z(\[]/.test(t) && !!parseFormula(t) && /[\d()\[\]]|[A-Z].*[A-Z]/.test(t);
  }
  function extractEquation(q) {
    const am = /(<->|<=>|->|\u2192|=>|\u27F6|\u21D2|\u21CC)/.exec(q);
    if (!am) return null;
    const L = q.slice(0, am.index), R = q.slice(am.index + am[0].length);
    const isSp = (t) => { const x = t.replace(/\((?:s|l|g|aq)\)$/, ''); return !!x && !!parseFormula(x.replace(/^\d+/, '')) && /^\d*[A-Z(\[]/.test(x); };
    const lt = L.split(/\s+/).filter(Boolean), keepL = [];
    for (let i = lt.length - 1; i >= 0; i--) {
      const t = lt[i];
      if (t === '+' || isSp(t) || /^\d+$/.test(t) && keepL.length && isSp(keepL[0])) keepL.unshift(t); else break;
    }
    const rt = R.split(/\s+/).filter(Boolean), keepR = [];
    for (let i = 0; i < rt.length; i++) {
      const t = rt[i].replace(/[,;.]+$/, '');
      if (t === '+' || isSp(t) || /^\d+$/.test(t) && rt[i + 1] && isSp(rt[i + 1].replace(/[,;.]+$/, ''))) { keepR.push(t); if (rt[i] !== t) break; } else break;
    }
    if (!keepL.length || !keepR.length) return null;
    return { eq: keepL.join(' ') + ' -> ' + keepR.join(' '), rest: q.slice(0, am.index - keepL.join(' ').length > 0 ? am.index : 0) };
  }
  function findAmounts(text, bal) {
    const res = []; AMT_RE.lastIndex = 0; let m;
    while ((m = AMT_RE.exec(text))) {
      const after = text.slice(m.index + m[0].length);
      let sp = null;
      const low = after.toLowerCase();
      for (const k of COMMON_KEYS) if (low.startsWith(k)) { sp = resolveSpecies(k); break; }
      if (!sp) { const tk = /^[A-Za-z0-9()\[\]\u00B7.]+/.exec(after); if (tk) sp = resolveSpecies(tk[0].replace(/[.,;]+$/, '')); }
      if (!sp) continue;
      let val = parseFloat(m[1]); const u = m[2].toLowerCase();
      const factor = { kg: 1000, g: 1, gram: 1, grams: 1, mg: 1e-3, '\u00B5g': 1e-6, ug: 1e-6 }[u];
      res.push({ formula: sp.formula, counts: sp.counts, mol: factor !== undefined ? val * factor / massOf(sp.counts) : (/^m/.test(u) && u === 'mmol' ? val / 1000 : val), grams: factor !== undefined ? val * factor : null, given: m[1] + ' ' + m[2] });
    }
    return res;
  }
  add('stoich', 'Balance equations and stoichiometry', (q) => {
    const e = extractEquation(q); if (!e) return /\bbalance\b/i.test(q) ? 0.3 : 0;
    AMT_RE.lastIndex = 0; const hasAmt = AMT_RE.test(q); AMT_RE.lastIndex = 0;
    return hasAmt ? 0.97 : 0.93;
  }, (q, ctx, T) => {
    const e = extractEquation(q); T('Read equation', e.eq);
    const b = balanceEquation(e.eq);
    if (!b.ok) return { answer: b.error, conf: 'none' };
    T('Balance', 'solved the atom-conservation matrix exactly (' + b.elems.join(', ') + ')');
    T('Verify', b.verified ? 'atoms of every element equal on both sides' : 'MISMATCH');
    const amts = findAmounts(q.replace(e.eq.replace(' -> ', ''), ''), b);
    const lines = ['**Balanced equation**', dd(b.tex), b.text];
    if (!amts.length) { lines.push('', 'Molar masses (g/mol): ' + b.species.map((s) => s.f + ' = ' + fmt(s.mass, 5)).join(', ')); return { answer: lines.join('\n'), conf: b.verified ? 'verified' : 'computed' }; }
    const rx = b.reactants, pr2 = b.products;
    const given = []; amts.forEach((a) => { const r = rx.find((s) => s.f.replace(/\((?:s|l|g|aq)\)$/, '') === a.formula.replace(/\((?:s|l|g|aq)\)$/, '')); if (r) given.push({ r, a }); });
    if (!given.length) { lines.push('', 'The amounts you gave do not match a reactant in the equation, so I only balanced it.'); return { answer: lines.join('\n'), conf: 'verified' }; }
    T('Mole conversion', given.map((g) => g.a.given + ' ' + g.r.f + ' \u2192 ' + fmt(g.a.mol, 5) + ' mol').join('; '));
    const ext = given.map((g) => ({ g, x: g.a.mol / g.r.coef }));
    const lim = ext.reduce((p, c) => (c.x < p.x ? c : p));
    T('Limiting reagent', given.length > 1 ? lim.g.r.f + ' (smallest moles \u00F7 coefficient = ' + fmt(lim.x, 5) + ')' : 'only ' + lim.g.r.f + ' was given, so the others are assumed in excess');
    lines.push('', '**Amounts given**');
    given.forEach((g) => lines.push('\u2022 ' + g.r.f + ': ' + g.a.given + ' = ' + fmt(g.a.mol, 5) + ' mol (M = ' + fmt(g.r.mass, 5) + ' g/mol), mole ratio = ' + fmt(g.a.mol / g.r.coef, 5)));
    lines.push('Limiting reagent: **' + lim.g.r.f + '**' + (given.length === 1 ? ' (others assumed in excess)' : ''));
    lines.push('', '**Products (theoretical yield)**');
    let massProd = 0; pr2.forEach((s) => { const mol = lim.x * s.coef, g = mol * s.mass; massProd += g; lines.push('\u2022 ' + s.f + ': ' + fmt(mol, 5) + ' mol = **' + fmt(g, 5) + ' g**'); });
    const used = rx.reduce((t, s) => t + lim.x * s.coef * s.mass, 0);
    const okMass = Math.abs(used - massProd) <= 1e-6 * Math.max(1, used);
    T('Verify', 'mass consumed ' + fmt(used, 6) + ' g = mass produced ' + fmt(massProd, 6) + ' g');
    lines.push('', '**Left over**');
    rx.forEach((s) => { const g = given.find((x) => x.r === s); if (g) { const left = (g.a.mol - lim.x * s.coef) * s.mass; lines.push('\u2022 ' + s.f + ': ' + (Math.abs(left) < 1e-9 ? 'none (fully used)' : fmt(left, 5) + ' g unreacted')); } });
    ctx.ans = massProd;
    return { answer: lines.join('\n'), conf: okMass && b.verified ? 'verified' : 'computed' };
  }, 'balance Fe + O2 -> Fe2O3');

  /* --- chemistry: molar mass, composition, moles, solutions, pH --- */
  function findSpecies(text) {
    const low = text.toLowerCase();
    for (const k of COMMON_KEYS) { const re = new RegExp('(^|[^a-z])' + escRe(k) + '([^a-z]|$)'); if (re.test(low)) return resolveSpecies(k); }
    const toks = text.match(/[A-Z(\[][A-Za-z0-9()\[\]\u00B7.*]*[A-Za-z0-9)\]]/g) || [];
    for (const t of toks) { const s = t.replace(/[.]+$/, ''); if (/^[A-Z(\[]/.test(s) && parseFormula(s) && /[\d()\[\]]|[A-Z][a-z]?[A-Z]/.test(s)) return resolveSpecies(s); }
    return null;
  }
  const STRONG_ACID = { HCl: 1, HBr: 1, HI: 1, HNO3: 1, HClO4: 1, H2SO4: 2 };
  const STRONG_BASE = { NaOH: 1, KOH: 1, LiOH: 1, 'Ca(OH)2': 2, 'Ba(OH)2': 2, 'Sr(OH)2': 2 };
  function compositionLines(sp) {
    const M = massOf(sp.counts); const lines = [];
    Object.keys(sp.counts).forEach((e) => { const m = BYSYM[e].mass * sp.counts[e]; lines.push('\u2022 ' + e + ' (' + BYSYM[e].name + '): ' + sp.counts[e] + ' \u00D7 ' + fmt(BYSYM[e].mass, 6) + ' = ' + fmt(m, 6) + ' g/mol \u2192 ' + fmt(m / M * 100, 5) + ' %'); });
    return lines;
  }
  add('chem', 'Chemistry calculations (molar mass, moles, solutions, pH)', (q) => {
    if (/\bp(h|oh)\b/i.test(q) && new RegExp(NUM + '\\s*(M|molar|mol\\s*\\/\\s*L)\\b', 'i').test(q)) return 0.93;
    if (/\b(molar mass|molecular (weight|mass)|formula (mass|weight)|molar weight|mass percent|percent(age)? composition|mass %)\b/i.test(q) && findSpecies(q)) return 0.95;
    AMT_RE.lastIndex = 0; const hasAmt = AMT_RE.test(q + ' '); AMT_RE.lastIndex = 0;
    if (hasAmt && findSpecies(q)) return 0.9;
    if (/\b(prepare|make|molarity|molar solution)\b/i.test(q) && /\b(mL|ml|L|litres?|liters?)\b/.test(q) && findSpecies(q)) return 0.9;
    if (/\b(mass|weight|formula|composition|percent)\b/i.test(q) && q.split(/\s+/).length <= 6 && findSpecies(q) && !/\b(of|in)\s+[a-z]+\s+(g|mol)\b/i.test(q)) return 0.88;
    const t = q.trim().replace(/[?.!]+$/, ''); if (/^[A-Z(\[][A-Za-z0-9()\[\]\u00B7.*]*$/.test(t) && parseFormula(t) && /[\d()\[\]]|[A-Z][a-z]?[A-Z]/.test(t)) return 0.8;
    return 0;
  }, (q, ctx, T) => {
    // pH
    if (/\bp(h|oh)\b/i.test(q)) {
      const cm = new RegExp('(' + NUM + ')\\s*(?:M|molar|mol\\s*\\/\\s*L)\\b', 'i').exec(q);
      const c = parseFloat(cm[1]); const sp = findSpecies(q.slice(cm.index));
      if (sp) {
        const f = sp.formula; const n = STRONG_ACID[f] || STRONG_BASE[f];
        if (n) {
          const acid = !!STRONG_ACID[f]; const ion = c * n; const pHv = acid ? -Math.log10(ion) : 14 + Math.log10(ion);
          T('Strong ' + (acid ? 'acid' : 'base'), f + ' dissociates completely: [' + (acid ? 'H\u207A' : 'OH\u207B') + '] = ' + n + ' \u00D7 ' + fmt(c) + ' = ' + fmt(ion) + ' M');
          T('Formula', acid ? 'pH = \u2212log[H\u207A]' : 'pOH = \u2212log[OH\u207B], pH = 14 \u2212 pOH (25 \u00B0C)');
          ctx.ans = pHv;
          return { answer: out('**pH = ' + fmt(pHv, 4) + '**' + (f === 'H2SO4' ? ' (assuming both protons dissociate fully; the second is really only partly dissociated)' : ''), dd(acid ? '\\mathrm{pH}=-\\log_{10}(' + fmt(ion) + ')=' + fmt(pHv, 4) : '\\mathrm{pOH}=-\\log_{10}(' + fmt(ion) + ')=' + fmt(14 - pHv, 4) + ',\\quad \\mathrm{pH}=14-\\mathrm{pOH}=' + fmt(pHv, 4))), conf: 'computed' };
        }
        return { answer: sp.formula + ' is not in my list of strong acids/bases. For a weak acid HA with $K_a$ and concentration $C$: $[\\mathrm{H^+}]\\approx\\sqrt{K_aC}$, then $\\mathrm{pH}=-\\log[\\mathrm{H^+}]$. Give me $K_a$ as a formula problem to calculate.', conf: 'none' };
      }
    }
    // solution preparation / molarity
    const sp = findSpecies(q);
    const volm = new RegExp('(' + NUM + ')\\s*(mL|ml|L|litres?|liters?)\\b').exec(q);
    const concm = new RegExp('(' + NUM + ')\\s*(?:M\\b|molar\\b|mol\\s*\\/\\s*L)').exec(q);
    AMT_RE.lastIndex = 0; const amts = findAmounts(q, null); AMT_RE.lastIndex = 0;
    if (sp && volm && (/\b(prepare|make|needed|required|how much)\b/i.test(q) || concm) && concm && !amts.length) {
      const V = parseFloat(volm[1]) * (/^m/i.test(volm[2]) ? 1e-3 : 1), C = parseFloat(concm[1]); const M = massOf(sp.counts); const g = C * V * M;
      T('Formula', 'mass = C \u00D7 V \u00D7 M = ' + fmt(C) + ' mol/L \u00D7 ' + fmt(V) + ' L \u00D7 ' + fmt(M, 5) + ' g/mol'); ctx.ans = g;
      return { answer: out('**' + fmt(g, 5) + ' g of ' + sp.formula + '**, dissolved and made up to ' + volm[1] + ' ' + volm[2] + ' with solvent in a volumetric flask.', dd('m = C\\,V\\,M = ' + fmt(C) + '\\times' + fmt(V) + '\\times' + fmt(M, 5) + ' = ' + fmt(g, 5) + '\\ \\mathrm{g}')), conf: 'computed' };
    }
    if (sp && volm && amts.length && /\b(molarity|concentration|molar)\b/i.test(q)) {
      const V = parseFloat(volm[1]) * (/^m/i.test(volm[2]) ? 1e-3 : 1), a = amts[0]; const Mo = a.mol / V; ctx.ans = Mo;
      T('Formula', 'M = n / V = ' + fmt(a.mol, 5) + ' mol / ' + fmt(V) + ' L');
      return { answer: out('**Molarity = ' + fmt(Mo, 5) + ' mol/L**', dd('M=\\dfrac{n}{V}=\\dfrac{' + fmt(a.mol, 5) + '}{' + fmt(V) + '}=' + fmt(Mo, 5) + '\\ \\mathrm{mol\\,L^{-1}}')), conf: 'computed' };
    }
    // amount conversions
    if (amts.length) {
      const a = amts[0]; const sp2 = resolveSpecies(a.formula); const M = massOf(sp2.counts); const low = q.toLowerCase();
      const L = ['**' + sp2.formula + '**: molar mass M = ' + fmt(M, 6) + ' g/mol'];
      T('Molar mass', sp2.formula + ' = ' + fmt(M, 6) + ' g/mol (sum of atomic masses from the periodic-table data)');
      const mol = a.mol, grams = mol * M;
      T('Convert', a.given + ' \u2192 ' + fmt(mol, 6) + ' mol');
      const wantG = /\b(grams?|mass|weigh)\b/.test(low) && a.grams === null;
      if (a.grams !== null) L.push('n = m / M = ' + fmt(a.grams, 6) + ' / ' + fmt(M, 6) + ' = **' + fmt(mol, 6) + ' mol**');
      if (wantG || a.grams === null) L.push('m = n \u00D7 M = ' + fmt(mol, 6) + ' \u00D7 ' + fmt(M, 6) + ' = **' + fmt(grams, 6) + ' g**');
      const N = mol * NA; const tot = Object.values(sp2.counts).reduce((x, y) => x + y, 0);
      if (/molecules|particles|formula units|entities|atoms|ions/.test(low) || (a.grams !== null && !/\bmoles?\b|\bmol\b/.test(low.replace(a.given.toLowerCase(), '')))) {
        L.push('Number of formula units/molecules = n \u00D7 N\u2090 = ' + fmt(mol, 6) + ' \u00D7 6.02214076\u00D710\u00B2\u00B3 = **' + fmt(N, 6) + '**');
        L.push('Total atoms = ' + fmt(N * tot, 6) + '  (' + Object.keys(sp2.counts).map((e) => e + ': ' + fmt(N * sp2.counts[e], 6)).join(', ') + ')');
      }
      ctx.ans = a.grams !== null ? mol : grams;
      return { answer: L.join('\n'), conf: 'computed' };
    }
    // molar mass / composition
    const spm = findSpecies(q) || resolveSpecies(q.trim().replace(/[?.!]+$/, ''));
    if (!spm) return null;
    const M = massOf(spm.counts); T('Parse formula', spm.formula + ' \u2192 ' + Object.keys(spm.counts).map((e) => e + spm.counts[e]).join(' '));
    T('Sum', 'molar mass = \u03A3 (atoms \u00D7 atomic mass)');
    const pct = Object.keys(spm.counts).reduce((s, e) => s + BYSYM[e].mass * spm.counts[e] / M * 100, 0);
    T('Verify', 'percentages add to ' + fmt(pct, 6) + ' %'); ctx.ans = M;
    return { answer: out('**' + spm.formula + '**' + (spm.name ? ' (' + spm.name + ')' : '') + ': ' + dd(formulaTeX(spm.formula) + '\\ :\\ M = ' + fmt(M, 6) + '\\ \\mathrm{g\\,mol^{-1}}'), 'Mass composition:', ...compositionLines(spm)), conf: Math.abs(pct - 100) < 1e-9 ? 'verified' : 'computed' };
  }, 'molar mass of Ca(OH)2');

  /* --- periodic table lookup --- */
  const PROPS = [
    ['mass', /(atomic|molar|relative atomic)\s*(mass|weight)|mass of|weight of/i, (e) => 'atomic mass = ' + e.mass + ' u'],
    ['config', /configuration/i, (e) => 'electron configuration: ' + e.config],
    ['group', /\bgroup\b/i, (e) => 'group ' + e.group], ['period', /\bperiod\b/i, (e) => 'period ' + e.period], ['block', /\bblock\b/i, (e) => e.block + '-block'],
    ['family', /\b(family|category|classification|type of element|metal or non|metal or)\b/i, (e) => e.family],
    ['ox', /oxidation|valenc/i, (e) => 'common oxidation states: ' + e.ox],
    ['en', /electronegativ/i, (e) => 'electronegativity (Pauling): ' + e.en],
    ['mp', /melting/i, (e) => 'melting point: ' + (typeof e.mp === 'number' ? fmt(e.mp, 6) + ' K (' + fmt(e.mp - 273.15, 6) + ' \u00B0C)' : e.mp)],
    ['bp', /boiling/i, (e) => 'boiling point: ' + (typeof e.bp === 'number' ? fmt(e.bp, 6) + ' K (' + fmt(e.bp - 273.15, 6) + ' \u00B0C)' : e.bp)],
    ['dens', /density/i, (e) => 'density: ' + e.dens + ' g/cm\u00B3'],
    ['state', /\b(state|phase)\b/i, (e) => 'state at 25 \u00B0C: ' + e.state],
    ['z', /atomic number|proton/i, (e) => 'atomic number Z = ' + e.z], ['sym', /\bsymbol\b/i, (e) => 'symbol: ' + e.sym], ['name', /\bname\b/i, (e) => 'name: ' + e.name],
  ];
  const FAMILIES = [['alkali metals', 'Alkali metals'], ['alkaline earth', 'Alkaline earth metals'], ['halogens', 'Halogens'], ['noble gases', 'Noble gases'], ['transition metals', 'Transition metals'], ['metalloids', 'Metalloids'], ['lanthanides', 'Lanthanides'], ['actinides', 'Actinides'], ['post-transition', 'Post-transition metals']];
  function findElement(q) {
    const zm = /(?:atomic number|element(?: number)?|\bZ\s*=)\s*(?:is|=|of)?\s*(\d{1,3})\b/i.exec(q);
    if (zm && BYZ[+zm[1]]) return BYZ[+zm[1]];
    const low = q.toLowerCase();
    for (const nm of Object.keys(BYNAME)) if (new RegExp('(^|[^a-z])' + nm + '([^a-z]|$)').test(low)) return BYNAME[nm];
    const kw = /\b(element|symbol|atomic|configuration|group|period|block|melting|boiling|density|oxidation|electronegativ|valenc|tell me about|properties of)\b/i.test(q);
    if (kw) { const toks = q.match(/\b[A-Z][a-z]?\b/g) || []; for (const t of toks) if (BYSYM[t] && !['I', 'A'].includes(t)) return BYSYM[t]; }
    return null;
  }
  add('element', 'Periodic table lookup', (q) => {
    const kw = /\b(element|symbol|atomic|configuration|group|period|block|melting|boiling|density|oxidation|electronegativ|valenc|tell me about|properties of|mass of|state of|family)\b/i.test(q);
    if (/elements? (in|of|with)\b|list .*elements|which elements/i.test(q) && (/group\s*\d+|period\s*\d+|\b[spdf]\s*-?block|halogen|alkali|noble|transition|metalloid|lanthanide|actinide/i.test(q))) return 0.93;
    if (!kw) return 0; const e = findElement(q); return e ? 0.9 : 0;
  }, (q, ctx, T) => {
    const gm = /group\s*(\d+)/i.exec(q), pm = /period\s*(\d+)/i.exec(q), bm = /\b([spdf])\s*-?\s*block/i.exec(q);
    if (/elements? (in|of|with)\b|list .*elements|which elements/i.test(q) && (gm || pm || bm || /halogen|alkali|noble|transition|metalloid|lanthanide|actinide/i.test(q))) {
      let list, title;
      if (gm) { list = EL.filter((e) => e.group === +gm[1]); title = 'Group ' + gm[1]; }
      else if (pm) { list = EL.filter((e) => e.period === +pm[1]); title = 'Period ' + pm[1]; }
      else if (bm) { list = EL.filter((e) => e.block === bm[1].toLowerCase()); title = bm[1].toLowerCase() + '-block'; }
      else { const f = FAMILIES.find((x) => q.toLowerCase().includes(x[0]) || (x[0] === 'halogens' && /halogen/i.test(q))); if (!f) return null; list = EL.filter((e) => e.family === f[1]); title = f[1]; }
      T('Filter', 'periodic-table data \u2192 ' + list.length + ' elements'); if (!list.length) return null;
      return { answer: '**' + title + '** (' + list.length + '): ' + list.map((e) => e.name + ' (' + e.sym + ')').join(', '), conf: 'computed' };
    }
    const e = findElement(q); if (!e) return null; T('Find element', e.name + ' (' + e.sym + ', Z = ' + e.z + ')');
    const asked = PROPS.filter((p) => p[1].test(q) && p[0] !== 'name');
    const lines = asked.length ? asked.map((p) => '\u2022 ' + p[2](e)) : ['\u2022 atomic number Z = ' + e.z, '\u2022 atomic mass = ' + e.mass + ' u', '\u2022 group ' + e.group + ', period ' + e.period + ', ' + e.block + '-block', '\u2022 ' + e.family, '\u2022 electron configuration: ' + e.config, '\u2022 common oxidation states: ' + e.ox, '\u2022 electronegativity (Pauling): ' + e.en, '\u2022 state at 25 \u00B0C: ' + e.state, '\u2022 melting point ' + (typeof e.mp === 'number' ? fmt(e.mp, 6) + ' K' : e.mp) + ', boiling point ' + (typeof e.bp === 'number' ? fmt(e.bp, 6) + ' K' : e.bp), '\u2022 density: ' + e.dens + ' g/cm\u00B3'];
    ctx.ans = e.mass; return { answer: out('**' + e.name + ' (' + e.sym + ')**', ...lines), conf: 'computed' };
  }, 'electron configuration of Fe');

  /* --- physical constants --- */
  add('constants', 'Physical constants', (q) => {
    const low = q.toLowerCase().replace(/[?.!]/g, ''); if (/\b(law|equation|explain|derive|why|how)\b/.test(low) && low.split(/\s+/).length > 6) return 0;
    for (const c of CONSTANTS) for (const n of c.n) if (new RegExp('(^|[^a-z])' + escRe(n) + '([^a-z]|$)').test(low)) return low.split(/\s+/).length <= 9 ? 0.86 : 0.4;
    return 0;
  }, (q, ctx, T) => {
    const low = q.toLowerCase(); let best = null, bl = 0;
    for (const c of CONSTANTS) for (const n of c.n) if (new RegExp('(^|[^a-z])' + escRe(n) + '([^a-z]|$)').test(low) && n.length > bl) { best = c; bl = n.length; }
    if (!best) return null; T('Look up', best.n[0]);
    ctx.ans = best.v;
    return { answer: out('**' + best.n[0].replace(/^./, (x) => x.toUpperCase()) + '**', dd(best.tex + ' = ' + fmtTeX(best.v, 10) + '\\ \\mathrm{' + best.u.replace(/\u00B7/g, '\\,').replace(/\u207B\u00B9/g, '^{-1}').replace(/\u00B2/g, '^{2}').replace(/\u00B3/g, '^{3}').replace(/\u207B\u00B2/g, '^{-2}').replace(/\u207B\u2074/g, '^{-4}').replace(/ /g, '\\,') + '}'), '(' + best.note + ')'), conf: 'computed' };
  }, 'Planck constant');

  /* --- calculus: derivative --- */
  const DER_KW = /\b(differentiate|differentiation|derivative|d\s*\/\s*d[a-z]|diff)\b/i;
  add('derivative', 'Differentiation', (q) => (DER_KW.test(q) && !/\b(integrate|integral)\b/i.test(q) ? 0.95 : 0), (q, ctx, T) => {
    const km = DER_KW.exec(q); const dm = /d\s*\/\s*d([a-z])/i.exec(q);
    let wrt = null; const wm = /(?:with respect to|wrt|w\.r\.t\.?)\s*([a-z])\b/i.exec(q); if (wm) wrt = wm[1]; else if (dm) wrt = dm[1];
    let order = 1; if (/\bsecond\b|\bd\s*\^?2\b|double/i.test(q)) order = 2; else if (/\bthird\b/i.test(q)) order = 3;
    const at = /\bat\s+([a-z])\s*=\s*([^\s,;]+)/i.exec(q);
    let rest = q.slice(km.index + km[0].length); rest = rest.replace(/\bat\s+[a-z]\s*=\s*[^\s,;]+/i, '');
    if (/derivative/i.test(km[0]) && /^\s*(?:of|for)\b/i.test(rest) === false && /\b(find|what is|calculate|compute|the)\b/i.test(q.slice(0, km.index)) === false) { /* e.g. "derivative x^2" */ }
    const txt = cleanExpr(rest); if (!txt) return { answer: 'Tell me the function, for example: differentiate x^2 sin x', conf: 'none' };
    const f = safeParse(txt); const vs = varsOf(f); const x = pickVar(vs, wrt);
    T('Parse', 'function f(' + x + ') = ' + plain(f) + '  (differentiate with respect to ' + x + (order > 1 ? ', order ' + order : '') + ')');
    const rules = new Set(); let cur = f; const steps = [];
    for (let i = 0; i < order; i++) { const nx = tidy(diff(cur, x, i === 0 ? rules : null)); steps.push([cur, nx]); cur = nx; }
    T('Rules', rules.size ? [...rules].join(', ') : 'basic rules');
    // verify with numerical derivative of the previous step
    let okAll = true, usedPts = 0, maxErr = 0;
    steps.forEach(([prev, nx]) => {
      let ok = 0;
      for (const t of [0.31, 0.77, 1.4, 2.3, -0.6]) {
        try { const env = showEnv(vs, x, t); const a = numDeriv((u) => ev(prev, Object.assign({}, env, { [x]: u })), t), b = ev(nx, env); if (!isFinite(a) || !isFinite(b)) continue; const er = Math.abs(a - b) / Math.max(1, Math.abs(b)); ok++; usedPts++; if (er > maxErr) maxErr = er; if (er > 1e-5) okAll = false; } catch (e) { /* skip */ }
      }
      if (ok < 2) okAll = false;
    });
    T('Verify', usedPts ? 'compared with a numerical derivative at ' + usedPts + ' points, largest relative difference ' + maxErr.toExponential(1) : 'could not evaluate at test points');
    const lines = [dd('f(' + x + ')=' + texOf(f)), 'Rules used: ' + ([...rules].join(', ') || 'basic rules') + '.'];
    steps.forEach(([prev, nx], i) => lines.push(dd((i === 0 ? '' : '') + dexp(1, x) + '\\left(' + texOf(prev) + '\\right)=' + texOf(nx))));
    if (order > 1) lines.push(dd(dexp(order, x) + '\\left(' + texOf(f) + '\\right)=' + texOf(cur)));
    if (at) { try { const xv = ev(parse(at[2]), {}); const val = ev(cur, Object.assign(showEnv(vs, x, xv), { [x]: xv })); lines.push('At ' + at[1] + ' = ' + fmt(xv, 8) + ': **' + fmt(val, 8) + '**'); ctx.ans = val; } catch (e) { lines.push('(I could not evaluate at ' + at[1] + ' = ' + at[2] + ': ' + e.message + ')'); } }
    if (/\blog\b/.test(txt) && !/\bln\b/.test(txt)) lines.push('Note: log means base 10 here; ln is the natural logarithm.');
    return { answer: lines.join('\n'), conf: okAll ? 'verified' : 'computed' };
  }, 'differentiate x^2 sin x');

  /* --- calculus: integral --- */
  const INT_KW = /(\bintegrate\b|\bintegral\b|\bintegration\b|\bantiderivative\b|\bprimitive of\b|\u222B)/i;
  const DERIVATIONS = [
    { f: '1/(1+x^2)', title: 'Why the integral of 1/(1+x\u00B2) is arctan x', tex: ['\\text{Let } x=\\tan\\theta,\\ \\text{so } dx=\\sec^{2}\\theta\\,d\\theta \\ \\text{and}\\ 1+x^{2}=\\sec^{2}\\theta.', '\\int\\frac{dx}{1+x^{2}}=\\int\\frac{\\sec^{2}\\theta}{\\sec^{2}\\theta}\\,d\\theta=\\int d\\theta=\\theta+C=\\arctan x+C.'], check: 'Check: $\\dfrac{d}{dx}\\arctan x=\\dfrac{1}{1+x^{2}}$.' },
    { f: '1/sqrt(1-x^2)', title: 'Why the integral of 1/\u221A(1\u2212x\u00B2) is arcsin x', tex: ['\\text{Let } x=\\sin\\theta,\\ dx=\\cos\\theta\\,d\\theta,\\ \\sqrt{1-x^{2}}=\\cos\\theta\\ (|\\theta|\\le\\pi/2).', '\\int\\frac{dx}{\\sqrt{1-x^{2}}}=\\int\\frac{\\cos\\theta}{\\cos\\theta}\\,d\\theta=\\theta+C=\\arcsin x+C.'], check: 'Check: $\\dfrac{d}{dx}\\arcsin x=\\dfrac{1}{\\sqrt{1-x^{2}}}$.' },
    { f: '1/x', title: 'Why the integral of 1/x is ln|x|', tex: ['\\text{For } x>0:\\ \\dfrac{d}{dx}\\ln x=\\dfrac1x,\\ \\text{so } \\int\\dfrac{dx}{x}=\\ln x+C.', '\\text{For } x<0:\\ \\dfrac{d}{dx}\\ln(-x)=\\dfrac{-1}{-x}=\\dfrac1x.\\ \\text{Both cases combine to } \\ln|x|+C.'], check: '' },
    { f: 'x*e^x', title: 'Integration by parts', tex: ['\\int u\\,dv=uv-\\int v\\,du,\\quad u=x,\\ dv=e^{x}dx\\ \\Rightarrow\\ du=dx,\\ v=e^{x}.', '\\int xe^{x}dx=xe^{x}-\\int e^{x}dx=xe^{x}-e^{x}+C.'], check: '' },
    { f: 'ln(x)', title: 'Integration by parts', tex: ['u=\\ln x,\\ dv=dx\\ \\Rightarrow\\ du=\\dfrac{dx}{x},\\ v=x.', '\\int\\ln x\\,dx=x\\ln x-\\int dx=x\\ln x-x+C.'], check: '' },
  ];
  add('integral', 'Integration', (q) => (INT_KW.test(q) ? 0.95 : 0), (q, ctx, T) => {
    const km = INT_KW.exec(q); let rest = q.slice(km.index + km[0].length);
    let a = null, b = null;
    const bm = /\b(?:from|between)\s+(.+?)\s+(?:to|and)\s+([^\s,;]+)\s*$/i.exec(rest) || /\b(?:from|between)\s+(.+?)\s+(?:to|and)\s+([^\s,;]+)/i.exec(rest);
    if (bm) { a = bm[1]; b = bm[2]; rest = rest.slice(0, bm.index); }
    const um = /_\s*\{?([^\s^{}]+)\}?\s*\^\s*\{?([^\s{}]+)\}?\s*(.*)$/.exec(rest);
    if (!bm && /^\s*_/.test(rest) && um) { a = um[1]; b = um[2]; rest = um[3]; }
    let txt = cleanExpr(rest).replace(/\s*\bd([a-z])\s*$/i, ' ');
    const dv = /\bd([a-z])\s*$/i.exec(cleanExpr(rest)); let wrt = dv ? dv[1] : null;
    txt = txt.replace(/\s*\bd[a-z]\s*$/i, '').trim();
    if (!txt) return { answer: 'Tell me the function, for example: integrate x e^x   or   integrate x^2 from 0 to 1', conf: 'none' };
    const f = safeParse(txt); const vs = varsOf(f); const x = pickVar(vs, wrt);
    T('Parse', 'integrand f(' + x + ') = ' + plain(f) + (a !== null ? ', limits ' + a + ' to ' + b : ', indefinite integral'));
    if ([...vs].some((v) => v !== x)) return { answer: 'I can integrate only in one variable with numeric constants. Your expression also contains ' + [...vs].filter((v) => v !== x).join(', ') + '.', conf: 'none' };
    let F = integ(f, x); if (F) F = tidy(F);
    let verified = false;
    if (F) { const v = verifyAntiderivative(F, f, x); verified = v.ok; T('Method', 'rule table (' + (F ? 'matched' : 'none') + ')'); T('Verify', 'differentiated the result numerically and compared with the integrand at ' + v.n + ' points, largest relative difference ' + v.maxErr.toExponential(1)); if (!v.ok) F = null; }
    else T('Method', 'no matching rule in my table');
    const lines = [];
    if (a === null) {
      if (!F) return { answer: 'I could not find a closed form for ' + '$' + texOf(f) + '$' + ' with my built-in integration rules (polynomials, powers of linear terms, exp/sin/cos/tan, 1/(quadratic), by-parts with polynomials, ln x, u\u2032/u). Give limits (e.g. "from 0 to 1") and I will compute a numerical value instead.', conf: 'none' };
      lines.push(dd('\\int ' + texOf(f) + '\\,d' + x + '=' + texOf(F) + '+C'));
      if (/\b(derive|prove|show|why|proof|how)\b/i.test(q)) {
        const dr = DERIVATIONS.find((d) => { try { const g = parse(d.f); return [0.31, 0.77, 1.4, -0.6].every((t) => Math.abs(ev(g, { x: t }) - ev(f, { [x]: t })) < 1e-9 || (isNaN(ev(g, { x: t })) && isNaN(ev(f, { [x]: t })))); } catch (e) { return false; } });
        if (dr) { T('Derivation', dr.title); lines.push('**' + dr.title + '**'); dr.tex.forEach((t) => lines.push(dd(t))); if (dr.check) lines.push(dr.check); }
      }
      lines.push('(+ C is the constant of integration. Check: differentiating the result returns the integrand.)');
      return { answer: lines.join('\n'), conf: 'verified' };
    }
    let av, bv; try { av = ev(parse(a), {}); bv = ev(parse(b), {}); } catch (e) { return { answer: 'I could not read the limits "' + a + '" and "' + b + '" as numbers.', conf: 'none' }; }
    const fn = (t) => ev(f, { [x]: t });
    { let bad = false; const lo = Math.min(av, bv), hi = Math.max(av, bv);
      for (let i = 0; i <= 4000; i++) { let y; try { y = fn(lo + (hi - lo) * i / 4000); } catch (e) { y = NaN; } if (!isFinite(y) || Math.abs(y) > 1e7) { bad = true; break; } }
      T('Check', bad ? 'the integrand blows up or is undefined inside [' + fmt(lo, 6) + ', ' + fmt(hi, 6) + ']' : 'integrand is finite on the whole interval');
      if (bad) return { answer: 'The integrand is undefined or becomes infinite somewhere between ' + a + ' and ' + b + ' (a singularity), so this is an improper integral that may diverge. I do not evaluate improper integrals: a number from me here could be wrong (for example, the integral of 1/x from \u22121 to 1 diverges even though the two halves cancel in a naive calculation).', conf: 'none' }; }
    let num;
    try { num = simpson(fn, av, bv, 4000); } catch (e) { num = NaN; }
    let val = num, how = 'numerical (Simpson, 4000 steps)';
    if (F) { const exact = ev(F, { [x]: bv }) - ev(F, { [x]: av }); if (isFinite(exact) && (!isFinite(num) || Math.abs(exact - num) <= 1e-6 * Math.max(1, Math.abs(exact)))) { val = exact; how = 'antiderivative F(b) \u2212 F(a), cross-checked by Simpson'; verified = isFinite(num); } }
    if (!isFinite(val)) return { answer: 'The integrand is not finite somewhere between ' + a + ' and ' + b + ' (a singularity), so I cannot give a value.', conf: 'none' };
    T('Evaluate', how + ' \u2192 ' + fmt(val, 8)); ctx.ans = val;
    const aT = texOf(safeParse(a)), bT = texOf(safeParse(b));
    lines.push(dd('\\int_{' + aT + '}^{' + bT + '}' + texOf(f) + '\\,d' + x + '=' + (F ? '\\Big[' + texOf(F) + '\\Big]_{' + aT + '}^{' + bT + '}=' : '') + fmt(val, 8)), '**Value = ' + fmt(val, 8) + '**  (' + how + ')');
    return { answer: lines.join('\n'), conf: verified ? 'verified' : 'computed' };
  }, 'integrate x e^x');

  /* --- equation solving --- */
  function cPolyEval(c, z) { let r = { re: 0, im: 0 }; for (let k = c.length - 1; k >= 0; k--) { r = { re: r.re * z.re - r.im * z.im + c[k], im: r.re * z.im + r.im * z.re }; } return r; }
  const cfmt = (z) => (z.im === 0 ? fmt(z.re, 8) : z.re === 0 ? (z.im < 0 ? '\u2212' : '') + fmt(Math.abs(z.im), 8) + 'i' : fmt(z.re, 8) + (z.im > 0 ? ' + ' : ' \u2212 ') + fmt(Math.abs(z.im), 8) + 'i');
  const SOLVE_KW = /\b(solve|roots?|zeros?|find (?:the )?(?:value|values|roots?|solutions?)|solutions? of)\b/i;
  function equationsFrom(q) {
    let t = q; const km = /\b(?:solve|roots? of|zeros? of|solutions? of|find (?:the )?(?:roots?|solutions?|values? of [a-z]))\b/i.exec(t);
    if (km) t = t.slice(km.index + km[0].length);
    t = t.replace(/^\s*(the\s+)?(equations?|system)?\s*(for\s+[a-z]\s*(in|:)?)?\s*:?\s*/i, '').replace(/[?.!]+\s*$/, '');
    return t.split(/\s*(?:[;,]|\band\b)\s*/i).map((s) => s.trim()).filter(Boolean);
  }
  add('solve', 'Equation solving', (q) => {
    if (!q.includes('=')) return 0;
    if (SOLVE_KW.test(q)) return 0.95;
    return /^[\sA-Za-z0-9+\-*/^().=,;\u00B2\u00B3\u221A\u03C0]+$/.test(q) && /[a-z]/i.test(q) && /\d/.test(q) ? 0.55 : 0;
  }, (q, ctx, T) => {
    const eqs = equationsFrom(q); if (!eqs.length || !eqs.every((e) => e.includes('='))) return null;
    const parsed = eqs.map((e) => { const [l, r] = splitEquation(e); return { text: e, L: safeParse(l), R: safeParse(r) }; });
    const vs = new Set(); parsed.forEach((p) => { varsOf(p.L, vs); varsOf(p.R, vs); });
    const names = [...vs].sort(); T('Read', parsed.map((p) => plain(p.L) + ' = ' + plain(p.R)).join(';  ') + '  (unknowns: ' + (names.join(', ') || 'none') + ')');
    if (!names.length) return { answer: 'There is no unknown in this equation.', conf: 'none' };
    if (parsed.length === 1 && names.length === 1) {
      const x = names[0], G = Sub(parsed[0].L, parsed[0].R), g = (t) => ev(G, { [x]: t });
      const c = polyCoeffs(G, x, 4);
      if (c) {
        const deg = c.length - 1; T('Type', deg === 0 ? 'constant' : 'polynomial of degree ' + deg);
        if (deg === 0) return { answer: c[0] === 0 ? 'This is true for every value of ' + x + ' (an identity).' : 'No solution: the equation reduces to ' + fmt(c[0]) + ' = 0.', conf: 'verified' };
        const poly = polyTeXOf(c, x); const lines = [dd(texOf(poly) + '=0')];
        const roots = polyRoots(c);
        if (deg === 2) { const [C, B, A2] = c; const disc = B * B - 4 * A2 * C; T('Quadratic formula', 'discriminant \u0394 = b\u00B2 \u2212 4ac = ' + fmt(disc)); lines.push(dd('x=\\dfrac{-b\\pm\\sqrt{b^{2}-4ac}}{2a},\\quad \\Delta=(' + fmt(B) + ')^{2}-4(' + fmt(A2) + ')(' + fmt(C) + ')=' + fmt(disc)), disc > 0 ? 'Two distinct real roots.' : disc === 0 ? 'One repeated real root.' : 'No real roots; two complex-conjugate roots.'); }
        if (deg >= 3) T('Method', 'numerical polynomial root finder (Durand\u2013Kerner), ' + deg + ' roots');
        let okAll = true;
        roots.forEach((z, i) => { const res = cPolyEval(c, z), mag = Math.hypot(res.re, res.im), sc = Math.max(1, ...c.map(Math.abs)) * Math.max(1, Math.abs(z.re) + Math.abs(z.im)) ** deg; if (mag > 1e-8 * sc) okAll = false; lines.push('\u2022 ' + x + (roots.length > 1 ? '\u2081\u2082\u2083\u2084'[i] : '') + ' = **' + cfmt(z) + '**'); });
        T('Verify', 'substituted every root back into the polynomial: ' + (okAll ? 'all residuals ~ 0' : 'residual too large'));
        const real = roots.filter((z) => z.im === 0); if (real.length) ctx.ans = real[0].re;
        return { answer: lines.join('\n'), conf: okAll ? 'verified' : 'computed' };
      }
      T('Method', 'not a polynomial of degree \u2264 4: scanning [\u2212100, 100] for sign changes, then bisection');
      const rs = scanRoots(g, -100, 100, 40000);
      if (!rs.length) return { answer: 'I found no real solution of ' + plain(parsed[0].L) + ' = ' + plain(parsed[0].R) + ' in the range \u2212100 to 100. There may be solutions outside it or none at all.', conf: 'none' };
      const resid = Math.max(...rs.map((r) => Math.abs(g(r)))); T('Verify', 'largest |f(root)| = ' + resid.toExponential(1)); ctx.ans = rs[0];
      return { answer: out(dd(texOf(parsed[0].L) + '=' + texOf(parsed[0].R)), ...rs.map((r, i) => '\u2022 ' + x + ' \u2248 **' + fmt(r, 10) + '**'), '(numerical solutions in [\u2212100, 100])'), conf: resid < 1e-6 ? 'verified' : 'computed' };
    }
    if (parsed.length === names.length && names.length >= 2 && names.length <= 4) {
      const n = names.length; const F = (vec) => parsed.map((p) => { const env = {}; names.forEach((nm, i) => { env[nm] = vec[i]; }); return ev(p.L, env) - ev(p.R, env); });
      const z = F(Array(n).fill(0)); const Am = Array.from({ length: n }, () => Array(n).fill(0));
      for (let j = 0; j < n; j++) { const e = Array(n).fill(0); e[j] = 1; const fj = F(e); for (let i = 0; i < n; i++) Am[i][j] = fj[i] - z[i]; }
      const rnd = Array.from({ length: n }, (_, i) => 0.37 + i * 1.11); const pr0 = F(rnd); const lin = pr0.every((v, i) => Math.abs(v - (z[i] + Am[i].reduce((s, a, j) => s + a * rnd[j], 0))) < 1e-7 * Math.max(1, Math.abs(v)));
      if (!lin) return { answer: 'This system is not linear, which my solver does not handle (it solves linear systems of up to 4 unknowns).', conf: 'none' };
      T('Method', 'linear system ' + n + '\u00D7' + n + ', Gaussian elimination with pivoting');
      const sol = gaussSolve(Am, z.map((v) => -v)); if (!sol) return { answer: 'The system has no unique solution (the equations are dependent or inconsistent).', conf: 'none' };
      const res = F(sol); const okv = res.every((v) => Math.abs(v) < 1e-8 * Math.max(1, ...sol.map(Math.abs))); T('Verify', 'substituted into every equation: residuals ' + res.map((v) => v.toExponential(0)).join(', '));
      ctx.ans = sol[0];
      return { answer: out(...names.map((nm, i) => { const q2 = ratify(sol[i], 1000, 1e-9); return '\u2022 ' + nm + ' = **' + (q2 && q2[1] !== 1 ? q2[0] + '/' + q2[1] + ' = ' : '') + fmt(sol[i], 10) + '**'; })), conf: okv ? 'verified' : 'computed' };
    }
    return { answer: 'I found the unknowns ' + names.join(', ') + ' in ' + parsed.length + ' equation(s). I can solve one equation in one unknown, or a linear system with as many equations as unknowns.', conf: 'none' };
  }, 'solve x^2 - 5x + 6 = 0');
  /* --- physics / chemistry formula solver --- */
  const UNIT_TOK = '(?:([A-Za-z\u00B5\u03BC\u00C5\u03A9\u00B0][A-Za-z0-9\u00B5\u03BC\u00C5\u03A9\u00B0/^\\-\u00B2\u00B3]*)(?!\\s*[=:]))?';
  function parseGiven(q, f) {
    const given = {}; const syms = Object.keys(f.vars).concat(Object.keys(f.consts));
    syms.forEach((s) => {
      const v = f.vars[s]; const words = v ? v.al.filter((a) => a.length > 2) : []; const shorts = [s].concat(v ? v.al.filter((a) => a.length <= 2 && a !== s) : []);
      let m = null;
      for (const sy of shorts) { m = new RegExp('(^|[^A-Za-z0-9_])' + escRe(sy) + '\\s*[=:]\\s*(' + NUM + ')\\s*' + UNIT_TOK).exec(q); if (m) break; }
      if (!m) for (const w of words) { m = new RegExp('(^|[^A-Za-z])' + escRe(w) + '\\s*(?:=|:|is|of)?\\s*(' + NUM + ')\\s*' + UNIT_TOK, 'i').exec(q); if (m) break; }
      if (m) given[s] = { val: parseFloat(m[2]), unit: m[3] && lookupUnit(m[3]) ? m[3] : '' };
    });
    return given;
  }
  function toVarUnit(val, unit, v) {
    if (!unit || !v || !v.u) return { val, note: '' };
    const cu = lookupUnit(unit), su = lookupUnit(v.u); if (!cu || !su) return { val, note: unit && !cu ? '(unit "' + unit + '" not recognised, treated as ' + v.u + ')' : '' };
    if (cu.cat !== su.cat) return { val, note: '(unit "' + unit + '" does not match ' + v.u + ', treated as ' + v.u + ')' };
    return { val: convertUnit(val, unit, v.u).value, note: unit === v.u ? '' : '(converted from ' + unit + ')' };
  }
  function matchFormula(q) {
    const low = q.toLowerCase(); let best = null;
    for (const f of FORMULAS) {
      const given = parseGiven(q, f); const gs = Object.keys(given).filter((s) => f.vars[s]);
      const nameHit = f.kws.some((k) => low.includes(k.toLowerCase()));
      if (gs.length < (nameHit ? 1 : 2)) continue;
      const free = Object.keys(f.vars).filter((s) => !(s in given));
      const reqm = /(?:find|calculate|compute|determine|what is|solve for)\s+(?:the\s+)?([A-Za-z\u03B8\u03BB][A-Za-z0-9]*)/i.exec(q);
      const solvable = free.length === 1;
      const score = (nameHit ? 3 : 0) + gs.length + (solvable ? 2 : -1) - Object.keys(f.vars).length * 0.01;
      if (!best || score > best.score) best = { f, given, free, solvable, nameHit, score, req: reqm && reqm[1] };
    }
    return best;
  }
  add('formula', 'Physics / chemistry formula solver', (q) => {
    const m = matchFormula(q); if (!m) return 0;
    if (m.solvable) return m.nameHit ? 0.97 : /\b(find|calculate|compute|determine|what is|solve)\b/i.test(q) ? 0.94 : 0.85;
    return m.nameHit ? 0.5 : 0;
  }, (q, ctx, T) => {
    const m = matchFormula(q); const f = m.f;
    T('Formula chosen', f.name + ' (' + f.eq + ')');
    if (!m.solvable) {
      return { answer: out('**' + f.name + '**', dd(f.tex), 'I need values for all variables except one. Missing: ' + m.free.map((s) => s + ' (' + f.vars[s].d + (f.vars[s].u ? ', ' + f.vars[s].u : '') + ')').join(', ') + '. Give them like: ' + Object.keys(f.vars).slice(0, 3).map((s) => s + '=...').join(', ') + '.'), conf: 'none' };
    }
    const unknown = m.free[0]; const env = Object.assign({}, f.consts); const notes = []; const lines = [];
    Object.keys(m.given).forEach((s) => {
      const v = f.vars[s]; const g = m.given[s];
      if (v) { const r = toVarUnit(g.val, g.unit, v); env[s] = r.val; lines.push('\u2022 ' + s + ' = ' + fmt(g.val, 8) + (g.unit ? ' ' + g.unit : '') + (v.u && !g.unit ? ' ' + v.u : '') + ' ' + r.note); }
      else { env[s] = g.val; lines.push('\u2022 ' + s + ' = ' + fmt(g.val, 8) + ' (constant overridden)'); }
    });
    const usedConst = Object.keys(f.consts).filter((s) => !(s in m.given)); if (usedConst.length) T('Constants used', usedConst.map((s) => s + ' = ' + fmt(f.consts[s], 10)).join(', '));
    T('Unknown', unknown + ' (' + f.vars[unknown].d + '); all others given');
    let roots = [], method = '';
    if (f.solve[unknown]) { roots = [f.solve[unknown](env)]; method = 'closed-form rearrangement'; }
    else {
      const c = polyCoeffs(f.G, unknown, 4, env);
      if (c && c.length > 1) { method = 'polynomial in ' + unknown + ' (degree ' + (c.length - 1) + '), exact roots'; roots = polyRoots(c).filter((z) => z.im === 0).map((z) => z.re); }
      else if (c) roots = [];
      else {
        const g = (t) => ev(f.G, Object.assign({}, env, { [unknown]: t }));
        const dom = f.dom[unknown];
        if (dom) { method = 'numerical search in ' + dom[0] + '\u2013' + dom[1]; roots = scanRoots(g, dom[0], dom[1], 20000); }
        else { method = 'numerical search over many magnitudes'; roots = geomRoots(g); }
      }
    }
    roots = roots.filter((r) => isFinite(r)); const dom = f.dom[unknown]; if (dom) roots = roots.filter((r) => r >= dom[0] - 1e-9 && r <= dom[1] + 1e-9);
    T('Solve', method);
    if (!roots.length) return { answer: out('**' + f.name + '**', dd(f.tex), 'With these values there is no real solution for ' + unknown + '. Check the numbers and units.'), conf: 'none' };
    let okAll = true;
    roots.forEach((r) => { const e2 = Object.assign({}, env, { [unknown]: r }); const a = ev(f.L, e2), b = ev(f.R, e2); if (Math.abs(a - b) > 1e-7 * Math.max(Math.abs(a), Math.abs(b), 1e-300)) okAll = false; });
    T('Verify', 'substituted ' + unknown + ' back: left side = right side ' + (okAll ? '(agree)' : '(DISAGREE)'));
    const v = f.vars[unknown]; const res = roots.map((r) => {
      let s = unknown + ' = **' + fmt(r, 8) + (v.u ? ' ' + v.u : '') + '**';
      if (v.alt) { try { const al = convertUnit(r, v.u, v.alt).value; s += '  (= ' + fmt(al, 8) + ' ' + v.alt + ')'; } catch (e) { /* no alt */ } }
      return '\u2022 ' + s;
    });
    ctx.ans = roots[0];
    return { answer: out('**' + f.name + '**', dd(f.tex), 'Given:', ...lines, 'Find: ' + unknown + ' (' + v.d + ')', '', ...res, roots.length > 1 ? (roots.some((r) => r < 0) && roots.some((r) => r > 0) ? 'More than one mathematical solution; the physically meaningful one is usually the positive value.' : 'More than one solution satisfies the equation.') : null, f.note ? 'Note: ' + f.note : null, 'Units: SI unless you gave a unit (' + v.u + ' for the answer).'), conf: okAll ? 'verified' : 'computed' };
  }, 'u=0 a=2 t=5 find v');

  /* --- statistics --- */
  add('stats', 'Statistics and linear fit', (q) => {
    const reg = /\b(linear (regression|fit)|regression|best fit|line of best fit|trendline|fit a line)\b/i.test(q) && /\bx\s*[:=]/i.test(q) && /\by\s*[:=]/i.test(q);
    if (reg) return 0.96;
    const kw = /\b(mean|average|median|mode|standard deviation|std|variance|stdev|sum of|total of|minimum|maximum|range of|statistics|stats|sem|standard error)\b/i.test(q);
    return kw && numbersIn(q).length >= 2 ? 0.92 : 0;
  }, (q, ctx, T) => {
    if (/\bx\s*[:=]/i.test(q) && /\by\s*[:=]/i.test(q) && /(regression|fit|trend)/i.test(q)) {
      const xm = /\bx\s*[:=]\s*([^a-df-wyz]*?)(?=\by\s*[:=]|$)/i.exec(q), ym = /\by\s*[:=]\s*(.*)$/i.exec(q);
      const xs = numbersIn(xm ? xm[1] : ''), ys = numbersIn(ym ? ym[1] : '');
      if (xs.length !== ys.length || xs.length < 2) return { answer: 'I need the same number of x and y values (at least 2). I read ' + xs.length + ' x values and ' + ys.length + ' y values.', conf: 'none' };
      T('Read', xs.length + ' points'); const r = linfit(xs, ys); T('Method', 'ordinary least squares, y = m x + c');
      const pred = xs.map((x) => r.m * x + r.c); const sse = ys.reduce((s, y, i) => s + (y - pred[i]) ** 2, 0); T('Verify', 'residual sum of squares = ' + fmt(sse, 6) + ', R\u00B2 = ' + fmt(r.r2, 8));
      ctx.ans = r.m;
      return { answer: out(dd('y = ' + fmt(r.m, 8) + '\\,x ' + (r.c < 0 ? '- ' : '+ ') + fmt(Math.abs(r.c), 8)), '\u2022 slope m = **' + fmt(r.m, 8) + '**' + (isFinite(r.se) ? ' \u00B1 ' + fmt(r.se, 3) : ''), '\u2022 intercept c = **' + fmt(r.c, 8) + '**', '\u2022 R\u00B2 = **' + fmt(r.r2, 8) + '**', '\u2022 n = ' + xs.length), conf: 'computed' };
    }
    const cleaned = q.replace(/\b(mean|average|median|mode|standard deviation|std|stdev|variance|sum|total|minimum|maximum|range|statistics|stats|sem|standard error)\b.*?\b(of|for)\b/i, ' ');
    const a = numbersIn(cleaned); if (a.length < 2) return null; T('Read', a.length + ' numbers: ' + a.slice(0, 12).map((x) => fmt(x)).join(', ') + (a.length > 12 ? ' \u2026' : ''));
    const d = describe(a); T('Compute', 'mean, median, spread (sample uses n\u22121)');
    const chk = Math.abs(d.sum / d.n - d.mean) < 1e-12; ctx.ans = d.mean;
    return { answer: out('**Statistics of ' + d.n + ' values**', '\u2022 sum = ' + fmt(d.sum, 8), '\u2022 mean = **' + fmt(d.mean, 8) + '**', '\u2022 median = ' + fmt(d.med, 8), '\u2022 mode = ' + (d.modes.length ? d.modes.map((x) => fmt(x)).join(', ') : 'none (all values different)'), '\u2022 minimum = ' + fmt(d.min, 8) + ', maximum = ' + fmt(d.max, 8) + ', range = ' + fmt(d.range, 8), '\u2022 sample standard deviation s = **' + fmt(d.sdS, 8) + '**, population \u03C3 = ' + fmt(d.sdP, 8), '\u2022 variance: sample ' + fmt(d.varS, 8) + ', population ' + fmt(d.varP, 8), '\u2022 standard error of the mean = ' + fmt(d.sem, 6), isFinite(d.sem) ? 'Report as mean \u00B1 SEM: ' + fmt(d.mean, 6) + ' \u00B1 ' + fmt(d.sem, 3) : null), conf: chk ? 'verified' : 'computed' };
  }, 'mean and standard deviation of 4.1, 4.3, 3.9, 4.2');

  /* --- basic English checker (rule based) --- */
  const MISSPELL = { recieve: 'receive', definately: 'definitely', seperate: 'separate', occured: 'occurred', untill: 'until', wich: 'which', becuase: 'because', beacuse: 'because', thier: 'their', goverment: 'government', enviroment: 'environment', adress: 'address', accomodate: 'accommodate', beleive: 'believe', calender: 'calendar', concious: 'conscious', existance: 'existence', foriegn: 'foreign', freind: 'friend', grammer: 'grammar', independant: 'independent', knowlege: 'knowledge', neccessary: 'necessary', noticable: 'noticeable', occassion: 'occasion', persistant: 'persistent', posession: 'possession', publically: 'publicly', refered: 'referred', relevent: 'relevant', tommorow: 'tomorrow', truely: 'truly', wierd: 'weird', experiment: 'experiment', temperture: 'temperature', equiptment: 'equipment', refrence: 'reference', sucessful: 'successful', succesful: 'successful', writting: 'writing', begining: 'beginning', diffrent: 'different', intresting: 'interesting', comming: 'coming', alot: 'a lot', paramter: 'parameter', accross: 'across', arguement: 'argument', embarass: 'embarrass', maintainance: 'maintenance', priviledge: 'privilege', recomend: 'recommend', reccomend: 'recommend', seperately: 'separately', wether: 'whether', thru: 'through' };
  delete MISSPELL.experiment;
  const CONTR = { dont: "don't", cant: "can't", wont: "won't", isnt: "isn't", doesnt: "doesn't", didnt: "didn't", wasnt: "wasn't", werent: "weren't", havent: "haven't", hasnt: "hasn't", couldnt: "couldn't", wouldnt: "wouldn't", shouldnt: "shouldn't", im: "I'm", ive: "I've", youre: "you're", thats: "that's", theres: "there's", whats: "what's" };
  const AN_EXC = /^(uni|use|usu|uti|eu|one|once|ubiq|ura)/i, A_EXC = /^(hour|honest|honou?r|heir|mba|msc|fmri|nmr|xrd|sem|ftir|x-ray)/i;
  function grammarCheck(text) {
    let t = text; const issues = []; const note = (d) => { if (!issues.includes(d)) issues.push(d); };
    const sub = (re, fn, d) => { t = t.replace(re, (...a) => { const r = typeof fn === 'function' ? fn(...a) : fn; if (r !== a[0]) note(d); return r; }); };
    sub(/[ \t]{2,}/g, ' ', 'Removed extra spaces');
    sub(/\s+([,.;:!?])/g, '$1', 'Removed space before punctuation');
    sub(/([,;:!?])(?=[A-Za-z])/g, '$1 ', 'Added missing space after punctuation');
    sub(/([a-z])\.([A-Z])/g, '$1. $2', 'Added missing space after a full stop');
    sub(/\b([A-Za-z]+)\b/g, (m, w) => { const lw = w.toLowerCase(); if (MISSPELL[lw] && w === lw) return MISSPELL[lw]; if (MISSPELL[lw]) return MISSPELL[lw].replace(/^./, (c) => c.toUpperCase()); return m; }, 'Corrected common misspellings');
    sub(/\b(dont|cant|wont|isnt|doesnt|didnt|wasnt|werent|havent|hasnt|couldnt|wouldnt|shouldnt|im|ive|youre|thats|theres|whats)\b/gi, (m) => { const r = CONTR[m.toLowerCase()]; return /^[A-Z]/.test(m) && r[0] !== 'I' ? r.replace(/^./, (c) => c.toUpperCase()) : r; }, 'Added apostrophes in contractions');
    sub(/\bi\b/g, 'I', 'Capitalised "I"');
    sub(/\b(\w+)\s+\1\b/gi, (m, w) => (/^(that|had)$/i.test(w) ? m : w), 'Removed repeated words');
    sub(/\b(more|most)\s+(better|easier|faster|bigger|smaller|higher|lower|larger|worse)\b/gi, (m, a, b) => b, 'Removed double comparative');
    sub(/\b(he|she|it)\s+(are|have|do|don't|go|want|need|like|make|take)\b/gi, (m, s, v) => { const map = { are: 'is', have: 'has', do: 'does', "don't": "doesn't", go: 'goes', want: 'wants', need: 'needs', like: 'likes', make: 'makes', take: 'takes' }; return s + ' ' + map[v.toLowerCase()]; }, 'Fixed subject\u2013verb agreement (he/she/it)');
    sub(/\b(I)\s+(is|has|does)\b/g, (m, s, v) => s + ' ' + ({ is: 'am', has: 'have', does: 'do' })[v], 'Fixed subject\u2013verb agreement (I)');
    sub(/\b(you|we|they)\s+(is|has|does)\b/gi, (m, s, v) => s + ' ' + ({ is: 'are', has: 'have', does: 'do' })[v.toLowerCase()], 'Fixed subject\u2013verb agreement (you/we/they)');
    sub(/\b(a)\s+([aeiou]\w*)/gi, (m, a, w) => (AN_EXC.test(w) ? m : (a === 'A' ? 'An ' : 'an ') + w), 'Corrected "a" / "an"');
    sub(/\b(an)\s+([b-df-hj-np-tv-z]\w*)/gi, (m, a, w) => (A_EXC.test(w) ? m : (a === 'An' ? 'A ' : 'a ') + w), 'Corrected "a" / "an"');
    sub(/(^|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase(), 'Capitalised the first letter of a sentence');
    if (/[A-Za-z0-9)]\s*$/.test(t) && !/[.!?]$/.test(t.trim())) { t = t.replace(/\s*$/, '.'); note('Added a full stop at the end'); }
    return { fixed: t, issues };
  }
  add('grammar', 'English proof-reading (rule based)', (q) => (/\b(grammar|grammatical|proofread|spelling|correct (this|my|the)|check (this|my|the) (sentence|text|english|writing|paragraph)|fix (this|my|the) (sentence|english|text)|improve my english|rewrite correctly)\b/i.test(q) && !hasTamil(q) ? 0.93 : 0), (q, ctx, T) => {
    let body = null; const qm = /["\u201C]([^"\u201D]{3,})["\u201D]/.exec(q); if (qm) body = qm[1];
    else { const cm = /:\s*([\s\S]{3,})$/.exec(q); if (cm) body = cm[1]; else body = q.replace(/^.*?\b(grammar|proofread|spelling|correct|check|fix|improve my english)\b\s*(of|for|this|my|the|sentence|text|english|writing|paragraph|:)*\s*/i, ''); }
    body = (body || '').trim(); if (body.length < 3) return { answer: 'Paste the sentence after a colon, for example:  check grammar: i dont like this experiments', conf: 'none' };
    T('Read', body.length + ' characters of English text'); const r = grammarCheck(body); T('Rules applied', r.issues.length ? r.issues.length + ' rule type(s) fired' : 'no rule fired');
    if (!r.issues.length) return { answer: 'My rule checks found no problems in your text. (This checker covers capitalisation, spacing, common misspellings, contractions, repeated words, a/an and simple subject\u2013verb agreement; it cannot judge style or complex grammar.)', conf: 'computed' };
    return { answer: out('**Corrected text**', r.fixed, '', '**What I changed**', ...r.issues.map((i) => '\u2022 ' + i), '', '(Rule-based checker: covers common errors only. Read the result again before using it.)'), conf: 'computed' };
  }, 'check grammar: i dont like this');

  /* --- attached text files --- */
  function parseTable(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean); if (lines.length < 3) return null;
    const sepRe = /[,\t;]|\s{2,}|\s(?=[-+\d.])/; const rows = lines.map((l) => l.split(sepRe).map((c) => c.trim()));
    const w = Math.max(...rows.map((r) => r.length)); if (w < 1) return null;
    const isNum = (s) => s !== '' && isFinite(Number(s)); const first = rows[0]; const header = first.some((c) => c !== '' && !isNum(c));
    const body = header ? rows.slice(1) : rows; const cols = [];
    for (let j = 0; j < w; j++) { const vals = body.map((r) => r[j]).filter((v) => v !== undefined && v !== ''); const nums = vals.filter(isNum).map(Number); if (nums.length >= 2 && nums.length >= vals.length * 0.8) cols.push({ name: header ? (first[j] || 'col ' + (j + 1)) : 'col ' + (j + 1), nums }); }
    return cols.length ? { cols, rows: body.length } : null;
  }
  add('file', 'Attached text files', (q, ctx, files) => {
    if (!files || !files.length) return 0;
    const generic = !q || /\b(summar|analy|stats|describe|columns?|what('s| is) in|overview|inspect|check)\b/i.test(q);
    return generic ? 0.96 : 0;
  }, (q, ctx, T, files) => {
    const L = [];
    files.forEach((f) => {
      const words = (f.text.match(/\S+/g) || []).length, lines = f.text.split(/\r?\n/).length; T('Read file', f.name + ': ' + lines + ' lines, ' + words + ' words');
      L.push('**' + f.name + '**: ' + lines + ' lines, ' + words + ' words, ' + f.text.length + ' characters.');
      const tb = parseTable(f.text);
      if (tb) { T('Detected', 'numeric table, ' + tb.cols.length + ' numeric column(s)'); L.push('Numeric table with ' + tb.rows + ' data rows. Column statistics:'); tb.cols.slice(0, 8).forEach((c) => { const d = describe(c.nums); L.push('\u2022 ' + c.name + ': n = ' + d.n + ', mean = ' + fmt(d.mean, 6) + ', sd = ' + fmt(d.sdS, 4) + ', min = ' + fmt(d.min, 6) + ', max = ' + fmt(d.max, 6)); }); }
      else L.push('First line: ' + f.text.split(/\r?\n/)[0].slice(0, 120));
    });
    return { answer: L.join('\n'), conf: 'computed' };
  }, 'attach a CSV file');

  /* --- plain arithmetic / expression evaluation --- */
  const prepMath = (t) => t.replace(new RegExp('(' + NUM + ')\\s*%\\s*of\\s*', 'gi'), '($1/100)*').replace(/(\d)\s*%/g, '($1/100)');
  add('math', 'Calculator', (q, ctx) => {
    let t = q.replace(/\b(calculate|compute|evaluate|what is|what's|find|the value of|value of|simplify|equals?)\b/gi, ' ').replace(/[?=]+\s*$/, '').replace(/\b(degrees?)\b/gi, ' ').trim(); t = prepMath(t);
    if (!t || !/[\d]|pi|\be\b|ans/.test(t)) return 0;
    if (!/^[\s0-9A-Za-z+\-*/^().,!%\u00B2\u00B3\u00D7\u00F7\u221A\u03C0\u00B0\u2212]+$/.test(t)) return 0;
    try { const a = safeParse(t); const v = varsOf(a); if (v.size) return 0; if (a.t === 'n' && !/[+\-*/^]/.test(t.slice(1))) return 0; ev(a, { ans: ctx.ans === undefined ? 0 : ctx.ans }); return /\b(calculate|compute|evaluate|what is|what's|value)\b/i.test(q) ? 0.9 : 0.7; } catch (e) { return 0; }
  }, (q, ctx, T) => {
    const deg = /\bdegrees?\b/i.test(q);
    const t = prepMath(q.replace(/\b(calculate|compute|evaluate|what is|what's|find|the value of|value of|simplify|equals?)\b/gi, ' ').replace(/[?=]+\s*$/, '').replace(/\b(degrees?)\b/gi, ' ').trim());
    const a = safeParse(t); T('Parse', 'expression \u2192 ' + plain(a) + (deg ? '  (angles in degrees)' : '  (angles in radians)'));
    const env = { ans: ctx.ans === undefined ? 0 : ctx.ans }; const v = ev(a, env, deg);
    if (!isFinite(v)) return { answer: 'The result is undefined or infinite (for example division by zero, or the square root or logarithm of a number outside its range; I do not work with complex numbers here).', conf: 'none' };
    const alt = ev(parse(t.replace(/\^/g, '**').replace(/\*\*/g, '^')), env, deg); T('Verify', 'second evaluation agrees: ' + (alt === v));
    const q2 = ratify(v, 1000, 1e-12); ctx.ans = v;
    const eqTex = texOf(a) === fmtTeX(v, 12) ? null : dd(texOf(a) + '=' + fmtTeX(v, 12));
    return { answer: out(eqTex, '**' + fmt(v, 12) + '**' + (q2 && q2[1] !== 1 ? '  (= ' + q2[0] + '/' + q2[1] + ')' : ''), Math.abs(v) > 1e14 ? 'Warning: this is an enormous number. If the expression contains tan(\u03C0/2), a division by something that should be exactly zero, or a similar singular point, the true value is undefined and this is only a floating-point artefact.' : null), conf: Math.abs(v) > 1e14 ? 'none' : 'computed' };
  }, 'calculate sin(30\u00B0) + 2^10');

  /* --- knowledge retrieval --- */
  const STOP = new Set('a an the of is are was were to in on for and or with what how why when where which who whom do does did can could should would explain tell me about give describe define meaning mean please simple short brief example examples understand learn study notes note topic'.split(' '));
  const wordsOf = (s) => (s.toLowerCase().match(/[a-z0-9\u00E0-\u024F]+|[\u0B80-\u0BFF]+/g) || []);
  const KB_DOC_FREQ = {}; KB.forEach((e) => { new Set(wordsOf(e.t + ' ' + e.en)).forEach((w) => { KB_DOC_FREQ[w] = (KB_DOC_FREQ[w] || 0) + 1; }); });
  function kbRank(q) {
    const low = q.toLowerCase(); const qw = wordsOf(q).filter((w) => !STOP.has(w) && w.length > 1);
    return KB.map((e) => {
      let s = 0; const why = [];
      e.k.forEach((k) => { const lk = k.toLowerCase(); const hit = /[\u0B80-\u0BFF]/.test(lk) ? low.includes(lk) : new RegExp('(^|[^a-z0-9])' + escRe(lk) + '($|[^a-z0-9])').test(low); if (hit) { s += 3 + (lk.split(/\s+/).length - 1) * 0.5; why.push(k); } });
      const tw = new Set(wordsOf(e.t)); qw.forEach((w) => { if (tw.has(w)) s += 1.5; });
      const bw = new Set(wordsOf(e.en)); let body = 0; qw.forEach((w) => { if (bw.has(w)) body += 0.4 * Math.log(1 + KB.length / (KB_DOC_FREQ[w] || 1)); }); s += Math.min(body, 2);
      return { e, s, why };
    }).sort((a, b) => b.s - a.s);
  }
  add('kb', 'Built-in science notes', (q) => { const r = kbRank(q); return r[0].s >= 3 ? 0.55 : r[0].s >= 1.8 ? 0.3 : 0; }, (q, ctx, T) => {
    const r = kbRank(q); const best = r[0]; if (best.s < 1.8) return null;
    T('Retrieve', 'best note "' + best.e.t + '" (score ' + best.s.toFixed(1) + (best.why.length ? '; matched: ' + best.why.slice(0, 3).join(', ') : '') + ')');
    const ta = hasTamil(q) && best.e.ta; const rel = r.slice(1).filter((x) => x.s >= 2.5).slice(0, 3).map((x) => x.e.t);
    T('Select', ta ? 'Tamil version' : 'English version');
    return { answer: out('**' + best.e.t + '**', ta ? best.e.ta : best.e.en, !ta && hasTamil(q) ? '(Tamil text is available only for some topics; this note is in English.)' : null, rel.length ? '\nSee also: ' + rel.join(' \u00B7 ') : null), conf: 'knowledge', topic: best.e.id };
  }, 'explain the Schr\u00F6dinger equation');
  /* ===== the thinking engine: understand -> plan -> compute -> verify -> answer ===== */
  const GREET = /^(hi|hello|hey|hii+|vanakkam|good (morning|afternoon|evening)|thanks?|thank you|thx|ok|okay|bye|\u0BB5\u0BA3\u0B95\u0BCD\u0B95\u0BAE\u0BCD|\u0BA8\u0BA9\u0BCD\u0BB1\u0BBF)\W*$/i;
  const CAP_RE = /\b(capacity|capabilit(?:y|ies)|what can you do|what do you know|your (?:limits|limitations|skills|abilities|features)|what are you|how (?:smart|powerful) are you|how to use you|self[- ]?test|modules)\b|^\s*help\W*$|\u0BA4\u0BBF\u0BB1\u0BA9\u0BCD|\u0B8E\u0BA9\u0BCD\u0BA9 \u0B9A\u0BC6\u0BAF\u0BCD\u0BAF/i;
  const CONF_LABEL = { verified: 'Verified by an internal check', computed: 'Computed', knowledge: 'From built-in notes', none: 'Not answered' };
  let selfTestCache = null;

  function thinkCore(input, ctxIn) {
    const t0 = Date.now(); const ctx = ctxIn || {}; const trace = []; const T = (a, b) => trace.push([a, b]);
    const raw = String(input || '').trim(); const { q, files } = splitAttach(raw); const tam = hasTamil(q);
    T('Read', (tam ? 'Tamil' : 'English') + ' text, ' + q.length + ' characters' + (files.length ? ', ' + files.length + ' attached file(s)' : ''));
    const done = (answer, conf, module, extra) => Object.assign({ answer, trace, conf, confLabel: CONF_LABEL[conf] || '', module, lang: tam ? 'ta' : 'en', ms: Date.now() - t0 }, extra || {});
    if (!q && !files.length) return done('Type a question or a calculation.', 'none', 'none');
    if (GREET.test(q)) {
      T('Plan', 'greeting'); const thanks = /thank|thx|\u0BA8\u0BA9\u0BCD\u0BB1\u0BBF/i.test(q), bye = /^bye/i.test(q);
      return done(tam ? (thanks ? 'மகிழ்ச்சி! வேறு கேள்விகள் இருந்தால் கேளுங்கள்.' : 'வணக்கம்! நான் IBD Bot. இயற்பியல், கணிதம், வேதியியல் கணக்குகளையும் அறிவியல் குறிப்புகளையும் இந்த இணையப்பக்கத்திற்குள்ளேயே செய்கிறேன். "capacity" என்று கேட்டால் என் திறன்களைக் கூறுவேன்.') : (thanks ? 'You are welcome. Ask me anything else in physics, maths or chemistry.' : bye ? 'Goodbye!' : 'Hello! I am IBD Bot. I calculate and explain physics, mathematics and chemistry entirely inside this web page, with no model download. Try: "differentiate x^2 sin x", "balance Fe + O2 -> Fe2O3", "convert 500 nm to eV", or ask "capacity" to see everything I can do.'), 'knowledge', 'greeting');
    }
    if (CAP_RE.test(q)) { T('Plan', 'describe my own capacity (live counts + self-test)'); return done(capacityText(tam), 'computed', 'capacity'); }
    const cands = MODULES.map((m) => { let s = 0; try { s = m.detect(q, ctx, files) || 0; } catch (e) { s = 0; } return { m, s }; }).filter((c) => c.s > 0).sort((a, b) => b.s - a.s);
    T('Plan', cands.length ? 'candidate modules: ' + cands.slice(0, 4).map((c) => c.m.label + ' (' + c.s.toFixed(2) + ')').join(', ') : 'no module recognised the request');
    for (const c of cands) {
      let r = null;
      try { r = c.m.run(q, ctx, T, files); }
      catch (e) { T('Problem', e.message); return done('I understood this as **' + c.m.label + '**, but could not complete it: ' + e.message, 'none', c.m.id); }
      if (r) { T('Answer', c.m.label + ' \u2192 ' + (CONF_LABEL[r.conf] || r.conf)); return done(r.answer, r.conf, c.m.id, r.topic ? { topic: r.topic } : null); }
    }
    const near = kbRank(q).filter((x) => x.s >= 1).slice(0, 3).map((x) => x.e.t);
    T('Answer', 'nothing matched; saying so honestly');
    const msg = tam ? 'இந்தக் கேள்வி என் உள்ளமைந்த தொகுதிகளில் எதற்கும் பொருந்தவில்லை. நான் மொழி மாதிரி அல்ல; கணக்குகள், அலகு மாற்றம், சமன்பாடு சமன்செய்தல், அறிவியல் குறிப்புகள் ஆகியவற்றை மட்டுமே செய்வேன். "capacity" என்று கேளுங்கள்.'
      : out("I could not match this to anything I can do inside this page. I am a rule-based engine, not a language model, so I cannot answer open-ended questions.", near.length ? 'Closest notes I have: ' + near.join(', ') + '.' : null, 'Ask "capacity" to see my modules, or try one of these:', ...MODULES.filter((m) => m.example).slice(0, 6).map((m) => '\u2022 ' + m.example));
    return done(msg, 'none', 'none');
  }

  /* ===== capacity ===== */
  function capacity() {
    const total = (arr) => arr.length;
    return {
      version: VERSION,
      elements: EL.length, elementFields: 15, compounds: Object.keys(COMMON).length, kbEntries: KB.length, kbTamil: KB.filter((e) => e.ta).length,
      formulas: FORMULAS.length, constants: CONSTANTS.length, unitCount: Object.keys(UNITS).length + Object.keys(TEMPS).length, unitCategories: UNIT_LIST.length + 1,
      misspellings: Object.keys(MISSPELL).length, modules: MODULES.map((m) => ({ id: m.id, label: m.label, example: m.example || '' })), total: total(MODULES),
    };
  }
  function capacityText(ta) {
    const c = capacity(); const st = selfTest();
    if (ta) return out('**IBD Bot உள்ளமைந்த சிந்தனை இயந்திரம் – திறன்**',
      'நான் மொழி மாதிரி (LLM) அல்ல. எந்த மாதிரியையும் பதிவிறக்கவோ இணையத்தில் அழைக்கவோ தேவையில்லை; எல்லாம் இந்தப் பக்கத்தின் நிரலுக்குள்ளேயே நடக்கிறது.',
      '• ' + c.elements + ' தனிமங்களின் தரவு, ' + c.compounds + ' பெயரிட்ட சேர்மங்கள்', '• ' + c.formulas + ' இயற்பியல்/வேதியியல் சூத்திரங்களைத் தீர்க்கும் திறன், ' + c.constants + ' மாறிலிகள், ' + c.unitCount + ' அலகுகள்',
      '• வகைக்கெழு, தொகையீடு, சமன்பாடு தீர்த்தல், வேதிச் சமன்பாடு சமன் செய்தல், ஸ்டாய்கியோமெட்ரி, புள்ளியியல்', '• ' + c.kbEntries + ' அறிவியல் குறிப்புகள் (' + c.kbTamil + ' தமிழில்)',
      'சுய சோதனை: ' + st.passed + '/' + st.total + ' தேர்ச்சி.', 'வரம்புகள்: திறந்த கேள்விகளுக்கு (எ.கா. கட்டுரை எழுதுதல்) என்னால் பதில் சொல்ல முடியாது; தமிழ் இலக்கணத்தைச் சரிபார்க்க முடியாது; படங்களைப் படிக்க முடியாது.');
    return out('**IBD Bot built-in thinking engine: capacity**',
      'I am a rule-based reasoning engine, not a language model. Nothing is downloaded and nothing is sent to any server: every answer is computed by the code in this page, using the data embedded in it.',
      '', '**What is inside (live counts)**',
      '\u2022 Periodic table: ' + c.elements + ' elements \u00D7 ' + c.elementFields + ' properties; ' + c.compounds + ' named compounds (water, TiO\u2082, CoFe\u2082O\u2084 \u2026)',
      '\u2022 ' + c.formulas + ' solvable physics/chemistry formulas (kinematics, Ohm, gas law, Bragg, Scherrer, photon energy, Rydberg, decay, telescope \u2026)',
      '\u2022 ' + c.constants + ' physical constants; ' + c.unitCount + ' unit names in ' + c.unitCategories + ' categories (including Oe \u2194 A/m and photon nm \u2194 eV \u2194 THz \u2194 cm\u207B\u00B9)',
      '\u2022 ' + c.kbEntries + ' hand-written science notes (' + c.kbTamil + ' also in Tamil), covering physics, chemistry, maths, computing, astronomy and writing',
      '', '**What I can compute (and check myself)**',
      ...c.modules.map((m) => '\u2022 ' + m.label + (m.example ? '  \u2014  e.g. "' + m.example + '"' : '')),
      '', '**How I think**',
      'Each message goes through five stages you can open under "Thinking": understand (language, intent) \u2192 plan (which modules fit, with scores) \u2192 compute \u2192 verify (substitute roots back, differentiate integrals, count atoms, convert back) \u2192 answer, with a label saying how far the result was checked.',
      '', '**Limits (please read)**',
      '\u2022 I cannot answer open-ended questions, write essays or chat freely: if no module matches, I say so.',
      '\u2022 Notes are a fixed set; a topic not in them is not answered. Calculations are only as good as the numbers and units you give.',
      '\u2022 Integration covers the rule table (polynomials, exp/sin/cos/tan, 1/(quadratic), by-parts with polynomials, ln x, u\u2032/u); anything else is reported as not found, or computed numerically if you give limits.',
      '\u2022 Tamil: I understand Tamil greetings and Tamil keywords for ' + c.kbTamil + ' notes; I cannot check Tamil grammar. English checks are rule-based and basic.',
      '\u2022 I cannot read images, PDF, Word or Excel files; plain text/CSV only.',
      '', 'Self-test just now: **' + st.passed + ' of ' + st.total + ' internal checks passed** (' + st.ms + ' ms).' + (st.failed.length ? ' Failed: ' + st.failed.join(', ') : ''));
  }

  /* ===== self-test ===== */
  const TESTS = [
    ['calculator', () => thinkCore('calculate 2+3*4^2/8-1', {}).answer.includes('**7**')],
    ['degrees', () => thinkCore('sin(30\u00B0)', {}).answer.includes('0.5')],
    ['derivative', () => { const r = thinkCore('differentiate x^2 sin x', {}); return r.conf === 'verified' && r.answer.includes('2x \\sin x + x^{2} \\cos x'); }],
    ['chain rule', () => { const r = thinkCore('derivative of e^(2x)', {}); return r.conf === 'verified' && r.answer.includes('2e^{2x}'); }],
    ['integral table', () => { const r = thinkCore('integrate 1/(1+x^2)', {}); return r.conf === 'verified' && r.answer.includes('\\arctan x'); }],
    ['integral by parts', () => thinkCore('integrate x e^x', {}).answer.includes('x e^{x} - e^{x}')],
    ['definite integral', () => thinkCore('integrate x^2 from 0 to 3', {}).answer.includes('**Value = 9**')],
    ['quadratic', () => { const a = thinkCore('solve x^2 - 5x + 6 = 0', {}).answer; return a.includes('**3**') && a.includes('**2**'); }],
    ['complex roots', () => thinkCore('solve x^2 + 1 = 0', {}).answer.includes('i')],
    ['linear system', () => { const a = thinkCore('solve 2x + y = 5, x - y = 1', {}).answer; return a.includes('x = **2**') && a.includes('y = **1**'); }],
    ['transcendental', () => thinkCore('solve cos(x) = x', {}).answer.includes('0.739085')],
    ['balance', () => thinkCore('balance Fe + O2 -> Fe2O3', {}).answer.includes('4 Fe + 3 O2 \u2192 2 Fe2O3')],
    ['ambiguous equation refused', () => thinkCore('balance H2 + O2 -> H2O2 + H2O', {}).answer.includes('more than one')],
    ['stoichiometry', () => { const a = thinkCore('H2 + O2 -> H2O with 4 g H2 and 40 g O2', {}).answer; return a.includes('H2O') && a.includes('35.74'); }],
    ['molar mass', () => thinkCore('molar mass of H2SO4', {}).answer.includes('98.07')],
    ['mole conversion', () => thinkCore('moles in 10 g of NaCl', {}).answer.includes('0.171')],
    ['solution prep', () => thinkCore('how much NaOH to prepare 250 mL of 0.1 M', {}).answer.includes('0.9999')],
    ['pH', () => thinkCore('pH of 0.01 M HCl', {}).answer.includes('pH = 2')],
    ['element', () => thinkCore('atomic mass of iron', {}).answer.includes('55.845')],
    ['units', () => thinkCore('convert 5 eV to J', {}).answer.includes('8.0108832e-19')],
    ['photon units', () => thinkCore('convert 500 nm to eV', {}).answer.includes('2.479')],
    ['temperature', () => thinkCore('convert 100 C to K', {}).answer.includes('373.15')],
    ['kinematics', () => thinkCore('u=0, a=2, t=5, find v', {}).answer.includes('10 m/s')],
    ['quadratic physics', () => thinkCore('s = 100 m, u = 0, a = 2, find t', {}).answer.includes('10')],
    ['Bragg', () => { const a = thinkCore("bragg's law lam=0.15406 nm, d=0.2 nm, n=1, find theta", {}).answer; return a.includes('deg') && a.includes('22.'); }],
    ['photon energy', () => thinkCore('photon energy lam=500 nm', {}).answer.includes('eV')],
    ['statistics', () => thinkCore('mean of 1, 2, 3, 4, 10', {}).answer.includes('mean = **4**')],
    ['regression', () => thinkCore('linear regression x: 1 2 3 4 y: 2 4 6 8', {}).answer.includes('slope m = **2**')],
    ['grammar', () => thinkCore('check grammar: i dont like this', {}).answer.includes("I don't like this.")],
    ['constants', () => thinkCore('Planck constant', {}).answer.includes('6.62607015')],
    ['knowledge', () => thinkCore('explain the Schr\u00F6dinger equation', {}).answer.includes('probability density')],
    ['Tamil knowledge', () => thinkCore('\u0B93\u0BAE\u0BBF\u0BA9\u0BCD \u0BB5\u0BBF\u0BA4\u0BBF', {}).answer.includes('\u0BAE\u0BBE\u0BB1\u0BBE \u0BB5\u0BC6\u0BAA\u0BCD\u0BAA\u0BA8\u0BBF\u0BB2\u0BC8')],
    ['honest fallback', () => thinkCore('write me a poem about the ocean', {}).conf === 'none'],
    ['improper integral refused', () => { const r = thinkCore('integrate 1/x from -1 to 1', {}); return r.conf === 'none' && /singularity/.test(r.answer); }],
    ['singular value flagged', () => { const r = thinkCore('tan(pi/2)', {}); return r.conf === 'none' && /Warning/.test(r.answer); }],
    ['complex roots format', () => thinkCore('solve x^2 = -4', {}).answer.includes('**2i**')],
    ['ans memory', () => { const c = {}; thinkCore('calculate 6*7', c); return thinkCore('ans + 8', c).answer.includes('50'); }],
    ['tex renderer', () => texToHtml('\\frac{a}{b}+x^{2}').includes('ibd-frac')],
    ['docx writer', () => { const b = makeDocx('t', 'hello'); return b[0] === 0x50 && b[1] === 0x4B; }],
  ];
  function selfTest() {
    if (selfTestCache) return selfTestCache;
    const t0 = Date.now(); const failed = [];
    TESTS.forEach(([n, fn]) => { let ok = false; try { ok = !!fn(); } catch (e) { ok = false; } if (!ok) failed.push(n); });
    selfTestCache = { total: TESTS.length, passed: TESTS.length - failed.length, failed, ms: Date.now() - t0 };
    return selfTestCache;
  }
  function think(input, ctx) { return thinkCore(input, ctx); }

  /* ===== LaTeX -> HTML (self-contained renderer, no library) ===== */
  const TSYM = { alpha: '\u03B1', beta: '\u03B2', gamma: '\u03B3', delta: '\u03B4', epsilon: '\u03B5', varepsilon: '\u03B5', zeta: '\u03B6', eta: '\u03B7', theta: '\u03B8', vartheta: '\u03D1', iota: '\u03B9', kappa: '\u03BA', lambda: '\u03BB', mu: '\u03BC', nu: '\u03BD', xi: '\u03BE', pi: '\u03C0', rho: '\u03C1', sigma: '\u03C3', tau: '\u03C4', phi: '\u03C6', varphi: '\u03C6', chi: '\u03C7', psi: '\u03C8', omega: '\u03C9', Gamma: '\u0393', Delta: '\u0394', Theta: '\u0398', Lambda: '\u039B', Xi: '\u039E', Pi: '\u03A0', Sigma: '\u03A3', Phi: '\u03A6', Psi: '\u03A8', Omega: '\u03A9', hbar: '\u0127', ell: '\u2113', partial: '\u2202', nabla: '\u2207', infty: '\u221E', pm: '\u00B1', mp: '\u2213', times: '\u00D7', cdot: '\u00B7', approx: '\u2248', neq: '\u2260', ne: '\u2260', leq: '\u2264', le: '\u2264', geq: '\u2265', ge: '\u2265', to: '\u2192', rightarrow: '\u2192', leftarrow: '\u2190', Rightarrow: '\u21D2', Leftrightarrow: '\u21D4', leftrightarrow: '\u2194', rightleftharpoons: '\u21CC', propto: '\u221D', sim: '\u223C', in: '\u2208', degree: '\u00B0', circ: '\u2218', ldots: '\u2026', dots: '\u2026', cdots: '\u22EF', langle: '\u27E8', rangle: '\u27E9', int: '\u222B', oint: '\u222E', sum: '\u2211', prod: '\u220F', AA: '\u00C5', angle: '\u2220', perp: '\u22A5', parallel: '\u2225', equiv: '\u2261', forall: '\u2200', exists: '\u2203', cup: '\u222A', cap: '\u2229', subset: '\u2282', emptyset: '\u2205', prime: '\u2032', mid: '|', ',': '\u2009', ';': '\u2005', ':': '\u2005', '!': '', quad: '\u2003', qquad: '\u2003\u2003', ' ': ' ', '%': '%', '&': '&', '#': '#', '_': '_', '{': '{', '}': '}', '|': '\u2016', '$': '$' };
  const TFUNC = new Set(['sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan', 'ln', 'log', 'exp', 'lim', 'max', 'min', 'det', 'ker', 'deg', 'Pr']);
  function texToHtml(src) {
    let i = 0, roman = false; const s = String(src);
    const peekc = () => s[i];
    function ws() { while (i < s.length && /\s/.test(s[i])) i++; }
    function group() { ws(); if (s[i] === '{') { i++; const h = seq('}'); i++; return h; } return atom(); }
    function rawGroup() { ws(); if (s[i] === '{') { let d = 1, st = ++i; while (i < s.length && d) { if (s[i] === '{') d++; else if (s[i] === '}') d--; i++; } return s.slice(st, i - 1); } return s[i++] || ''; }
    function matrix(body, open, close) {
      const rows = body.split(/\\\\/).map((r) => r.trim()).filter(Boolean).map((r) => r.split('&').map((c) => texToHtml(c.trim())));
      return '<span class="ibd-mat"><span class="ibd-br">' + open + '</span><span class="ibd-grid">' + rows.map((r) => '<span class="ibd-row">' + r.map((c) => '<span class="ibd-cell">' + c + '</span>').join('') + '</span>').join('') + '</span><span class="ibd-br">' + close + '</span></span>';
    }
    function atom() {
      const c = s[i++]; if (c === undefined) return '';
      if (c === '{') { const h = seq('}'); i++; return h; }
      if (c === '\\') {
        let name = ''; if (/[A-Za-z]/.test(s[i] || '')) { while (/[A-Za-z]/.test(s[i] || '')) name += s[i++]; } else name = s[i++] || '';
        switch (name) {
          case 'frac': case 'dfrac': case 'tfrac': { const a = group(), b = group(); return '<span class="ibd-frac"><span class="ibd-num">' + a + '</span><span class="ibd-den">' + b + '</span></span>'; }
          case 'sqrt': { let idx = ''; if (s[i] === '[') { i++; let t = ''; while (i < s.length && s[i] !== ']') t += s[i++]; i++; idx = '<sup class="ibd-ridx">' + esc(t) + '</sup>'; } const a = group(); return idx + '<span class="ibd-sqrt"><span class="ibd-rad">\u221A</span><span class="ibd-radicand">' + a + '</span></span>'; }
          case 'text': case 'textbf': case 'textit': return '<span class="ibd-txt">' + esc(rawGroup()) + '</span>';
          case 'mathrm': case 'operatorname': case 'mathbf': case 'boldsymbol': { const pr = roman; roman = true; const h = group(); roman = pr; return '<span class="ibd-rm">' + h + '</span>'; }
          case 'left': case 'right': { ws(); let d = s[i++]; if (d === '\\') { d = s[i++]; if (d === '|') d = '\u2016'; else if (d === '{' || d === '}') { /* literal brace */ } else if (/[a-z]/i.test(d)) { let nm = d; while (/[A-Za-z]/.test(s[i] || '')) nm += s[i++]; d = TSYM[nm] || ''; } } if (d === '.') return ''; if (d === '<') d = '\u27E8'; if (d === '>') d = '\u27E9'; return '<span class="ibd-delim">' + esc(d) + '</span>'; }
          case 'vec': case 'hat': case 'bar': case 'dot': case 'tilde': case 'overline': { const h = group(); const mk = { vec: '\u20D7', hat: '\u0302', bar: '\u0305', dot: '\u0307', tilde: '\u0303', overline: '\u0305' }[name]; return '<span class="ibd-acc">' + h + mk + '</span>'; }
          case 'begin': { const env = rawGroup(); const e = s.indexOf('\\end{' + env + '}', i); const body = e < 0 ? s.slice(i) : s.slice(i, e); i = e < 0 ? s.length : e + 6 + env.length; if (env === 'pmatrix') return matrix(body, '(', ')'); if (env === 'bmatrix') return matrix(body, '[', ']'); if (env === 'vmatrix') return matrix(body, '|', '|'); return matrix(body, '', ''); }
          case 'end': rawGroup(); return '';
          case '\\': return '<br>';
          case 'label': case 'nonumber': return '';
          default:
            if (TFUNC.has(name)) return '<span class="ibd-fn">' + name + '</span>';
            if (name in TSYM) { const sy = TSYM[name]; return /^[\u222B\u222E\u2211\u220F]$/.test(sy) ? '<span class="ibd-big">' + sy + '</span>' : esc(sy); }
            return esc(name);
        }
      }
      if (c === '^' || c === '_') return '';
      if (/\s/.test(c)) return '';
      if (/[A-Za-z]/.test(c)) return roman ? esc(c) : '<i>' + c + '</i>';
      if (/[+]/.test(c)) return '<span class="ibd-bin">+</span>';
      if (c === '-') return '<span class="ibd-bin">\u2212</span>';
      if (/[=<>]/.test(c)) return '<span class="ibd-rel">' + esc(c) + '</span>';
      if (c === "'") return '\u2032';
      if (c === '~') return '\u00A0';
      return esc(c);
    }
    function seq(end) {
      let h = '';
      while (i < s.length && s[i] !== end) {
        let base = atom(); ws(); let sup = '', sub = '';
        while (s[i] === '^' || s[i] === '_') { const k = s[i++]; const g = group(); if (k === '^') sup = g; else sub = g; ws(); }
        if (!sup && !sub && base.startsWith('<span class="ibd-fn">')) h += base + '\u2009';
        else if (sup && sub) h += base + '<span class="ibd-ss"><sup>' + sup + '</sup><sub>' + sub + '</sub></span>';
        else if (sup) h += base + '<sup>' + sup + '</sup>'; else if (sub) h += base + '<sub>' + sub + '</sub>'; else h += base;
      }
      return h;
    }
    return seq(null);
  }

  /* ===== minimal .docx writer (zip "store" mode, no library) ===== */
  const CRC_T = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zipStore(files) {
    const enc = new TextEncoder(); const parts = [], central = []; let off = 0;
    files.forEach((f) => {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), name); off += 30 + name.length + data.length;
    });
    const csize = central.reduce((s, p) => s + p.length, 0);
    const eo = new DataView(new ArrayBuffer(22)); eo.setUint32(0, 0x06054b50, true); eo.setUint16(8, files.length, true); eo.setUint16(10, files.length, true); eo.setUint32(12, csize, true); eo.setUint32(16, off, true);
    const all = parts.concat(central, [new Uint8Array(eo.buffer)]); const tot = all.reduce((s, p) => s + p.length, 0); const outb = new Uint8Array(tot); let o = 0; all.forEach((p) => { outb.set(p, o); o += p.length; }); return outb;
  }
  const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  function makeDocx(title, text) {
    const lines = String(text).replace(/\r/g, '').split('\n'); let code = false; const paras = [];
    paras.push('<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>' + xmlEsc(title) + '</w:t></w:r></w:p>');
    lines.forEach((l) => {
      if (/^```/.test(l)) { code = !code; return; }
      let t = l; const bold = /^\*\*[^*]+\*\*$/.test(t.trim()); t = t.replace(/\*\*/g, '').replace(/^\$\$|\$\$$/g, '');
      const rpr = code ? '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr>' : bold ? '<w:rPr><w:b/></w:rPr>' : '';
      paras.push('<w:p><w:r>' + rpr + '<w:t xml:space="preserve">' + xmlEsc(t) + '</w:t></w:r></w:p>');
    });
    const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
    return zipStore([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
      { name: 'word/document.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + NS + '><w:body>' + paras.join('') + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>' },
    ]);
  }

  const API = { think, capacity, selfTest, texToHtml, makeDocx, version: VERSION, modules: () => MODULES.map((m) => ({ id: m.id, label: m.label, example: m.example })), _internal: { parse, simp, ev, diff, integ, tidy, balanceEquation, parseFormula, massOf, convertUnit, FORMULAS, KB, EL, kbRank, grammarCheck, describe } };

  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.IBDBrain = API;
})(typeof window !== 'undefined' ? window : globalThis);
