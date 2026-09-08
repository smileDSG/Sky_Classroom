/**
 * Interactive HTML Post-Processor
 *
 * Ported from Python's PostProcessor class (learn-your-way/concept_to_html.py:287-385)
 *
 * Handles:
 * - LaTeX delimiter conversion ($$...$$ -> \[...\], $...$ -> \(...\))
 * - KaTeX CSS/JS injection with auto-render and MutationObserver
 * - Script tag protection during LaTeX conversion
 */

/**
 * Main entry point: post-process generated interactive HTML
 * Converts LaTeX delimiters and injects KaTeX rendering resources.
 */
export function postProcessInteractiveHtml(html: string): string {
  // Convert LaTeX delimiters while protecting script tags
  let processed = convertLatexDelimiters(html);

  // Inject a layout baseline so widgets fill their panel without horizontal
  // overflow/truncation (a common cause of the "too flat / chart squeezed" look).
  processed = injectLayoutBaseline(processed);

  // Inject KaTeX resources if not already present
  if (!processed.toLowerCase().includes('katex')) {
    processed = injectKatex(processed);
  }

  return processed;
}

/**
 * Inject a minimal, safe layout reset + an adaptive proportion fixer into the widget
 * document. The fixer runs at runtime inside the iframe and, without rewriting the
 * widget's markup, keeps the visualization dominant:
 *   - if the control/parameter column is wider than the visualization column, it is
 *     squeezed to <=42% and the visualization gets the remaining width;
 *   - any overflowing fixed-size box is constrained;
 *   - nothing is touched when the layout is already balanced.
 * Idempotent: guarded by a fixed style/script id so re-processing existing HTML is safe.
 */
function injectLayoutBaseline(html: string): string {
  const hasBaseline = html.includes('id="sky-classroom-widget-baseline"');
  const hasFixer = html.includes('id="sky-classroom-widget-fixer"');
  if (hasBaseline && hasFixer) return html;

  const parts: string[] = [];
  if (!hasBaseline) {
    parts.push(`
<style id="sky-classroom-widget-baseline">
  html, body { height: 100%; margin: 0; padding: 0; box-sizing: border-box; }
  *, *::before, *::after { box-sizing: border-box; }
  html { overflow-x: hidden; }
  body { overflow-x: hidden; }
  canvas, svg, img, video { max-width: 100%; }
  .sky-root, [data-sky-root] { width: 100%; height: 100%; min-height: 0; }
</style>`);
  }
  if (!hasFixer) {
    parts.push(`
<script id="sky-classroom-widget-fixer">
(function () {
  try {
    function hasControl(n) {
      return !!(n && n.querySelector && n.querySelector('input, select, button, textarea'));
    }
    function hasVisual(n) {
      return !!(n && n.querySelector && n.querySelector('canvas, svg, [class*="chart"], [id*="canvas"], [class*="plot"], [class*="graph"]'));
    }
    function isRowFlex(n) {
      if (!n || !n.children || n.children.length < 2) return false;
      var cs = window.getComputedStyle(n);
      return cs.display === 'flex' && cs.flexDirection === 'row';
    }
    function fixPair(container) {
      var kids = Array.prototype.slice.call(container.children);
      for (var i = 0; i < kids.length - 1; i++) {
        var a = kids[i], b = kids[i + 1];
        var aC = hasControl(a), aV = hasVisual(a);
        var bC = hasControl(b), bV = hasVisual(b);
        if (!((aC && bV) || (aV && bC))) continue;
        var control = aC && !aV ? a : b;
        var visual = control === a ? b : a;
        var cRect = control.getBoundingClientRect();
        var vRect = visual.getBoundingClientRect();
        var cW = cRect && cRect.width ? cRect.width : 0;
        var vW = vRect && vRect.width ? vRect.width : 0;
        var rootW = container.getBoundingClientRect().width || 1;
        if (!cW || !vW) continue;
        if (cW <= vW && cW <= rootW * 0.48) continue;
        control.style.maxWidth = '42%';
        control.style.flex = '0 1 42%';
        control.style.minWidth = '0';
        visual.style.flex = '1 1 auto';
        visual.style.minWidth = '0';
      }
    }
    function walk(node) {
      if (!node || !node.children) return;
      var i;
      if (isRowFlex(node)) fixPair(node);
      for (i = 0; i < node.children.length; i++) walk(node.children[i]);
    }
    function onReady() {
      walk(document.body || document.documentElement);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady);
    } else {
      onReady();
    }
    setTimeout(onReady, 400);
    setTimeout(onReady, 1200);
  } catch (e) { /* never break the widget */ }
})();
</script>`);
  }
  const injection = parts.join('\n');

  const headCloseIdx = html.indexOf('</head>');
  if (headCloseIdx !== -1) {
    return (
      html.substring(0, headCloseIdx) + injection + '\n</head>' + html.substring(headCloseIdx + 7)
    );
  }

  const bodyCloseIdx = html.indexOf('</body>');
  if (bodyCloseIdx !== -1) {
    return (
      html.substring(0, bodyCloseIdx) + injection + '\n</body>' + html.substring(bodyCloseIdx + 7)
    );
  }

  return html + injection;
}

