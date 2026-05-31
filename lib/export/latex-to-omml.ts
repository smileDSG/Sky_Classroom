import temml from 'temml';
import { mml2omml } from 'mathml2omml';
import { createLogger } from '@/lib/logger';

const log = createLogger('LatexToOmml');

/**
 * Strip MathML elements unsupported by mathml2omml (e.g. `<mpadded>`),
 * replacing them with their inner content.
 */
function stripUnsupportedMathML(mathml: string): string {
  const unsupported = ['mpadded'];
  let result = mathml;
  for (const tag of unsupported) {
    result = result.replace(new RegExp(`<${tag}[^>]*>`, 'g'), '');
    result = result.replace(new RegExp(`</${tag}>`, 'g'), '');
  }
  return result;
}

/**
 * Build <a:rPr> for math runs. PowerPoint requires Cambria Math font.
 * @param szHundredths - font size in hundredths of a point (e.g. 1200 = 12pt). Omit for no sz.
 */
function buildMathRPr(szHundredths?: number): string {
  const szAttr = szHundredths ? ` sz="${szHundredths}"` : '';
  return (
    `<a:rPr lang="en-US" i="1"${szAttr}>` +
    '<a:latin typeface="Cambria Math" panose="02040503050406030204" charset="0"/>' +
    '<a:cs typeface="Cambria Math" panose="02040503050406030204" charset="0"/>' +
    '</a:rPr>'
  );
}

/**
 * Post-process OMML for PPTX compatibility:
 * 1. Strip xmlns:w (wordprocessingml is DOCX-only, not valid in PPTX)
 * 2. Strip redundant xmlns:m (already declared at <p:sld> level)
 * 3. Inject <a:rPr> with Cambria Math font (and optional sz) into <m:r> and <m:ctrlPr>
 */
function postProcessOmml(omml: string, szHundredths?: number): string {
  let result = omml;
  const rpr = buildMathRPr(szHundredths);

  // Strip DOCX-only xmlns:w and redundant xmlns:m from <m:oMath>
  result = result.replace(/ xmlns:w="[^"]*"/g, '');
  result = result.replace(/ xmlns:m="[^"]*"/g, '');

  // Strip <w:rPr> elements (WordprocessingML run properties, invalid in PPTX)
  // mathml2omml sometimes injects these even though we're targeting presentationML
  result = result.replace(/<w:rPr\b[^>]*>.*?<\/w:rPr>/gs, '');
  result = result.replace(/<w:rPr\b[^>]*\/>/g, '');

  // Insert <a:rPr> before <m:t> inside <m:r> (only if not already present)
  result = result.replace(/<m:r>(\s*)<m:t/g, `<m:r>$1${rpr}$1<m:t`);

  // Fill empty <m:ctrlPr/> with <a:rPr>
  result = result.replace(/<m:ctrlPr\/>/g, `<m:ctrlPr>${rpr}</m:ctrlPr>`);

  // Fill empty <m:ctrlPr></m:ctrlPr> with <a:rPr>
  result = result.replace(/<m:ctrlPr><\/m:ctrlPr>/g, `<m:ctrlPr>${rpr}</m:ctrlPr>`);

  return result;
}

/**
 * Pre-process LaTeX before feeding to temml.
 * Fixes common LLM output issues:
 *   - Missing ^/_ in chemical formulas (Zn2+ → Zn^{2+}, H2O → H_2O)
 *   - Unicode math symbols (∘ × ≈ ⇌ → ←) → LaTeX commands
 *   - Missing braces in scientific notation (10^37)
 */
function preprocessLatex(latex: string): string {
  let result = latex;

  // 1. Unicode → LaTeX commands
  result = result.replace(/∘/g, '\\circ');
  result = result.replace(/−/g, '-');
  result = result.replace(/×/g, '\\times');
  result = result.replace(/≈/g, '\\approx');
  result = result.replace(/⇌/g, '\\rightleftharpoons');
  result = result.replace(/→/g, '\\rightarrow');
  result = result.replace(/←/g, '\\leftarrow');
  result = result.replace(/⇔/g, '\\Leftrightarrow');

  // 2. Charge superscripts: Zn2+ → Zn^{2+}, Cu2+ → Cu^{2+}, e- → e^{-}
  //    Must NOT match H2O (no + or - after digits)
  result = result.replace(/\b([A-Z][a-z]?)(\d+)([+-])\b/g, '$1^{$2$3}');
  //    Single charge without digits: Na+ → Na^{+}, Cl- → Cl^{-}
  result = result.replace(/\b([A-Z][a-z]?)([+-])\b/g, '$1^{$2}');

  // 3. Subscripts for atomic counts: H2O → H_2O, CO2 → CO_2, MnO2 → MnO_2
  //    Skip if already wrapped in ^ or _
  result = result.replace(/\b([A-Z][a-z]?)(\d+)(?![^{]*\})/g, '$1_{$2}');

  // 4. Scientific notation: 10^37 → 10^{37}
  result = result.replace(/\b10\^(\d+)\b/g, '10^{$1}');

  return result;
}

/**
 * Convert a LaTeX string to OMML (Office Math Markup Language) XML.
 *
 * Pipeline: LaTeX → MathML (temml) → strip unsupported → OMML (mathml2omml) → inject font props
 *
 * @param latex - LaTeX math expression (without delimiters)
 * @param fontSize - Optional font size in points (e.g. 12). Applied as sz on every <a:rPr> in the OMML.
 * @returns OMML XML string (an `<m:oMath>` element), or `null` if conversion fails
 */
export function latexToOmml(latex: string, fontSize?: number): string | null {
  try {
    const processed = preprocessLatex(latex);
    const mathml = temml.renderToString(processed);
    const cleaned = stripUnsupportedMathML(mathml);
    const omml = String(mml2omml(cleaned));
    const szHundredths = fontSize ? Math.round(fontSize * 100) : undefined;
    return postProcessOmml(omml, szHundredths);
  } catch {
    log.warn(`Failed to convert: "${latex}"`);
    return null;
  }
}
