/**
 * Stub: LaTeX formula to PNG rendering.
 *
 * TODO: implement with KaTeX + canvas or headless browser.
 * Currently returns null so the caller falls back to Unicode plain text.
 */

export async function renderLatexToPng(
  _latex: string,
  _options?: { scale?: number },
): Promise<{ buffer: Buffer } | null> {
  return null;
}
