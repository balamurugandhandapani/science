/* IBD Bot: interface for the built-in thinking engine (ibd-brain.js).
   Everything runs inside these files: no AI model, no download, no API key, no CDN library.
   Voice input/output (optional, off by default) uses the browser's own speech features. */
(() => {
  const root = document.getElementById('ibd-bot');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const $ = (s) => root.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const input = $('#ibd-message'), send = $('#ibd-send'), mic = $('#ibd-mic'), voiceBtn = $('#ibd-voice');
  const fileInput = $('#ibd-file-input'), fileLabel = $('#ibd-file-label');
  const status = $('#ibd-engine-status'), detail = $('#ibd-engine-detail'), statusCard = $('.ibd-status-card');
  const chat = $('#ibd-chat-content'), welcome = $('#ibd-welcome');
  const langSel = $('#ibd-lang'), loadMsg = $('#ibd-load-msg');
  const MAX_FILE_CHARS = 100000;
  const MATH_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;
  const FENCE_RE = /(```[\s\S]*?```)/g;
  const INLINE_RE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  let cfg = Object.assign({ lang: 'en-IN' }, store.get('ibd_site_cfg', {}));
  let history = store.get('ibd_site_chat', []);
  const ctx = {};                       // engine memory (e.g. "ans" = last numeric result)
  let pending = [], brain = null, busy = false, skip = false, voiceMode = false, listening = false, rec = null;

  const setState = (state, title, sub) => { statusCard.dataset.state = state; status.textContent = title; if (sub !== undefined) detail.textContent = sub; };
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s); }); }

  // ---------- rich text (maths rendered by the engine's own renderer) ----------
  function inlineMd(parent, text) {
    text.split(INLINE_RE).forEach((p, i) => {
      if (!p) return;
      if (i % 2) { const code = p.startsWith('`'); parent.append(el(code ? 'code' : 'strong', '', p.slice(code ? 1 : 2, code ? -1 : -2))); }
      else parent.append(document.createTextNode(p));
    });
  }
  function renderRich(box, text) {
    box.replaceChildren();
    text.split(FENCE_RE).forEach((seg, i) => {
      if (i % 2) { box.append(el('pre', '', seg.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim())); return; }
      const parts = seg.split(MATH_RE);
      parts.forEach((p, j) => {
        if (j % 2 === 0) {
          const nextDisp = parts[j + 1] && /^(\$\$|\\\[)/.test(parts[j + 1]), prevDisp = parts[j - 1] && /^(\$\$|\\\[)/.test(parts[j - 1]);
          if (nextDisp) p = p.replace(/\n$/, ''); if (prevDisp) p = p.replace(/^\n/, '');
          if (p) inlineMd(box, p); return;
        }
        const display = p.startsWith('$$') || p.startsWith('\\[');
        const tex = p.replace(/^\$\$|\$\$$/g, '').replace(/^\\\[|\\\]$/g, '').replace(/^\\\(|\\\)$/g, '').replace(/^\$|\$$/g, '').trim();
        const span = el(display ? 'div' : 'span', display ? 'ibd-math ibd-math-display' : 'ibd-math');
        try { span.innerHTML = brain ? brain.texToHtml(tex) : ''; if (!brain) span.textContent = p; } catch { span.textContent = p; }
        span.title = tex;
        box.append(span);
      });
    });
  }
  function latexOf(reply) {
    const blocks = [...reply.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1].trim());
    const maths = reply.split(FENCE_RE).filter((_, i) => i % 2 === 0).join('').split(MATH_RE).filter((_, j) => j % 2).map((m) => m.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '').trim());
    if (maths.length) return maths.join('\n');
    return blocks.length ? blocks.join('\n\n') : reply;
  }
  const TEX_ESC = { '\\': '\\textbackslash{}', '&': '\\&', '%': '\\%', '#': '\\#', '_': '\\_', '{': '\\{', '}': '\\}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}' };
  function toTex(reply) {
    const body = reply.split(FENCE_RE).map((seg, i) => {
      if (i % 2) return '\\begin{verbatim}\n' + seg.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim() + '\n\\end{verbatim}\n';
      return seg.replace(/\*\*/g, '').split(MATH_RE).map((p, j) => (j % 2 ? p : p.replace(/[\\&%#_{}~^]/g, (c) => TEX_ESC[c]))).join('');
    }).join('');
    return '\\documentclass{article}\n\\usepackage{amsmath,amssymb}\n% For Tamil text compile with XeLaTeX and add:\n% \\usepackage{fontspec}\\setmainfont{Noto Sans Tamil}\n\\begin{document}\n' + body + '\n\\end{document}\n';
  }
  function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  function addActions(wrap, reply) {
    const row = el('div', 'ibd-msg-actions');
    const mk = (label, fn) => { const b = el('button', 'ibd-chip', label); b.type = 'button'; b.addEventListener('click', fn); row.append(b); return b; };
    const copy = mk('Copy LaTeX', async () => { try { await navigator.clipboard.writeText(latexOf(reply)); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy LaTeX'; }, 1500); } catch { showError('Copy was blocked by the browser.'); } });
    mk('.tex file', () => download('ibd-bot-answer.tex', new Blob([toTex(reply)], { type: 'application/x-tex' })));
    mk('Word', () => { try { download('ibd-bot-answer.docx', new Blob([brain.makeDocx('IBD Bot answer', reply)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })); } catch (e) { showError('Word export failed: ' + (e && e.message ? e.message : 'unknown error')); } });
    wrap.append(row);
  }

  // ---------- chat DOM ----------
  const toBottom = () => { chat.scrollTop = chat.scrollHeight; };
  function addMsg(role, text, final) {
    if (welcome) welcome.hidden = true;
    const wrap = el('div', 'ibd-msg ibd-msg-' + role);
    wrap.append(el('div', 'ibd-msg-who', role === 'user' ? 'YOU' : 'IBD BOT'));
    const body = el('div', 'ibd-msg-body', text);
    wrap.append(body); chat.append(wrap);
    if (final && role === 'bot') { renderRich(body, text); addActions(wrap, text); }
    toBottom();
    return { wrap, body };
  }
  function showError(msg) { if (welcome) welcome.hidden = true; chat.append(el('div', 'ibd-err', msg)); toBottom(); }
  function resetChat() { chat.querySelectorAll('.ibd-msg, .ibd-err').forEach((n) => n.remove()); if (welcome) welcome.hidden = false; }
  function restoreChat() { history.forEach((m) => addMsg(m.role === 'user' ? 'user' : 'bot', m.content, true)); }
  function renderAttach() {
    fileLabel.replaceChildren();
    if (!pending.length) { fileLabel.textContent = 'Plain text / CSV files only. Images, PDF, Word and Excel cannot be read.'; return; }
    pending.forEach((a, i) => { const b = el('button', 'ibd-chip', a.name + ' \u00d7'); b.type = 'button'; b.addEventListener('click', () => { pending.splice(i, 1); renderAttach(); }); fileLabel.append(b, document.createTextNode(' ')); });
  }
  fileInput.addEventListener('change', async () => {
    for (const f of fileInput.files) {
      try {
        if (f.type.startsWith('image/')) showError(f.name + ': the built-in engine cannot read images. Type the equation instead (for example: integrate x^2 e^x).');
        else if (/\.(pdf|docx?|xlsx?)$/i.test(f.name)) showError(f.name + ': PDF, Word and Excel cannot be read. Save it as plain text or CSV.');
        else { let t = await f.text(); if (t.length > MAX_FILE_CHARS) t = t.slice(0, MAX_FILE_CHARS) + '\n[truncated]'; pending.push({ name: f.name, text: t }); }
      } catch { showError('Could not read ' + f.name + '.'); }
    }
    fileInput.value = ''; renderAttach();
  });

  // ---------- speech (browser features, optional) ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  if (!SR) { mic.disabled = true; voiceBtn.disabled = true; mic.title = 'Speech recognition is not supported in this browser. Use Chrome.'; }
  function speak(text) {
    if (!synth) { if (voiceMode) startListening(); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(FENCE_RE, ' ').replace(MATH_RE, ' equation ').replace(/\*\*/g, '').slice(0, 2500));
    u.lang = cfg.lang; u.onend = () => { if (voiceMode) startListening(); };
    synth.speak(u);
  }
  function startListening() {
    if (!SR || listening || busy) return;
    if (synth) synth.cancel();
    rec = new SR(); rec.lang = cfg.lang; rec.interimResults = true; rec.continuous = false;
    const base = input.value ? input.value + ' ' : ''; let finalText = '';
    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) { const t = ev.results[i][0].transcript; if (ev.results[i].isFinal) finalText += t; else interim += t; }
      input.value = base + finalText + interim;
    };
    rec.onerror = (ev) => {
      listening = false; mic.classList.remove('on');
      if (ev.error === 'not-allowed') { voiceMode = false; voiceBtn.classList.remove('on'); voiceBtn.textContent = 'Voice chat: off'; showError('Microphone permission was denied. Allow it in the browser site settings.'); }
      else if (ev.error !== 'no-speech' && ev.error !== 'aborted') showError('Voice error: ' + ev.error);
    };
    rec.onend = () => { listening = false; mic.classList.remove('on'); if (voiceMode && input.value.trim()) submit(); else if (voiceMode && !busy) setTimeout(startListening, 400); };
    try { rec.start(); listening = true; mic.classList.add('on'); } catch { listening = false; }
  }
  mic.addEventListener('click', () => { if (listening && rec) rec.stop(); else startListening(); });
  voiceBtn.addEventListener('click', () => {
    voiceMode = !voiceMode; voiceBtn.classList.toggle('on', voiceMode); voiceBtn.textContent = 'Voice chat: ' + (voiceMode ? 'on' : 'off');
    if (voiceMode) startListening(); else { if (rec && listening) rec.abort(); if (synth) synth.cancel(); }
  });
  langSel.addEventListener('change', () => { cfg.lang = langSel.value; store.set('ibd_site_cfg', cfg); if (rec) rec.lang = cfg.lang; });

  // ---------- thinking panel ----------
  function thinkBox() {
    const d = el('details', 'ibd-think'); d.open = true;
    const sum = el('summary', '', 'Thinking\u2026'); d.append(sum);
    const ol = el('ol'); d.append(ol);
    return { d, sum, ol };
  }
  function addStep(ol, step) { const li = el('li'); li.append(el('b', '', step[0]), document.createTextNode(' ' + step[1])); ol.append(li); }

  // ---------- sending ----------
  async function submit() {
    if (busy) { skip = true; return; }
    if (!brain) { showError('The engine is still starting. Please wait a moment.'); return; }
    const text = input.value.trim();
    if (!text && !pending.length) return;
    const files = pending.slice();
    let body = text, shown = text;
    files.forEach((f) => { body += '\n\n[Attached file: ' + f.name + ']\n' + f.text; shown += '\n[attached: ' + f.name + ']'; });
    input.value = ''; input.style.height = 'auto'; pending = []; renderAttach();
    addMsg('user', shown.trim());
    const out = addMsg('bot', '');
    const tb = thinkBox(); out.wrap.insertBefore(tb.d, out.body);
    busy = true; skip = false; send.textContent = '\u25A0'; send.setAttribute('aria-label', 'Skip animation');
    let r;
    try { r = brain.think(body, ctx); }
    catch (err) { out.wrap.remove(); showError('Engine error: ' + (err && err.message ? err.message : 'unknown')); busy = false; send.textContent = '\u2191'; send.setAttribute('aria-label', 'Send message'); return; }
    const per = Math.max(30, Math.min(140, 1100 / Math.max(1, r.trace.length)));
    for (const st of r.trace) { addStep(tb.ol, st); toBottom(); if (!skip) await sleep(per); }
    tb.sum.textContent = 'Thinking \u00B7 ' + r.trace.length + ' steps \u00B7 ' + r.ms + ' ms';
    tb.d.open = false;
    renderRich(out.body, r.answer);
    const badge = el('span', 'ibd-conf ibd-conf-' + r.conf, r.confLabel || ''); if (r.confLabel) out.wrap.insertBefore(badge, out.body.nextSibling);
    addActions(out.wrap, r.answer); toBottom();
    history.push({ role: 'user', content: shown.trim() }, { role: 'assistant', content: r.answer });
    history = history.slice(-40); store.set('ibd_site_chat', history);
    busy = false; send.textContent = '\u2191'; send.setAttribute('aria-label', 'Send message');
    if (voiceMode) speak(r.answer);
  }

  // ---------- wiring ----------
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 150) + 'px'; });
  root.querySelectorAll('[data-prompt]').forEach((button) => {
    button.addEventListener('click', () => { input.value = button.getAttribute('data-prompt') || ''; input.focus(); input.dispatchEvent(new Event('input', { bubbles: true })); });
  });
  const askCapacity = () => { input.value = 'capacity'; submit(); };
  root.querySelectorAll('[data-capacity]').forEach((b) => b.addEventListener('click', askCapacity));
  const newChat = () => {
    history = []; store.set('ibd_site_chat', history); pending = []; renderAttach(); resetChat();
    if (synth) synth.cancel();
    input.value = ''; input.style.height = 'auto'; input.focus();
  };
  $('#ibd-new-chat').addEventListener('click', newChat);
  $('#ibd-new-chat-mobile').addEventListener('click', newChat);
  $('#ibd-composer').addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });

  // ---------- start ----------
  langSel.value = cfg.lang;
  send.disabled = true;
  setState('loading', 'Starting built-in engine\u2026', 'Loading ibd-brain.js from this site');
  (async function start() {
    try {
      if (!window.IBDBrain) await loadScript('ibd-brain.js');
      brain = window.IBDBrain;
      restoreChat();
      await sleep(30);
      const st = brain.selfTest(); const cap = brain.capacity();
      const ok = st.failed.length === 0;
      setState(ok ? 'ready' : 'error', ok ? 'Built-in engine ready' : 'Engine ready, ' + st.failed.length + ' self-check(s) failed',
        cap.modules.length + ' modules \u00B7 self-test ' + st.passed + '/' + st.total + ' \u00B7 runs fully in this page');
      loadMsg.textContent = ok ? 'All ' + st.total + ' internal checks passed in ' + st.ms + ' ms.' : 'Failed checks: ' + st.failed.join(', ');
      send.disabled = false;
    } catch (err) {
      setState('error', 'Engine file missing', 'Upload ibd-brain.js next to ibd-bot.js');
      showError('Could not load ibd-brain.js (' + (err && err.message ? err.message : 'error') + '). Upload it to the same folder as ibd-bot.js and reload.');
    }
  })();
})();
