// lib/solve/agents/correct-prompts.ts

export function buildCorrectPrompt(
  problemText: string,
  originalAnswer: string,
  _suggestedAnswer: string,
  verificationReasoning: string,
): string {
  return `你之前的解答有误。请重新独立解答这道题目。

题目：${problemText}

你之前的答案：${originalAnswer}
校验反馈：${verificationReasoning}

请重新给出完整的解题过程。注意：请基于题目本身独立推导，不要受任何已有答案影响。

输出 JSON：
{"steps":[{"label":"步骤1","content":"...","keyPoints":["..."]}],"answer":"最终答案"}`;
}
