IBD Bot - built-in thinking engine (v1.0)
==========================================

WHAT CHANGED
- The bot no longer loads any AI model. No WebLLM, no download, no API key, no CDN script.
- A new file, ibd-brain.js, is the "thinking engine". It is plain JavaScript with the data inside it
  (118 elements taken from your data.js, constants, formulas, notes). Nothing is sent anywhere.
- The old "On-device model" and "Fast online" modes were REMOVED. They contradict "100% inside the source",
  and your site's Content-Security-Policy (script-src 'self', connect-src 'self') would block them anyway.
  They are still in your old IBD-Bot-Engine-Integration zip if you ever want them back.
- KaTeX and the Word-export library (both loaded from a CDN before) were replaced by renderers
  written inside the files. The page now makes no request to any outside server for the bot.

FILES (put all of them in the SAME folder as your other site files, i.e. the repo root)
  ibd-brain.js        NEW  the engine
  ibd-bot.js          the page logic (replaces the old one)
  ibd-bot.css         styles (replaces the old one)
  ibd-bot-body.html   page body (replaces the old one)
  IBDBot.html         NEW  page wrapper, same layout/CSP/header/footer as Ptable.html
  nav.html            adds the "IBD Bot" menu link (replaces your nav.html; only one line added)

INSTALL FROM A PHONE (GitHub Pages)
1. Open the science repository on github.com in Chrome.
2. Add file -> Upload files. Select the 6 files above, commit.
   (If GitHub says a file already exists, uploading with the same name replaces it.)
3. Wait about a minute, open science.qbcd.in/IBDBot.html. The status card should say
   "Built-in engine ready - 14 modules - self-test 39/39".
If it says "Engine file missing", ibd-brain.js is not in the same folder as ibd-bot.js.
Hard-refresh the page after uploading (browsers cache old script files).

HOW TO ASK "CAPACITY"
Type  capacity  (or  what can you do) or press "Show full capacity". The answer is built from live counts
inside the engine and includes a fresh self-test result.

WHAT IT CAN DO (14 modules)
  Differentiation (with rules used), integration (table rules + by parts, definite integrals, derivations of
  standard results), equation solving (polynomials up to degree 4, any f(x)=g(x) numerically, linear systems up
  to 4 unknowns), calculator, unit conversion (incl. Oe<->A/m and photon nm<->eV<->THz<->cm^-1), molar mass and
  composition, moles/grams/molecules, solution preparation, pH of strong acids/bases, balancing equations,
  limiting reagent and yield, periodic-table lookup, 23 constants, 44 physics/chemistry formulas
  (Bragg, Scherrer, photon energy, gas law, decay, telescope ...), statistics and linear fit, CSV summary,
  basic English proof-reading, 52 science notes (8 also in Tamil).

HOW IT "THINKS" (open the Thinking line under any answer)
  understand -> plan (which modules fit, with scores) -> compute -> VERIFY -> answer.
  Verification is real: roots are substituted back, integrals are differentiated numerically, atoms are counted,
  conversions are reversed, masses are balanced. The badge shows how far each result was checked.

LIMITS (it is NOT a language model)
- It cannot chat freely, write essays or answer topics outside its notes; it says so instead of guessing.
- Integration covers the rule table; improper/singular integrals are refused, not guessed.
- Tamil: understands Tamil greetings and Tamil keywords for 8 notes; no Tamil grammar checking.
- Cannot read images, PDF, Word or Excel; plain text/CSV only.
- Voice input/output uses the browser's own speech features (Chrome's speech recognition may use Google's
  service). The engine itself never sends anything.
- Your site's style.css refers to a /fonts/ folder that is not in the zip; the browser console shows font
  warnings for that. This existed before and is unrelated to the bot.

TESTED
- 39 built-in self-checks pass; 4000 random/hostile inputs: no crash, no hang (slowest 0.19 s).
- Real Chromium (headless) on your site's files with the site's strict CSP: engine loads, answers render,
  Word (.docx opens in python-docx) and .tex downloads work, chat survives reload, phone width has no overflow.
- NOT tested: a real Android Chrome, microphone and speech output, GitHub Pages itself.
