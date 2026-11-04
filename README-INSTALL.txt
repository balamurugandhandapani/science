IBD BOT - BODY INTEGRATION WITH AI ENGINE

FILES
- ibd-bot-body.html : body content only (your site's header, nav, footer, style.css and common.js are untouched)
- ibd-bot.css       : styles scoped under #ibd-bot
- ibd-bot.js        : interface wiring AND the on-device AI engine

INSTALL (same as before)
1. Upload the three files next to index.html / Ptable.html.
2. Create IBDBot.html using your shared page wrapper (header.html, nav.html, footer.html) and include ibd-bot-body.html.
3. Add to the page head / end of body:
      <link rel="stylesheet" href="ibd-bot.css">
      <script src="ibd-bot.js" defer></script>
4. Add <a href="IBDBot.html">IBD Bot</a> to nav.html.

WHAT THE ENGINE DOES
- On page open it loads an open-source model into the browser using WebLLM (WebGPU). Smallest suitable model is
  chosen by default (Qwen2.5-0.5B if available). First visit downloads several hundred MB; the browser keeps it.
- Send is enabled only after the model reports ready. No fake replies.
- Streaming chat, Stop button, history saved on the device, text-file and image attachments, microphone and
  spoken replies (Tamil / English), LaTeX display (KaTeX), Copy LaTeX, .tex file and Word export.
- Equation image to LaTeX uses a large vision model (about 4 GB memory); most phones cannot run it.

REQUIREMENTS / LIMITS
- Chrome (or another browser) with WebGPU. Open the real site URL, not a dashboard preview frame.
- The engine (esm.run), KaTeX (cdnjs) and the model files (Hugging Face) are fetched from public servers the
  first time. Model files are NOT bundled in this package.
- Not built yet: PDF/Word/Excel reading, tool-verified maths, offline caching of the app, self-hosted model files.
- Small models make mistakes in maths, chemistry and Tamil. Verify important results.
- Tested on a local server in headless Chromium with a stand-in engine (UI wiring only). The real model download and WebGPU inference were NOT tested.
