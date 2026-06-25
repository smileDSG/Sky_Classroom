const DEFAULT_EXPLANATION = '暂无解析';
const RAMBLING_FALLBACK = '本题先抓住题干条件列式，再与选项核对；正确答案见上方标记。';

export const QUIZ_EXPLANATION_MAX_CHARS = 180;
export const QUIZ_EXPLANATION_PROMPT_LIMIT_CHARS = 120;

const RAMBLING_MARKERS = [
  '重新计算',
  '重新审题',
  '检查选项',
  '另一种思路',
  '再解',
  '我理解',
  '我错',
  '我可能',
  '选项没有',
  '不是选项',
  '与选项不符',
  '矛盾',
  '不对',
];

const CONTRADICTION_MARKERS = ['选项没有', '不是选项', '与选项不符', '矛盾', '不对', '错误'];

function compactExplanationText(text: string): string {
  return text
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^解析(?:思路|过程)?[:：]\s*/u, '')
    .trim();
}

function firstMarkerIndex(text: string, markers: string[]): number {
  return markers.reduce((earliest, marker) => {
    const index = text.indexOf(marker);
    if (index === -1) return earliest;
    return earliest === -1 ? index : Math.min(earliest, index);
  }, -1);
}

function hasMarker(text: string, markers: string[]): boolean {
  return markers.some((marker) => text.includes(marker));
}

function trimToSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;

  const slice = text.slice(0, maxChars + 1);
  const sentenceEnds = [...slice.matchAll(/[。！？；.!?;]/gu)];
  const lastUsefulEnd = [...sentenceEnds].reverse().find((match) => (match.index ?? 0) >= 40);

  if (lastUsefulEnd?.index !== undefined) {
    return slice.slice(0, lastUsefulEnd.index + 1).trim();
  }

  return `${slice
    .slice(0, maxChars)
    .replace(/[，,、：:；;。\s]+$/u, '')
    .trim()}...`;
}

export function sanitizeQuizExplanation(rawExplanation: unknown): string {
  let explanation = compactExplanationText(String(rawExplanation ?? ''));
  if (!explanation) return DEFAULT_EXPLANATION;

  const markerIndex = firstMarkerIndex(explanation, RAMBLING_MARKERS);
  const hasRambling = markerIndex >= 0;

  if (hasRambling) {
    const prefix = explanation
      .slice(0, markerIndex)
      .replace(/[，,、：:；;。\s]+$/u, '')
      .trim();
    if (prefix.length >= 24 && !hasMarker(prefix, CONTRADICTION_MARKERS)) {
      explanation = prefix;
    } else {
      return RAMBLING_FALLBACK;
    }
  }

  if (explanation.length > QUIZ_EXPLANATION_MAX_CHARS) {
    explanation = trimToSentence(explanation, QUIZ_EXPLANATION_MAX_CHARS);
  }

  if (!explanation || hasMarker(explanation, CONTRADICTION_MARKERS)) {
    return RAMBLING_FALLBACK;
  }

  return explanation;
}
