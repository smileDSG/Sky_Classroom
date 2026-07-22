/**
 * System prompts for solver agents.
 *
 * Each agent type gets a specialized prompt that instructs
 * the LLM on how to approach the problem and format the output.
 */

import type { ProblemSpec, SolverAgentType } from './types';
import { buildPersonalizationPrompt } from '@/lib/agents/personalization-utils';
import type { PersonalizationSliceState } from '@/lib/store/settings/personalization';

// 知识点生成的通用指令（所有 agent 共用）
const KNOWLEDGE_POINTS_INSTRUCTION = `
【知识点 — 必须返回，严禁空数组】返回2-4个相关知识点，description包含：核心概念+应用场景+易错点。
示例：{"name":"韦达定理","description":"ax²+bx+c=0两根之和x₁+x₂=-b/a，之积x₁·x₂=c/a。用于求根的和与积。注意Δ≥0且a≠0。","difficulty":"medium"}`;

// 同类题生成的通用指令（所有 agent 共用）
const SIMILAR_QUESTIONS_INSTRUCTION = `
【同类题 — 必须返回，严禁空数组】返回2-3道同类练习题，每道题必须包含参考答案。
示例：{"problem":"已知 $f(x)=x^2+2x+1$，求 $f(3)$ 的值。","difficulty":3,"knowledgePoint":"二次函数","answer":"$f(3)=3^2+2×3+1=16$"}`;

// LaTeX 格式规范（science/universal 共用）
const LATEX_RULES = `
【LaTeX规范 — 严格遵守，否则渲染失败】
1. 所有数学表达式必须用 $...$ 包裹，$内禁止换行，$必须成对
2. 独立公式（占一行的）用 $$...$$ 包裹
3. 分数：$\\frac{分子}{分母}$  禁止写 a/b 形式
4. 根号：$\\sqrt{x}$，$\\sqrt[3]{x}$  禁止写 √x
5. 三角/对数函数：$\\sin x$、$\\cos\\theta$、$\\tan\\alpha$、$\\ln x$、$\\log_2 x$、$\\lim_{x\\to 0}$  禁止写 sin、cos、ln
6. 导数：$f'(x)$、$y'$、$f''(x)$、$\\frac{dy}{dx}$、$\\frac{d^2y}{dx^2}$
7. 积分：$\\int_a^b f(x)\\,dx$、$\\iint_D$、$\\oint$  禁止写 ∫
8. 求和/积：$\\sum_{n=1}^{\\infty}$、$\\prod_{k=1}^{n}$
9. 希腊字母：$\\alpha$、$\\beta$、$\\gamma$、$\\theta$、$\\omega$、$\\pi$、$\\lambda$、$\\mu$、$\\sigma$、$\\varphi$  禁止写 α、β、γ
10. 矩阵/行列式：
    矩阵 $\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$
    行列式 $\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}$
11. 多行对齐用 $\\begin{aligned} ... \\end{aligned}$
12. 运算符：$\\cdot$（点乘）、$\\times$（叉乘）、$\\div$、$\\pm$、$\\mp$
13. 关系符：$\\leq$、$\\geq$、$\\neq$、$\\approx$、$\\equiv$、$\\sim$
14. 箭头：$\\rightarrow$、$\\Rightarrow$、$\\leftarrow$、$\\leftrightarrow$
15. 特殊符号：$\\infty$、$\\partial$、$\\nabla$、$\\in$、$\\subset$、$\\cup$、$\\cap$、$\\emptyset$
16. 上标下标：$x^2$、$x^{n+1}$、$a_n$、$a_{n+1}$、$\\sum_{i=1}^{n}$
17. 绝对值/范数：$|x|$、$\\|\\vec{a}\\|$
18. 向量：$\\vec{a}$、$\\overrightarrow{AB}$
19. 省略号：$\\cdots$（中）、$\\ldots$（底）、$\\vdots$（竖）、$\\ddots$（斜）

示例：
❌ 错误：sin2x + cos2x = 1  ✅ 正确：$\\sin^2 x + \\cos^2 x = 1$
❌ 错误：lim(x→0) sinx/x = 1  ✅ 正确：$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$
❌ 错误：∫₀¹ x² dx = 1/3  ✅ 正确：$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$
❌ 错误：α + β = π  ✅ 正确：$\\alpha + \\beta = \\pi$
`;

const ANSWER_RULE = `answer字段【严禁】包含解释/推导/"所以"/"因此"等，只写最终结果，用$...$包裹。
示例：$3$、$\\frac{1}{2}$、$x=4$、$y = C_1 e^{2x} + C_2 e^{3x}$、A、B。confidence为0-1。`;

