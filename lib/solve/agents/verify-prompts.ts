// lib/solve/agents/verify-prompts.ts

import type { ProblemSpec } from '../types';

export const VERIFY_SYSTEM_PROMPT = `你是解题校验专家。独立解答给定的题目，输出你得到的答案。

你的答案将自动与提供的答案进行对比（支持 LaTeX/选项/数值格式差异）。

考虑以下格式差异：
- $3$ 和 3 是相同的
- \\frac{1}{2} 和 1/2 是相同的
- C 和 选项C 是相同的
- {1,2,3} 和 {1, 2, 3} 是相同的

输出纯 JSON：
{"yourAnswer":"你独立解出的答案","confidence":0.95,"reasoning":"简要解题思路"}

如果你的答案与提供的答案不同，也可以给出 suggestedAnswer：
{"yourAnswer":"你解出的答案","suggestedAnswer":"你认为正确的答案","confidence":0.9,"reasoning":"解题思路"}`;

export function buildVerifyPrompt(
  problemText: string,
  _originalAnswer: string,
  problemSpec?: ProblemSpec | null,
): string {
  const recognitionContext = problemSpec
    ? `\n\n【学生已确认的识别证据】\n${JSON.stringify({
        id: problemSpec.id,
        stage: problemSpec.stage,
        subject: problemSpec.subject,
        questionType: problemSpec.questionType,
        stem: problemSpec.stem,
        options: problemSpec.options,
        givens: problemSpec.givens,
        asks: problemSpec.asks,
        formulas: problemSpec.formulas,
        ambiguities: problemSpec.ambiguities,
        materials: problemSpec.materials,
        subQuestions: problemSpec.subQuestions,
        diagram: problemSpec.diagram,
        confidence: problemSpec.confidence,
      })}`
    : '';
  return `题目：${problemText}${recognitionContext}\n\n请独立解答这道题目，给出你的答案和简要推理过程。`;
}
