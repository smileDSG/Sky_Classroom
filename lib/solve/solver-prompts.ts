/**
 * System prompts for solver agents.
 *
 * Each agent type gets a specialized prompt that instructs
 * the LLM on how to approach the problem and format the output.
 */

import type { SolverAgentType } from './types';
import { buildPersonalizationPrompt } from '@/lib/agents/personalization-utils';
import type { PersonalizationSliceState } from '@/lib/store/settings/personalization';

// 知识点生成的通用指令（所有 agent 共用）
const KNOWLEDGE_POINTS_INSTRUCTION = `
【知识点 — 必须返回，严禁空数组】返回2-4个相关知识点，description包含：核心概念+应用场景+易错点。
示例：{"name":"韦达定理","description":"ax²+bx+c=0两根之和x₁+x₂=-b/a，之积x₁·x₂=c/a。用于求根的和与积。注意Δ≥0且a≠0。","difficulty":"medium"}`;

// LaTeX 格式规范（science/universal 共用，避免重复 ~400 tokens）
const LATEX_RULES = `
【LaTeX规范】
- 数学表达式用$...$包裹，$内禁止换行，$必须成对
- 分数$\\frac{a}{b}$，根号$\\sqrt{x}$，LaTeX命令必须\\开头
- step.content/keyPoints中所有数学表达式必须$...$包裹，禁止裸符号
- 错误：E'=1/4·1/2kA²  正确：$E'=\\frac{1}{4}\\cdot\\frac{1}{2}kA^2$`;

const ANSWER_RULE = `answer字段【严禁】包含解释/推导/"所以"/"因此"等，只写最终结果如$3$、$\\frac{1}{2}$、$x=4$、A、B。confidence为0-1。`;

const AGENT_SYSTEM_PROMPTS: Record<SolverAgentType, string> = {
  universal: `你是解题专家。分析题目，给出解题过程和答案。

JSON：{"solution":"解题过程","answer":"仅答案","confidence":0.9,"steps":[{"label":"步骤1","content":"...","keyPoints":["..."]}],"knowledgePoints":[...],"similarQuestions":[...]}
${KNOWLEDGE_POINTS_INSTRUCTION}
${ANSWER_RULE}
${LATEX_RULES}`,

  science: `你是理科解题专家（数学/物理/化学/生物）。用严谨科学方法分析，逐步推导。

JSON：{"solution":"完整推导","answer":"仅答案","confidence":0.9,"steps":[{"label":"步骤1","content":"...","keyPoints":["..."]}],"knowledgePoints":[...],"similarQuestions":[...]}
${KNOWLEDGE_POINTS_INSTRUCTION}
${ANSWER_RULE}
${LATEX_RULES}`,

  humanities: `你是文科解题专家（语文/历史/政治/地理）。深入分析题目背景，给出有深度的解答。

JSON：{"solution":"分析过程","answer":"仅答案如A/B/C/D或关键词","confidence":0.9,"steps":[{"label":"步骤1","content":"...","keyPoints":["..."]}],"knowledgePoints":[...],"similarQuestions":[...]}
${KNOWLEDGE_POINTS_INSTRUCTION}
answer字段【严禁】包含解释/分析/"所以"/"因此"等，只写最终答案选项或关键词。confidence为0-1。`,

  grading: `你是一个作业批改专家。请对比标准答案和用户答案，判断对错并分析错因。

错因类型：concept-unclear（概念不清）、calculation-error（计算失误）、misreading（审题错误）、method-wrong（方法错误）、careless（粗心）、format-error（格式错误）。

输出JSON：{"isCorrect":true,"score":85,"errorAnalysis":"错因分析","cause":"calculation-error","partialCredit":[{"step":"...","maxScore":10,"earnedScore":8,"comment":"..."}]}`,
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
  personalization?: Partial<PersonalizationSliceState>,
): string {
  const basePrompt = AGENT_SYSTEM_PROMPTS[agentType];

  // Add personalization context
  const personalizationPrompt = personalization
    ? buildPersonalizationPrompt(personalization)
    : '';

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

  const fullPrompt = `${basePrompt}${personalizationPrompt}${contextBlock}`;

  if (agentType === 'grading') {
    return `${fullPrompt}\n\n题目：${problemText}\n标准答案：${standardAnswer ?? '未提供'}\n用户答案：${userAnswer ?? '未提供'}`;
  }

  return `${fullPrompt}\n\n题目：${problemText}`;
}

/**
 * Build a lightweight prompt for generating knowledge points only.
 * Used when question bank or solve cache hits but has no knowledge points.
 */
export function buildKnowledgePointsPrompt(
  problemText: string,
  answer: string,
): string {
  return `你是知识点总结专家。根据以下题目和答案，生成 2-4 个相关的知识点。

每个知识点的 description 必须包含三部分：
1. 核心概念（这个知识点是什么）
2. 应用场景（什么时候用、怎么用）
3. 易错点或注意事项（学生常犯的错误）

输出 JSON 格式：
{"knowledgePoints":[{"name":"知识点名称","description":"核心概念+应用场景+易错点","difficulty":"easy|medium|hard"}]}

题目：${problemText}
答案：${answer}

请直接输出 JSON，不要输出其他内容。`;
}
