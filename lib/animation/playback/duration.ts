/** 旁白阅读时长估算。速率与课堂 playback engine 一致：CJK ~150ms/字，非 CJK ~240ms/词。 */
export const CJK_CHAR_MS = 150;
export const LATIN_WORD_MS = 240;
export const MIN_STEP_MS = 800;

export function estimateSpeechDurationMs(text: string, speed = 1): number {
  const trimmed = text.trim();
  // 空文本（无旁白）返回最小停留时长
  if (!trimmed) return MIN_STEP_MS;
  const cjkChars = (trimmed.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length;
  const isCJK = cjkChars > trimmed.length * 0.3;
  const rawMs = isCJK
    ? cjkChars * CJK_CHAR_MS + (trimmed.length - cjkChars) * 30
    : trimmed.split(/\s+/).filter(Boolean).length * LATIN_WORD_MS;
  return rawMs / speed;
}
