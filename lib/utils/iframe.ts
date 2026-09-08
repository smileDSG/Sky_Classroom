/**
 * Patch embedded HTML to display correctly inside an iframe.
 *
 * Injects CSS that ensures proper sizing and scrolling behavior
 * when HTML content is rendered via srcDoc in an iframe.
 */
export function patchHtmlForIframe(html: string): string {
  // Keep persisted/generated widgets resilient to a known stale helper call.
  const repairedHtml = html.replaceAll('updateLossDisplay();', 'updateInfoPanel();');
  const iframeCss = `<style data-iframe-patch>
  html, body {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }
  /* Fix min-h-screen: in iframes 100vh is the iframe height, which is correct,
     but ensure body actually fills it */
  body { min-height: 100vh; }
  /* Simulation widgets: give the canvas card the same 1rem inset as the
     control panel so their top/bottom edges line up (higher specificity than
     the widget's own #canvas-wrapper rule; no-op for widgets lacking these ids). */
  #app #canvas-wrapper { padding: 1rem; }
</style>`;

  // Insert right after <head> or at the start of the document
  const headIdx = repairedHtml.indexOf('<head>');
  if (headIdx !== -1) {
    const insertPos = headIdx + 6; // after <head>
    return repairedHtml.substring(0, insertPos) + '\n' + iframeCss + repairedHtml.substring(insertPos);
  }

  const headWithAttrs = repairedHtml.indexOf('<head ');
  if (headWithAttrs !== -1) {
    const closeAngle = repairedHtml.indexOf('>', headWithAttrs);
    if (closeAngle !== -1) {
      const insertPos = closeAngle + 1;
      return repairedHtml.substring(0, insertPos) + '\n' + iframeCss + repairedHtml.substring(insertPos);
    }
  }

  // Fallback: prepend
  return iframeCss + repairedHtml;
}
