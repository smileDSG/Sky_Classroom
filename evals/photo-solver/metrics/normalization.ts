const punctuationMap: Record<string, string> = {
  '，': ',',
  '。': '.',
  '！': '!',
  '？': '?',
  '：': ':',
  '；': ';',
  '（': '(',
  '）': ')',
  '【': '[',
  '】': ']',
  '、': ',',
  '＋': '+',
  '－': '-',
  '＝': '=',
  '／': '/',
  '＊': '*',
};
const mapPunctuation = (value: string): string =>
  [...value.normalize('NFKC')].map((character) => punctuationMap[character] ?? character).join('');
export const normalizeText = (value: string): string =>
  mapPunctuation(value).toLowerCase().replace(/\s+/gu, '').trim();
export const normalizeFormula = (value: string): string =>
  normalizeText(value).replace(/^\$|\$$/gu, '');
export const normalizeAnswer = (value: string): string => {
  const surface = mapPunctuation(value).toLowerCase().trim();
  const withoutLabel = surface.replace(/^(?:answer|答案(?:为|是)?)(?:\s*:\s*|\s+)/u, '');
  return normalizeText(withoutLabel).replace(/[.!]+$/gu, '');
};
export const normalizedExactMatch = (actual: string | undefined, expected: string): boolean =>
  actual !== undefined && normalizeAnswer(actual) === normalizeAnswer(expected);
