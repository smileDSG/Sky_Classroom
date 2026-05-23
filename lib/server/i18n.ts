/**
 * Server-side i18n module — direct JSON imports, no React dependency.
 * Used by API Routes to translate error messages and AI prompts.
 */

import zhCN from '@/lib/i18n/locales/zh-CN.json';
import enUS from '@/lib/i18n/locales/en-US.json';
import jaJP from '@/lib/i18n/locales/ja-JP.json';
import zhTW from '@/lib/i18n/locales/zh-TW.json';
import ruRU from '@/lib/i18n/locales/ru-RU.json';
import arSA from '@/lib/i18n/locales/ar-SA.json';

const locales: Record<string, Record<string, Record<string, unknown>>> = {
  'zh-CN': zhCN as unknown as Record<string, Record<string, unknown>>,
  'en-US': enUS as unknown as Record<string, Record<string, unknown>>,
  'ja-JP': jaJP as unknown as Record<string, Record<string, unknown>>,
  'zh-TW': zhTW as unknown as Record<string, Record<string, unknown>>,
  'ru-RU': ruRU as unknown as Record<string, Record<string, unknown>>,
  'ar-SA': arSA as unknown as Record<string, Record<string, unknown>>,
};

function resolveKey(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : '';
}

export function getServerTranslation(
  locale: string,
  key: string,
  params?: Record<string, string | number>,
): string {
  const lang = locale in locales ? locale : 'zh-CN';
  let value =
    resolveKey(locales[lang] as Record<string, unknown>, key) ||
    resolveKey(locales['zh-CN'] as Record<string, unknown>, key) ||
    key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
    }
  }
  return value;
}

const languageNames: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en-US': 'English',
  'ja-JP': '日本語',
  'ru-RU': 'Русский',
  'ar-SA': 'العربية',
};

export function getLanguageDirective(locale: string): string {
  const name = languageNames[locale] || languageNames['zh-CN'];
  return `You must respond in ${name}. All your replies must be in ${name}.`;
}
