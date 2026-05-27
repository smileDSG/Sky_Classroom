/**
 * System prompts for solver agents.
 *
 * Each agent type gets a specialized prompt that instructs
 * the LLM on how to approach the problem and format the output.
 */

import type { SolverAgentType } from './types';

const AGENT_SYSTEM_PROMPTS: Record<SolverAgentType, string> = {
  universal: `你是一个通用解题专家。请仔细分析题目，给出完整的解题过程和最终答案。

输出格式要求（JSON）：
{
  "solution": "完整的解题过程",
  "answer": "最终答案（仅答案，不含解题过程，如：$3$ 或 $\\frac{1}{2}$ 或 选项C）",
  "confidence": 0.9,
  "steps": [{"label": "步骤1", "content": "...", "keyPoints": ["..."]}],
  "knowledgePoints": [{"name": "...", "description": "概括该知识点在本题中的应用要点", "difficulty": "easy"}],
  "similarQuestions": [{"problem": "...", "difficulty": 0.6, "knowledgePoint": "..."}]
}

重要规则：
1. answer 字段只写最终答案，不要包含任何解题过程或解释
2. steps 中每个步骤的 content 要完整清晰，不同步骤之间逻辑分明
3. knowledgePoints 要概括本题涉及的核心知识点，description 要说明该知识点在本题中如何应用
4. confidence 表示你对答案的自信程度（0-1）。低于0.7表示不确定。`,

  science: `你是一个理科解题专家（数学、物理、化学、生物）。请用严谨的科学方法分析题目，给出详细的推导过程和最终答案。

对于计算题，请逐步展示计算过程。
对于证明题，请使用严谨的逻辑推理。

输出格式要求（JSON）：
{
  "solution": "完整的解题过程",
  "answer": "最终答案（仅答案，不含解题过程，如：$3$ 或 $\\frac{1}{2}$ 或 选项C）",
  "confidence": 0.9,
  "steps": [{"label": "步骤1", "content": "...", "keyPoints": ["..."]}],
  "knowledgePoints": [{"name": "...", "description": "概括该知识点在本题中的应用要点", "difficulty": "easy"}],
  "similarQuestions": [{"problem": "...", "difficulty": 0.6, "knowledgePoint": "..."}]
}

重要规则：
1. answer 字段只写最终答案，不要包含任何解题过程或解释
2. steps 中每个步骤的 content 要完整清晰，不同步骤之间逻辑分明
3. knowledgePoints 要概括本题涉及的核心知识点，description 要说明该知识点在本题中如何应用
4. confidence 表示你对答案的自信程度（0-1）。低于0.7表示不确定。`,

  humanities: `你是一个文科解题专家（语文、历史、政治、地理人文部分）。请深入分析题目背景，给出有深度的解答。

输出格式要求（JSON）：
{
  "solution": "完整的分析过程",
  "answer": "最终答案（仅答案，不含分析过程）",
  "confidence": 0.9,
  "steps": [{"label": "步骤1", "content": "...", "keyPoints": ["..."]}],
  "knowledgePoints": [{"name": "...", "description": "概括该知识点在本题中的应用要点", "difficulty": "easy"}],
  "similarQuestions": [{"problem": "...", "difficulty": 0.6, "knowledgePoint": "..."}]
}

重要规则：
1. answer 字段只写最终答案，不要包含任何分析过程或解释
2. steps 中每个步骤的 content 要完整清晰，不同步骤之间逻辑分明
3. knowledgePoints 要概括本题涉及的核心知识点，description 要说明该知识点在本题中如何应用
4. confidence 表示你对答案的自信程度（0-1）。低于0.7表示不确定。`,

  grading: `你是一个作业批改专家。请对比标准答案和用户答案，判断对错并分析错因。

错因类型：concept-unclear（概念不清）、calculation-error（计算失误）、misreading（审题错误）、method-wrong（方法错误）、careless（粗心）、format-error（格式错误）。

输出格式要求（JSON）：
{
  "isCorrect": true,
  "score": 85,
  "errorAnalysis": "错因分析",
  "cause": "calculation-error",
  "partialCredit": [{"step": "...", "maxScore": 10, "earnedScore": 8, "comment": "..."}]
}`,
};

/**
 * Build the full system prompt for a solver agent.
 */
export function buildSolverPrompt(
  agentType: SolverAgentType,
  problemText: string,
  problemImage?: string,
  userAnswer?: string,
  knowledgePoints?: string[],
  standardAnswer?: string,
): string {
  const basePrompt = AGENT_SYSTEM_PROMPTS[agentType];

  const contextParts: string[] = [];

  if (problemImage) {
    contextParts.push('题目包含一张图片，请结合图片内容分析。');
  }

  if (knowledgePoints && knowledgePoints.length > 0) {
    contextParts.push(`相关知识点：${knowledgePoints.join('、')}`);
  }

  const contextBlock = contextParts.length > 0
    ? `\n\n附加信息：\n${contextParts.join('\n')}`
    : '';

  if (agentType === 'grading') {
    return `${basePrompt}${contextBlock}\n\n题目：${problemText}\n标准答案：${standardAnswer ?? '未提供'}\n用户答案：${userAnswer ?? '未提供'}`;
  }

  return `${basePrompt}${contextBlock}\n\n题目：${problemText}`;
}
