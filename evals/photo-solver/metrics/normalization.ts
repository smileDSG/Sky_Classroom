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
  '＋': '+',
  '－': '-',
  '＝': '=',
  '／': '/',
  '＊': '*',
};

const mapPunctuation = (value: string): string =>
  [...value.normalize('NFKC')].map((character) => punctuationMap[character] ?? character).join('');

export const normalizeText = (value: string): string =>
  mapPunctuation(value).toLocaleLowerCase().replace(/\s+/gu, '').trim();

export const normalizeFormula = (value: string): string =>
  normalizeText(value).replace(/^\$|\$$/gu, '');

export const normalizeAnswer = (value: string): string => {
  let normalized = normalizeText(value);
  normalized = normalized.replace(/^(?:answer|答案(?:为|是)?):?/u, '');
  return normalized.replace(/[.!。！]+$/gu, '');
};

export const normalizedExactMatch = (actual: string | undefined, expected: string): boolean =>
  actual !== undefined && normalizeAnswer(actual) === normalizeAnswer(expected);
