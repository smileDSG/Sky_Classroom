/**
 * Prompt i18n — Language-specific prompt fragment overrides.
 *
 * All core templates are authored in English as the baseline.
 * This module provides per-language key-value overrides that the
 * composability engine resolves at composition time.
 *
 * Language detection: locale from i18next → match to prompt i18n keys.
 * Fallback: English (built into templates, no override needed).
 */

export type PromptI18nLocale = 'en' | 'zh' | 'ja' | 'ru';

const localeMap: Record<string, PromptI18nLocale> = {
  'zh-CN': 'zh',
  'zh-TW': 'zh',
  'en-US': 'en',
  'ja-JP': 'ja',
  'ru-RU': 'ru',
  'ar-SA': 'en', // Arabic uses English prompt baseline (no prompt-level ar yet)
};

/**
 * Resolve the prompt i18n locale from an i18next language code.
 * Returns undefined for English (no overrides needed — templates are English).
 */
export function resolvePromptLocale(appLocale?: string): PromptI18nLocale | undefined {
  if (!appLocale) return undefined;
  const mapped = localeMap[appLocale];
  if (!mapped || mapped === 'en') return undefined;
  return mapped;
}

/**
 * Per-locale prompt fragment overrides.
 * Each locale maps fragment IDs to replacement content.
 * Keys are loaded lazily to avoid bloating the bundle.
 */
const localeOverrides: Record<Exclude<PromptI18nLocale, 'en'>, () => Promise<Record<string, string>>> = {
  zh: () => import('./zh').then(m => m.zhOverrides),
  ja: () => import('./ja').then(m => m.jaOverrides),
  ru: () => import('./ru').then(m => m.ruOverrides),
};

/**
 * Get prompt fragment overrides for a given locale.
 * Returns a map of fragmentId → translatedContent, or empty object.
 */
export async function getPromptOverrides(
  locale: PromptI18nLocale,
): Promise<Record<string, string>> {
  if (locale === 'en') return {};
  const loader = localeOverrides[locale];
  if (!loader) return {};
  try {
    return await loader();
  } catch {
    return {};
  }
}
