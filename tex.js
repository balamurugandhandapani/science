/* ==============================
   tex.js - LaTeX typesetting for the whole site
   Any element with a data-tex attribute is rendered with KaTeX
   (self-hosted in /katex, no CDN, no external request).
     data-tex="E=\dfrac{hc}{\lambda}"   the LaTeX source
     data-display="block"               centred equation (default: inline)
   renderTeX(root) can be called again after new content is inserted.
============================== */
(function () {
  function renderTeX(root) {
    root = root || document;
    if (typeof katex === 'undefined') return;
    root.querySelectorAll('[data-tex]').forEach(function (el) {
      var src = el.getAttribute('data-tex');
      if (el.getAttribute('data-tex-done') === src) return;
      try {
        katex.render(src, el, {
          displayMode: el.getAttribute('data-display') === 'block',
          throwOnError: false,
          strict: false,
          trust: false,
          output: 'htmlAndMathml'
        });
        el.setAttribute('data-tex-done', src);
      } catch (e) {
        el.textContent = src;
      }
    });
  }
  window.renderTeX = renderTeX;
  renderTeX(document);
})();
