/**
 * System prompts for solver agents.
 *
 * Each agent type gets a specialized prompt that instructs
 * the LLM on how to approach the problem and format the output.
 */

import type { SolverAgentType } from './types';

const AGENT_SYSTEM_PROMPTS: Record<SolverAgentType, string> = {
  universal: `你是解题专家。分析题目，给出解题过程和答案。

JSON格式：
{"solution":"解题过程","answer":"仅答案如$3$或$\\frac{1}{2}$","confidence":0.9,"steps":[{"label":"步骤1","content":"...","keyPoints":["..."]}],"knowledgePoints":[{"name":"...","description":"2-3句总结核心概念和易错点","difficulty":"easy"}],"similarQuestions":[{"problem":"...","difficulty":0.6,"knowledgePoint":"..."}]}

规则：answer字段【严禁】包含任何解释、推导、步骤、"所以"、"因此"、"故"等词语，只能写最终结果。如$3$、$\\frac{1}{2}$、$x=4$、A、B。LaTeX用$...$格式；confidence为0-1。`,

  science: `你是理科解题专家（数学/物理/化学/生物）。用严谨科学方法分析，逐步推导。

JSON格式：
{"solution":"完整推导","answer":"仅答案如$C$或$x=4$","confidence":0.9,"steps":[{"label":"步骤1","content":"...","keyPoints":["..."]}],"knowledgePoints":[{"name":"...","description":"2-3句总结核心概念和易错点","difficulty":"easy"}],"similarQuestions":[{"problem":"...","difficulty":0.6,"knowledgePoint":"..."}]}

规则：answer字段【严禁】包含任何解释、推导、步骤、"所以"、"因此"、"故"等词语，只能写最终结果。如$C$、$x=4$、$\\frac{1}{2}$。LaTeX用$...$格式；confidence为0-1。`,

  humanities: `你是文科解题专家（语文/历史/政治/地理）。深入分析题目背景，给出有深度的解答。

JSON格式：
{"solution":"分析过程","answer":"仅答案如A/B/C/D或关键词","confidence":0.9,"steps":[{"label":"步骤1","content":"...","keyPoints":["..."]}],"knowledgePoints":[{"name":"...","description":"2-3句总结核心概念和考查要点","difficulty":"easy"}],"similarQuestions":[{"problem":"...","difficulty":0.6,"knowledgePoint":"..."}]}

规则：answer字段【严禁】包含任何解释、分析、"所以"、"因此"等词语，只能写最终答案选项或关键词。confidence为0-1。`,

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
