// lib/solve/agents/verify-prompts.ts

export const VERIFY_SYSTEM_PROMPT = `你是解题校验专家。独立解答给定的题目，然后对比你的答案和提供的答案是否一致。

考虑以下格式差异：
- $3$ 和 3 是相同的
- \\frac{1}{2} 和 1/2 是相同的
- C 和 选项C 是相同的
- {1,2,3} 和 {1, 2, 3} 是相同的

输出纯 JSON：
{"yourAnswer":"你独立解出的答案","isCorrect":true,"confidence":0.95,"reasoning":"简要说明对比过程"}

如果答案不一致：
{"yourAnswer":"正确答案","isCorrect":false,"suggestedAnswer":"正确答案","confidence":0.9,"reasoning":"说明为什么不一致"}`;

export function buildVerifyPrompt(problemText: string, originalAnswer: string): string {
  return `题目：${problemText}\n\n待验证的答案：${originalAnswer}\n\n请独立解答并对比答案。`;
}
