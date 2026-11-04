/* IBD Bot: interface plus on-device AI engine (WebLLM, runs in the browser via WebGPU).
   No fake replies: Send works only after a real model has loaded.
   Runtime libraries loaded from public CDNs: WebLLM (esm.run), KaTeX (cdnjs), docx (jsDelivr, on demand). */
(() => {
  const root = document.getElementById('ibd-bot');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const $ = (s) => root.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

  const input = $('#ibd-message'), send = $('#ibd-send'), mic = $('#ibd-mic'), voiceBtn = $('#ibd-voice');
  const fileInput = $('#ibd-file-input'), fileLabel = $('#ibd-file-label');
  const status = $('#ibd-engine-status'), detail = $('#ibd-engine-detail'), statusCard = $('.ibd-status-card');
  const chat = $('#ibd-chat-content'), welcome = $('#ibd-welcome');
  const modelSel = $('#ibd-model-select'), langSel = $('#ibd-lang'), loadBtn = $('#ibd-load'), loadMsg = $('#ibd-load-msg'), modelBox = $('#ibd-model-box');
  const footNote = $('#ibd-foot-note');

  const SYSTEM = 'You are IBD Bot, a personal assistant for science students and researchers who use Tamil and English. Reply in the language the user writes in (Tamil script for Tamil). Help with grammar, writing and speaking practice in Tamil and English: correct mistakes and explain briefly. Help with physics, mathematics and chemistry, LaTeX, Microsoft Word and scientific software such as Python, MATLAB and Origin. Write every equation in LaTeX using $...$ or $$...$$. When asked for the LaTeX of an equation, put the raw LaTeX in a ```latex code block. Show steps clearly, say when you are unsure, and never invent citations, DOIs or results.';
  const IMG_PROMPT = 'Transcribe every equation in this image as LaTeX. Put the raw LaTeX in a ```latex code block, one equation per line, and add nothing else.';
  const MAX_FILE_CHARS = 6000;
  const ENGINE_URL = 'https://esm.run/@mlc-ai/web-llm';
  const KATEX_JS = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js';
  const KATEX_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css';
  const DOCX_JS = 'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js';
  const MATH_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;
  const FENCE_RE = /(```[\s\S]*?```)/g;

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  let cfg = Object.assign({ model: '', lang: 'en-IN' }, store.get('ibd_site_cfg', {}));
  let history = store.get('ibd_site_chat', []);
  let pending = [];
  let webllm = null, engine = null, loadedId = '', visionId = '';
  let loading = false, busy = false, voiceMode = false, listening = false, rec = null;

  const setState = (state, title, sub) => { statusCard.dataset.state = state; status.textContent = title; if (sub !== undefined) detail.textContent = sub; };
  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s); }); }

  // KaTeX (optional; math shows as plain LaTeX text if it cannot load)
  (function () { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = KATEX_CSS; document.head.append(l); loadScript(KATEX_JS).catch(() => {}); })();

  // ---------- rich text ----------
  function renderRich(box, text) {
    box.replaceChildren();
    text.split(FENCE_RE).forEach((seg, i) => {
      if (i % 2) { box.append(el('pre', '', seg.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim())); return; }
      seg.split(MATH_RE).forEach((p, j) => {
        if (j % 2 === 0) { if (p) box.append(document.createTextNode(p)); return; }
        const display = p.startsWith('$$') || p.startsWith('\\[');
        const tex = p.replace(/^\$\$|\$\$$/g, '').replace(/^\\\[|\\\]$/g, '').replace(/^\\\(|\\\)$/g, '').replace(/^\$|\$$/g, '').trim();
        const span = el(display ? 'div' : 'span');
        if (window.katex) { try { window.katex.render(tex, span, { displayMode: display, throwOnError: false }); } catch { span.textContent = p; } }
        else span.textContent = p;
        box.append(span);
      });
    });
  }
  function latexOf(reply) {
    const blocks = [...reply.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1].trim());
    if (blocks.length) return blocks.join('\n\n');
    const maths = reply.split(FENCE_RE).filter((_, i) => i % 2 === 0).join('').split(MATH_RE).filter((_, j) => j % 2);
    return maths.length ? maths.join('\n') : reply;
  }
  const TEX_ESC = { '\\': '\\textbackslash{}', '&': '\\&', '%': '\\%', '#': '\\#', '_': '\\_', '{': '\\{', '}': '\\}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}' };
  function toTex(reply) {
    const body = reply.split(FENCE_RE).map((seg, i) => {
      if (i % 2) return '\\begin{verbatim}\n' + seg.replace(/^```[^\n]*\n?/, '').replace(/```$/, '').trim() + '\n\\end{verbatim}\n';
      return seg.split(MATH_RE).map((p, j) => (j % 2 ? p : p.replace(/[\\&%#_{}~^]/g, (c) => TEX_ESC[c]))).join('');
    }).join('');
    return '\\documentclass{article}\n\\usepackage{amsmath,amssymb}\n% For Tamil text compile with XeLaTeX and add:\n% \\usepackage{fontspec}\\setmainfont{Noto Sans Tamil}\n\\begin{document}\n' + body + '\n\\end{document}\n';
  }
  function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  async function exportWord(reply) {
    try {
      if (!window.docx) await loadScript(DOCX_JS);
      const { Document, Packer, Paragraph, TextRun } = window.docx;
      const lines = reply.replace(/```[^\n]*\n?/g, '').split('\n');
      const doc = new Document({ sections: [{ children: lines.map((l) => new Paragraph({ children: [new TextRun(l)] })) }] });
      download('ibd-bot-answer.docx', await Packer.toBlob(doc));
    } catch (e) { showError('Word export failed: ' + (e && e.message ? e.message : 'unknown error')); }
  }
  function addActions(wrap, reply) {
    const row = el('div', 'ibd-msg-actions');
    const mk = (label, fn) => { const b = el('button', 'ibd-chip', label); b.type = 'button'; b.addEventListener('click', fn); row.append(b); return b; };
    const copy = mk('Copy LaTeX', async () => { try { await navigator.clipboard.writeText(latexOf(reply)); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy LaTeX'; }, 1500); } catch { showError('Copy was blocked by the browser.'); } });
    mk('.tex file', () => download('ibd-bot-answer.tex', new Blob([toTex(reply)], { type: 'application/x-tex' })));
    mk('Word', () => exportWord(reply));
    wrap.append(row);
  }

  // ---------- chat DOM ----------
  const toBottom = () => { chat.scrollTop = chat.scrollHeight; };
  function addMsg(role, text, final) {
    if (welcome) welcome.hidden = true;
    const wrap = el('div', 'ibd-msg ibd-msg-' + role);
    wrap.append(el('div', 'ibd-msg-who', role === 'user' ? 'YOU' : 'IBD BOT'));
    const body = el('div', 'ibd-msg-body', text);
    wrap.append(body);
    chat.append(wrap);
    if (final && role === 'bot') { renderRich(body, text); addActions(wrap, text); }
    toBottom();
    return { wrap, body };
  }
  function showError(msg) { if (welcome) welcome.hidden = true; const e = el('div', 'ibd-err', msg); chat.append(e); toBottom(); }
  function resetChat() { chat.querySelectorAll('.ibd-msg, .ibd-err').forEach((n) => n.remove()); if (welcome) welcome.hidden = false; }
  function restoreChat() { if (history.length) history.forEach((m) => addMsg(m.role === 'user' ? 'user' : 'bot', m.content, true)); }
  function renderAttach() {
    fileLabel.replaceChildren();
    if (!pending.length) { fileLabel.textContent = 'Text files and equation images. PDF, Word and Excel are not supported yet.'; return; }
    pending.forEach((a, i) => { const b = el('button', 'ibd-chip', a.name + ' \u00d7'); b.type = 'button'; b.addEventListener('click', () => { pending.splice(i, 1); renderAttach(); }); fileLabel.append(b, document.createTextNode(' ')); });
  }

  // ---------- model ----------
  const hasGPU = !!navigator.gpu;
  async function getLib() { if (!webllm) webllm = await import(ENGINE_URL); return webllm; }
  async function fillModels() {
    if (!hasGPU) { loadMsg.textContent = 'This browser has no WebGPU, so the model cannot run here. Use recent Chrome.'; loadBtn.disabled = true; return; }
    try {
      const lib = await getLib();
      const all = lib.prebuiltAppConfig.model_list;
      const v = all.find((m) => /Phi-3\.5-vision/i.test(m.model_id)) || all.find((m) => /vision|VL/i.test(m.model_id));
      visionId = v ? v.model_id : '';
      const list = all.filter((m) => m.vram_required_MB && m.vram_required_MB <= 3500 && !/embed|vision|VL/i.test(m.model_id)).sort((a, b) => a.vram_required_MB - b.vram_required_MB);
      modelSel.replaceChildren(...list.map((m) => { const o = el('option', '', m.model_id + ' (~' + Math.round(m.vram_required_MB) + ' MB)'); o.value = m.model_id; return o; }));
      const ids = list.map((m) => m.model_id);
      if (cfg.model && ids.includes(cfg.model)) modelSel.value = cfg.model;
      else {
        let pick = null;
        for (const re of [/Qwen2\.5-0\.5B-Instruct/, /Llama-3\.2-1B-Instruct/, /Qwen2\.5-1\.5B-Instruct/, /SmolLM2/]) { pick = list.find((m) => re.test(m.model_id)); if (pick) break; }
        pick = pick || list[0];
        if (pick) modelSel.value = pick.model_id;
      }
    } catch { loadMsg.textContent = 'Could not fetch the AI engine library. Check your internet connection and reload.'; loadBtn.disabled = true; setState('error', 'AI engine unavailable', 'Engine library could not be loaded'); }
  }
  async function loadModel(forceId) {
    if (loading || !hasGPU) return false;
    const id = forceId || modelSel.value;
    if (!id) { loadMsg.textContent = 'Choose a model first.'; return false; }
    if (!forceId) { cfg.model = id; store.set('ibd_site_cfg', cfg); }
    loading = true; send.disabled = true; loadBtn.disabled = true;
    setState('loading', 'Loading model…', id);
    const cb = (r) => { const pct = Math.round((r.progress || 0) * 100); loadMsg.textContent = r.text || (pct + '%'); setState('loading', 'Loading model… ' + pct + '%', id); };
    try {
      const lib = await getLib();
      if (engine) { engine.setInitProgressCallback(cb); await engine.reload(id); }
      else engine = await lib.CreateMLCEngine(id, { initProgressCallback: cb });
      loadedId = id;
      setState('ready', 'AI engine ready', id + ' · running on this device');
      loadMsg.textContent = 'Ready: ' + id + '.';
      return true;
    } catch (err) {
      engine = null; loadedId = ''; modelBox.open = true;
      const m = err && err.message ? err.message : 'unknown error';
      setState('error', 'Model failed to load', 'Open settings to try another model');
      loadMsg.textContent = /fetch/i.test(m)
        ? 'Download failed (' + m + '). Open the site directly in Chrome (not inside a preview frame), check your internet, keep the phone charging, then try a smaller model.'
        : 'Load failed: ' + m + ' (try a smaller model).';
      return false;
    } finally { loading = false; send.disabled = false; loadBtn.disabled = false; }
  }
  loadBtn.addEventListener('click', () => loadModel());
  langSel.addEventListener('change', () => { cfg.lang = langSel.value; store.set('ibd_site_cfg', cfg); if (rec) rec.lang = cfg.lang; });

  // ---------- attachments ----------
  function toDataUrl(file) {
    return new Promise((res, rej) => {
      const img = new Image(); const u = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, 1024 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('bad image')); };
      img.src = u;
    });
  }
  fileInput.addEventListener('change', async () => {
    for (const f of fileInput.files) {
      try {
        if (f.type.startsWith('image/')) { pending = pending.filter((a) => a.kind !== 'image'); pending.push({ name: f.name, kind: 'image', url: await toDataUrl(f) }); }
        else if (/\.(pdf|docx?|xlsx?)$/i.test(f.name)) showError(f.name + ': PDF, Word and Excel are not supported yet. Use plain text or an image.');
        else { let t = await f.text(); if (t.length > MAX_FILE_CHARS) t = t.slice(0, MAX_FILE_CHARS) + '\n[truncated: small models have a short memory]'; pending.push({ name: f.name, kind: 'text', text: t }); }
      } catch { showError('Could not read ' + f.name + '.'); }
    }
    fileInput.value = ''; renderAttach();
  });

  // ---------- speech ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const synth = window.speechSynthesis;
  if (!SR) { mic.disabled = true; voiceBtn.disabled = true; mic.title = 'Speech recognition is not supported in this browser. Use Chrome.'; }
  function speak(text) {
    if (!synth) { if (voiceMode) startListening(); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(FENCE_RE, ' ').replace(MATH_RE, ' equation ').slice(0, 2500));
    u.lang = cfg.lang; u.onend = () => { if (voiceMode) startListening(); };
    synth.speak(u);
  }
  function startListening() {
    if (!SR || listening || busy || loading) return;
    if (synth) synth.cancel();
    rec = new SR(); rec.lang = cfg.lang; rec.interimResults = true; rec.continuous = false;
    const base = input.value ? input.value + ' ' : '';
    let finalText = '';
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
    voiceMode = !voiceMode;
    voiceBtn.classList.toggle('on', voiceMode);
    voiceBtn.textContent = 'Voice chat: ' + (voiceMode ? 'on' : 'off');
    if (voiceMode) startListening(); else { if (rec && listening) rec.abort(); if (synth) synth.cancel(); }
  });

  // ---------- sending ----------
  async function submit() {
    if (busy) { if (engine) engine.interruptGenerate(); return; }
    if (loading) { showError('The model is still loading. Please wait until the status shows ready.'); return; }
    const text = input.value.trim();
    if (!text && !pending.length) return;
    const img = pending.find((a) => a.kind === 'image');

    if (img && loadedId !== visionId) {
      if (!visionId) { showError('No image-reading model is available in this engine version.'); return; }
      if (!window.confirm('Reading images needs a larger vision model (about 4 GB of memory and a big download). Many phones cannot run it. Switch now?')) return;
      busy = true; send.disabled = true;
      const ok = await loadModel(visionId);
      busy = false; send.disabled = false;
      if (!ok) { showError('The image model could not load. Equation-image reading usually needs a PC with a strong GPU.'); return; }
    }
    if (!engine) { showError('The model is not loaded. Open the model settings and load one.'); modelBox.open = true; voiceMode = false; voiceBtn.classList.remove('on'); voiceBtn.textContent = 'Voice chat: off'; return; }

    const files = pending.slice();
    let body = text, shown = text;
    files.filter((f) => f.kind === 'text').forEach((f) => { body += '\n\n[Attached file: ' + f.name + ']\n' + f.text; });
    files.forEach((f) => { shown += '\n[attached: ' + f.name + ']'; });
    input.value = ''; input.style.height = 'auto'; pending = []; renderAttach();
    addMsg('user', shown.trim());
    const out = addMsg('bot', 'Thinking\u2026');
    busy = true; send.textContent = '\u25A0'; send.setAttribute('aria-label', 'Stop');

    const messages = img
      ? [{ role: 'user', content: [{ type: 'text', text: body || IMG_PROMPT }, { type: 'image_url', image_url: { url: img.url } }] }]
      : [{ role: 'system', content: SYSTEM }].concat(history.slice(-6).map((m) => ({ role: m.role, content: m.content }))).concat([{ role: 'user', content: body }]);

    let reply = '';
    try {
      const stream = await engine.chat.completions.create({ messages, stream: true, temperature: 0.4, max_tokens: 1024 });
      for await (const chunk of stream) {
        const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
        if (d) { reply += d; out.body.textContent = reply; toBottom(); }
      }
      if (!reply) throw new Error('The model returned no text.');
      renderRich(out.body, reply); addActions(out.wrap, reply); toBottom();
      history.push({ role: 'user', content: shown.trim() }, { role: 'assistant', content: reply });
      store.set('ibd_site_chat', history.slice(-40));
      if (voiceMode) speak(reply);
    } catch (err) {
      if (!reply) out.wrap.remove();
      showError('Generation failed: ' + (err && err.message ? err.message : 'unknown error'));
      if (voiceMode) setTimeout(startListening, 800);
    } finally { busy = false; send.textContent = '\u2191'; send.setAttribute('aria-label', 'Send message'); }
  }

  // ---------- wiring (from the original interface) ----------
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 150) + 'px'; });
  root.querySelectorAll('[data-prompt]').forEach((button) => {
    button.addEventListener('click', () => { input.value = button.getAttribute('data-prompt') || ''; input.focus(); input.dispatchEvent(new Event('input', { bubbles: true })); });
  });
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
  restoreChat();
  send.disabled = true;
  (async function autoStart() {
    let framed = false;
    try { framed = window.self !== window.top; } catch { framed = true; }
    if (framed) showError('This page is shown inside another page (such as a hosting dashboard preview), which often blocks the model download. Open the site directly in Chrome.');
    if (!hasGPU) { setState('error', 'WebGPU not available', 'Use recent Chrome on Android or desktop'); modelBox.open = true; showError('This browser has no WebGPU, so the AI cannot run here. Open the site in recent Chrome.'); return; }
    await fillModels();
    if (modelSel.value) loadModel(); else { send.disabled = false; modelBox.open = true; }
  })();
})();
