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
3. Wait about a minute, open www.balamurugandhandapani.in/IBDBot.html. The status card should say
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


=== v1.1  SKILLS PACK, BATCH 1 (skills 1-25 of 350) ===
NEW FILE: ibd-skills.js  (upload beside ibd-brain.js). CHANGED: ibd-brain.js, IBDBot.html.
- Greeting now starts: "வணக்கம் I am IBD Bot Assistant".
- Skills 1-25: research planning (1-10), literature review (11-20), first writing skills (21-25).
- Language assistant: English, Tamil and Thanglish spelling/grammar correction; formal letter formatter.
- Self-test: 45/45 pass. Skills are template/rule based and invent no papers, DOIs or data.
- Next batch: skills 26-50. Send the physics books (as text) before the physics module (skills 36-50).

=== v1.1  SKILLS PACK, BATCH 2 (skills 26-50 of 350) ===
NEW FILE: ibd-skills2.js (upload beside ibd-skills.js). CHANGED: IBDBot.html (loads it), README-INSTALL.txt.
- 26-35 scientific writing: review paragraph, methods, procedure, derivation, results, conclusion, future scope, acknowledgement, language refinement, academic grammar.
- 36-50 physics/maths: equation plan, identity check (numeric), dimensional analysis (real), unit conversion and calculation (engine), parameter identification, model plan, derivation (engine), interpretation, error propagation (real), uncertainty (Type A, Student t), statistics, experimental validation, theory vs experiment, assumption check.
- Self-test 51/51. Physics-book notes are NOT yet added (books not received).


=== PHYSICS TOOLS PAGE (new) ===
NEW FILES: Physics.html, physics-body.html, physics.js
CHANGED:   nav.html (adds "Physics Tools" link), style.css (physics block appended at the end), sitemap.xml
Tabs: Photon Energy, Bragg's Law, Scherrer Size, Projectile Motion, Ohm's Law (+ resistors),
      Unit Converter, Constants. Same layout/CSP/header/footer as the other pages; no external requests.

=== PHYSICS TOOLS: DATA SOURCES (verified 16 Nov 2026) ===
- Fundamental constants: 2022 CODATA recommended values (NIST SP 961 / SP 959), the latest release.
  Exact SI-2019 constants (c, h, e, kB, NA) and the values derived from them (R, F, sigma, hbar, hc) are exact.
  Measured values (G, eps0, mu0, me, mp, mn, u, alpha, Rinf, a0, muB) were checked digit-by-digit against NIST.
- X-ray lines: Bearden (1967), Rev. Mod. Phys. 39, 78 (Cu Ka1 1.540562, Ka2 1.544390; Mo Ka1 0.709300, Ka2 0.713590;
  Co Ka1 1.788965, Ka2 1.792850). Weighted means Cu 1.541838, Co 1.790260, Cr 2.291002 follow NIST Tech. Note 461.
- Unit factors: exact by definition (inch, foot, pound, atm, calorie 4.184, kWh, erg) or conventional (mmHg, psi, Oe).
- Gravity: standard g = 9.80665 m/s2 (exact); Moon 1.62 and Mars 3.73 m/s2 from the NASA Planetary Fact Sheets.
- Spectral-region boundaries (X-ray / UV / visible 380-750 nm / IR / microwave / radio) are conventional, not exact.


=== LaTeX FORMULAS (KaTeX, self-hosted) ===
NEW FILES/FOLDER: katex/ (katex.min.js, katex.min.css, fonts/, LICENSE), tex.js
CHANGED: Physics.html, Stoichiometry.html (load KaTeX; CSP font-src now also allows 'self' so the KaTeX fonts load),
         physics-body.html, physics.js, stoich-body.html, stoich.js, style.css, THIRD-PARTY-NOTICES.md
- Every formula box, formula inside a note, result label/value, unit and the constants table is real LaTeX.
- To add a formula anywhere: <span data-tex="E=\dfrac{hc}{\lambda}" data-display="block"></span>
  (omit data-display for inline). After inserting new HTML with JavaScript, call renderTeX(element).
- Upload the whole katex/ folder (including katex/fonts/) or the formulas will not appear.
- The 404 for /fonts/Poppins-*.ttf and /fonts/IBMPlexMono-*.ttf in the browser console existed before; those font
  files were never in the zip (the site falls back to the Google Fonts link).


=== PHYSICS SIMULATIONS PAGE (new) ===
NEW FILES: Simulations.html, sims-body.html, sims.js   CHANGED: nav.html, sitemap.xml, style.css
Pendulum lab (RK4, exact AGM period), double-slit interference, photoelectric effect, Bragg diffraction.
Original code, inspired by the PhET approach; no PhET code, art or branding is used (credit line is on the page).
Work functions: HyperPhysics table (CRC Handbook data), typical polycrystalline values.

--- Simulations page: six more labs added (now 10 tabs) ---
NEW FILE: sims2.js (loaded after sims.js; shares helpers through window.SIMUI). CHANGED: sims-body.html, Simulations.html
Projectile + air drag (RK4, quadratic drag), mass-spring (RK4), radioactive decay (stochastic vs expected),
blackbody spectrum (Planck, Wien, Stefan-Boltzmann, Rayleigh-Jeans), hydrogen atom (Bohr, reduced-mass Rydberg constant),
DC circuit (series / parallel). Constants: exact SI-2019 and CODATA 2022. All code original; inspired by PhET's topics only.

=== CONSTANTS TABLE: full NIST 2022 CODATA chart (updated) ===
Physics.html > Constants tab now lists ALL 114 values printed on the CODATA 2022 wall chart (NIST SP 961, May 2024)
plus the two SI constants that appear only on the wallet card (NIST SP 959): 133Cs hyperfine frequency and luminous efficacy.
Grouped into 11 categories (+ 4 clearly-marked extra reference values: g_n, atm, hc in eV nm, Cu Ka1 wavelength).
Verified: every value was matched character-by-character against the text of the two NIST PDFs (114/114 found, and every
number printed on the charts is in the table), the 23 exact/derived values were recomputed from h, e, k, NA, c, and the
11 constants used inside the calculators/simulations were confirmed equal to the chart. Data lives in physics.js (CONST_RAW).

=== SIMULATIONS PAGE: coloured gallery (updated) ===
NEW FILE: gallery.js (loaded last on Simulations.html). CHANGED: sims-body.html (tab bar replaced by the gallery), Simulations.html, style.css
Ten coloured boxes, each with a live animated preview; click one to open that simulation under a banner in the same colours
(formula box, sliders, buttons and result highlights are tinted to match). Features: category filter chips, back / previous / next buttons,
deep links (Simulations.html#bb opens Blackbody), browser Back button works, running simulations pause when you leave them,
static previews for visitors who prefer reduced motion. To add a simulation: add a panel in sims-body.html and an entry + preview in gallery.js.
