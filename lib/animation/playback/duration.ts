/** 旁白阅读时长估算。速率与课堂 playback engine 一致：CJK ~150ms/字，非 CJK ~240ms/词。 */
export const CJK_CHAR_MS = 150;
export const LATIN_WORD_MS = 240;
export const MIN_STEP_MS = 800;

const CJK_CHAR_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/g;

/** CJK 字符占比超过阈值（默认 30%）视为中文 —— 时长估算与 TTS lang 判定共用。 */
export function isCJKDominant(text: string, threshold = 0.3): boolean {
  if (!text.length) return false;
  const cjkChars = (text.match(CJK_CHAR_RE) ?? []).length;
  return cjkChars > text.length * threshold;
}

export function estimateSpeechDurationMs(text: string, speed = 1): number {
  const trimmed = text.trim();
  // 空文本（无旁白）返回最小停留时长
  if (!trimmed) return MIN_STEP_MS;
  const cjkChars = (trimmed.match(CJK_CHAR_RE) ?? []).length;
  const rawMs = isCJKDominant(trimmed)
    ? cjkChars * CJK_CHAR_MS + (trimmed.length - cjkChars) * 30
    : trimmed.split(/\s+/).filter(Boolean).length * LATIN_WORD_MS;
  return rawMs / speed;
}