const AGENT_SYSTEM_PROMPTS: Record<SolverAgentType, string> = {
  universal: `你是解题专家。分析题目，给出解题过程和答案。

输出分为两部分：
1. solution字段：完整详细的解题推导过程，包含思路分析、公式推导、计算过程等
2. steps数组：至少3-5个步骤，每步描述一个关键解题动作

JSON格式：{"solution":"完整详细的推导过程","answer":"仅答案","confidence":0.9,"steps":[{"label":"步骤1","content":"该步的关键动作和中间结果","keyPoints":["..."]}],"knowledgePoints":[...],"similarQuestions":[{"problem":"题目","difficulty":5,"knowledgePoint":"知识点","answer":"参考答案"}]}
${KNOWLEDGE_POINTS_INSTRUCTION}
${SIMILAR_QUESTIONS_INSTRUCTION}
${ANSWER_RULE}
${LATEX_RULES}
【重要】steps至少3步，每步包含关键动作和对应的中间结果/公式。例如：步骤1审题列式→步骤2代入化简→步骤3求解计算→步骤4验证结论。`,

  science: `你是理科解题专家（数学/物理/化学/生物）。用严谨科学方法分析，逐步推导。

输出分为两部分：
1. solution字段：完整详细的解题推导过程，包含思路分析、公式推导、计算过程等
2. steps数组：至少3-5个步骤，每步描述一个关键解题动作和中间结果

JSON格式：{"solution":"完整详细的推导过程","answer":"仅答案","confidence":0.9,"steps":[{"label":"步骤1","content":"该步的关键动作和中间结果","keyPoints":["..."]}],"knowledgePoints":[...],"similarQuestions":[{"problem":"题目","difficulty":5,"knowledgePoint":"知识点","answer":"参考答案"}]}
${KNOWLEDGE_POINTS_INSTRUCTION}
${SIMILAR_QUESTIONS_INSTRUCTION}
${ANSWER_RULE}
${LATEX_RULES}
【重要】steps至少3步，每步包含关键动作和对应的中间结果/公式。例如：步骤1审题列式→步骤2代入化简→步骤3求解计算→步骤4验证结论。`,

  humanities: `你是文科解题专家（语文/历史/政治/地理）。深入分析题目背景，给出有深度的解答。

输出分为两部分：
1. solution字段：完整详细的分析过程，包含背景分析、论据推理、结论得出等
2. steps数组：至少3-5个步骤，每步描述一个关键分析动作

JSON格式：{"solution":"完整详细的分析过程","answer":"仅答案如A/B/C/D或关键词","confidence":0.9,"steps":[{"label":"步骤1","content":"该步的关键分析动作和结论","keyPoints":["..."]}],"knowledgePoints":[...],"similarQuestions":[{"problem":"题目","difficulty":5,"knowledgePoint":"知识点","answer":"参考答案"}]}
${KNOWLEDGE_POINTS_INSTRUCTION}
${SIMILAR_QUESTIONS_INSTRUCTION}
answer字段【严禁】包含解释/分析/"所以"/"因此"等，只写最终答案选项或关键词。confidence为0-1。
【重要】steps至少3步，每步包含关键分析动作和对应的结论。`,

  grading: `你是一个作业批改专家。请对比标准答案和用户答案，判断对错并分析错因。

错因类型：concept-unclear（概念不清）、calculation-error（计算失误）、misreading（审题错误）、method-wrong（方法错误）、careless（粗心）、format-error（格式错误）。

输出JSON：{"isCorrect":true,"score":85,"errorAnalysis":"错因分析","cause":"calculation-error","partialCredit":[{"step":"...","maxScore":10,"earnedScore":8,"comment":"..."}]}`,
};

function formatProblemSpec(problemSpec: ProblemSpec, hasImage: boolean): string {
  const lines = ['【结构化题目条件】', `学段：${problemSpec.stage}`, `学科：${problemSpec.subject}`, `题型：${problemSpec.questionType}`, `题干：${problemSpec.stem}`];
  if (problemSpec.options.length > 0) lines.push(`选项：${problemSpec.options.map(option => `${option.key}: ${option.content}`).join('；')}`);
  if (problemSpec.givens.length > 0) lines.push(`已知条件：${problemSpec.givens.map(given => { const label = given.symbol ? `${given.name ?? given.symbol}(${given.symbol})` : (given.name ?? '未命名条件'); return `${label}=${given.value ?? '未知'}${given.unit ? ` ${given.unit}` : ''}`; }).join('；')}`);
  if (problemSpec.asks.length > 0) lines.push(`求解目标：${problemSpec.asks.join('；')}`);
  if (problemSpec.formulas.length > 0) lines.push(`识别公式：${problemSpec.formulas.join('；')}`);
  if (problemSpec.materials.length > 0) lines.push(`材料：${problemSpec.materials.join('；')}`);
  if (problemSpec.subQuestions.length > 0) lines.push(`子问题：${problemSpec.subQuestions.join('；')}`);
  if (problemSpec.diagram) lines.push(`图示：${problemSpec.diagram.type}；${problemSpec.diagram.description}；标注=${problemSpec.diagram.labels.join(', ')}；关系=${problemSpec.diagram.relations.join('；')}`);
  if (problemSpec.ambiguities.length > 0) lines.push(`识别歧义：${problemSpec.ambiguities.map(item => `${item.field}：${item.candidates.join('/')}（${item.reason}）`).join('；')}`);
  lines.push(`识别置信度：${problemSpec.confidence}`);
  if (hasImage) lines.push('若结构化识别结果与图片冲突，以原始题图优先；需明确指出不确定信息，禁止擅自补全。');
  lines.push('【结构化题目条件结束】');
  return lines.join('\n');
}

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
  problemSpec?: ProblemSpec | null,
): string {
  const basePrompt = AGENT_SYSTEM_PROMPTS[agentType];

  // Add personalization context
  const personalizationPrompt = personalization ? buildPersonalizationPrompt(personalization) : '';

  const contextParts: string[] = [];

  if (problemImage) {
    contextParts.push(
      '题目附带了一张图片。请仔细观察图片中的题目内容，结合图片进行解题。如果文字识别有误，以图片内容为准。',
    );
  }

  if (knowledgePoints && knowledgePoints.length > 0) {
    contextParts.push(`相关知识点：${knowledgePoints.join('、')}`);
  }

  if (problemSpec) {
    contextParts.push(formatProblemSpec(problemSpec, Boolean(problemImage)));
  }

  const contextBlock = contextParts.length > 0 ? `\n\n附加信息：\n${contextParts.join('\n')}` : '';

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
export function buildKnowledgePointsPrompt(problemText: string, answer: string): string {
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