/**
 * Convert LaTeX delimiters while protecting <script> tags.
 *
 * - Protects script blocks from modification
 * - Converts $$...$$ to \[...\] (display math)
 * - Converts $...$ to \(...\) (inline math)
 * - Restores script blocks after conversion
 */
function convertLatexDelimiters(html: string): string {
  const scriptBlocks: string[] = [];

  // Protect script tags by replacing them with placeholders
  let processed = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    scriptBlocks.push(match);
    return `__SCRIPT_BLOCK_${scriptBlocks.length - 1}__`;
  });

  // Convert display math: $$...$$ -> \[...\]
  processed = processed.replace(/\$\$([^$]+)\$\$/g, '\\[$1\\]');

  // Convert inline math: $...$ -> \(...\)
  // Use non-greedy match and exclude newlines to avoid false positives
  processed = processed.replace(/\$([^$\n]+?)\$/g, '\\($1\\)');

  // Restore script blocks using indexOf + substring (not .replace())
  // because script content may contain $ characters that .replace()
  // would interpret as special substitution patterns.
  for (let i = 0; i < scriptBlocks.length; i++) {
    const placeholder = `__SCRIPT_BLOCK_${i}__`;
    const idx = processed.indexOf(placeholder);
    if (idx !== -1) {
      processed =
        processed.substring(0, idx) +
        scriptBlocks[i] +
        processed.substring(idx + placeholder.length);
    }
  }

  return processed;
}

/**
 * Inject KaTeX CSS, JS, auto-render, and MutationObserver before </head>.
 * Falls back to appending at end if </head> is not found.
 */
function injectKatex(html: string): string {
  const katexInjection = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function() {
    const katexOptions = {
        delimiters: [
            {left: '\\\\[', right: '\\\\]', display: true},
            {left: '\\\\(', right: '\\\\)', display: false},
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false}
        ],
        throwOnError: false,
        strict: false,
        trust: true
    };

    let renderTimeout;
    function safeRender() {
        if (renderTimeout) clearTimeout(renderTimeout);
        renderTimeout = setTimeout(() => {
            renderMathInElement(document.body, katexOptions);
        }, 100);
    }

    renderMathInElement(document.body, katexOptions);

    const observer = new MutationObserver((mutations) => {
        let shouldRender = false;
        mutations.forEach((mutation) => {
            if (mutation.target &&
                mutation.target.className &&
                typeof mutation.target.className === 'string' &&
                mutation.target.className.includes('katex')) {
                return;
            }
            shouldRender = true;
        });

        if (shouldRender) {
            safeRender();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    setInterval(() => {
        const text = document.body.innerText;
        if (text.includes('\\\\(') || text.includes('$$')) {
            safeRender();
        }
    }, 2000);
});
</script>`;

  // Use indexOf + substring instead of String.replace() because the
  // katexInjection string contains '$' characters that .replace() would
  // interpret as special substitution patterns ($$ → $, $' → post-match text).
  const headCloseIdx = html.indexOf('</head>');
  if (headCloseIdx !== -1) {
    return (
      html.substring(0, headCloseIdx) +
      katexInjection +
      '\n</head>' +
      html.substring(headCloseIdx + 7)
    );
  }

  // Fallback: inject before </body> if </head> is missing
  const bodyCloseIdx = html.indexOf('</body>');
  if (bodyCloseIdx !== -1) {
    return (
      html.substring(0, bodyCloseIdx) +
      katexInjection +
      '\n</body>' +
      html.substring(bodyCloseIdx + 7)
    );
  }

  // Last resort: append at end
  return html + katexInjection;
}
