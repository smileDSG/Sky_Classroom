// lib/solve/agents/correct-prompts.ts

export function buildCorrectPrompt(
  problemText: string,
  originalAnswer: string,
  suggestedAnswer: string,
  verificationReasoning: string,
): string {
  return `你之前的解答有误。请重新解答这道题目。

题目：${problemText}

你之前的答案：${originalAnswer}
校验结果：答案不正确
提示的正确答案：${suggestedAnswer}
校验推理：${verificationReasoning}

请重新给出完整的解题过程，最终答案应该与提示的正确答案一致。

输出 JSON：
{"steps":[{"label":"步骤1","content":"...","keyPoints":["..."]}],"answer":"最终答案"}`;
}
