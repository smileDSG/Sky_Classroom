/**
 * Unicode-range heuristic language detection.
 *
 * Fast client-side detection for six major languages.
 * No network call needed — runs in ~0.1ms for typical selected text.
 */

/** Supported language codes (matches translate-agent langLabels) */
export type DetectLang = 'zh' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'auto';

/** Human-readable labels */
export const LANG_LABELS: Record<DetectLang, string> = {
  auto: '自动检测',
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
};

/** Languages the user might reasonably want as translation targets */
export const TARGET_LANGS: DetectLang[] = ['zh', 'en', 'ja', 'ko', 'fr', 'de'];

// ── Unicode ranges ─────────────────────────────────────────────────

const CJK_IDEOGRAPHS = /[一-鿿㐀-䶿豈-﫿]/;
const HIRAGANA = /[぀-ゟ]/;
const KATAKANA = /[゠-ヿ･-ﾟ]/;
const HANGUL = /[가-힯ᄀ-ᇿ㄰-㆏]/;
const CYRILLIC = /[Ѐ-ӿԀ-ԯ]/;
const LATIN = /[a-zA-Z]/;
const FRENCH_SPECIFIC = /[éèêëàâçùûîïôœæÉÈÊËÀÂÇÙÛÎÏÔŒÆ]/;
const GERMAN_SPECIFIC = /[äöüßÄÖÜẞ]/;

/**
 * Detect the most likely language of `text`.
 *
 * Heuristic: count characters in each Unicode range and pick the winner.
 * For Latin-script text, French/German-specific diacritics break the tie.
 */
export function detectLanguage(text: string): DetectLang {
  const sample = text.slice(0, 2000); // first 2k chars is enough
  let cjk = 0;
  let hiragana = 0;
  let katakana = 0;
  let hangul = 0;
  let cyrillic = 0;
  let latin = 0;
  let french = 0;
  let german = 0;

  for (const ch of sample) {
    if (CJK_IDEOGRAPHS.test(ch)) cjk++;
    else if (HIRAGANA.test(ch)) hiragana++;
    else if (KATAKANA.test(ch)) katakana++;
    else if (HANGUL.test(ch)) hangul++;
    else if (CYRILLIC.test(ch)) cyrillic++;
    if (LATIN.test(ch)) latin++;
    if (FRENCH_SPECIFIC.test(ch)) french++;
    if (GERMAN_SPECIFIC.test(ch)) german++;
  }

  // Japanese = CJK + kana (hiragana/katakana strongly indicate Japanese)
  if (hiragana > 0 || katakana > 0) return 'ja';

  // Korean = Hangul
  if (hangul > cjk && hangul > latin) return 'ko';

  // Chinese = significant CJK presence (at least 15% of sampled chars or 5+ chars)
  if (cjk > 4 || (sample.length > 0 && cjk / sample.length >= 0.15)) return 'zh';

  // Cyrillic = Russian (we map to 'auto' since not in target list)
  if (cyrillic > latin) return 'auto';

  // Latin-script languages — check diacritic signals
  if (latin > 0) {
    if (french > german && french > 0) return 'fr';
    if (german > 0) return 'de';
    return 'en'; // default Latin → English
  }

  return 'auto';
}

/** Quick check: does the text contain characters from a non-Latin script? */
export function isNonLatin(text: string): boolean {
  const sample = text.slice(0, 200);
  return CJK_IDEOGRAPHS.test(sample)
    || HIRAGANA.test(sample)
    || KATAKANA.test(sample)
    || HANGUL.test(sample)
    || CYRILLIC.test(sample);
}
