import type { MistakeCause } from './types';

const VALID_CAUSES: MistakeCause[] = [
  'concept-unclear', 'calculation-error', 'misreading',
  'method-wrong', 'careless', 'format-error',
];

const FULL_PHRASE_MAP: Record<string, MistakeCause> = {
  '概念不清': 'concept-unclear',
  '计算失误': 'calculation-error',
  '审题错误': 'misreading',
  '方法错误': 'method-wrong',
  '粗心': 'careless',
  '格式错误': 'format-error',
};

const KEYWORD_MAP: Record<string, MistakeCause> = {
  '概念': 'concept-unclear', '计算': 'calculation-error',
  '审题': 'misreading', '方法': 'method-wrong',
  '粗心': 'careless', '格式': 'format-error',
};

const CAUSE_LABELS: Record<MistakeCause, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  'misreading': '审题错误',
  'method-wrong': '方法错误',
  'careless': '粗心',
  'format-error': '格式错误',
};

/** 将原始错误原因字符串标准化为 MistakeCause 枚举值 */
export function classifyErrorCause(raw: string): MistakeCause {
  const normalized = raw.trim().toLowerCase();
  if (VALID_CAUSES.includes(normalized as MistakeCause)) return normalized as MistakeCause;
  for (const [k, v] of Object.entries(FULL_PHRASE_MAP)) {
    if (normalized.includes(k)) return v;
  }
  for (const [k, v] of Object.entries(KEYWORD_MAP)) {
    if (normalized.includes(k)) return v;
  }
  return 'concept-unclear';
}

/** 获取 MistakeCause 对应的中文标签 */
export function getCauseLabel(cause: MistakeCause): string {
  return CAUSE_LABELS[cause] || cause;
}

/** 检查给定值是否为合法 MistakeCause */
export function isValidCause(value: string): value is MistakeCause {
  return VALID_CAUSES.includes(value as MistakeCause);
}

export { VALID_CAUSES };
