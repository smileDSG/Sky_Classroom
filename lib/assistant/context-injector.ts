/**
 * Module C — Assistant context injector.
 *
 * Injects mistake-book and knowledge-graph data into the AI assistant's
 * system prompt so responses are personalised to the student's weak areas.
 */
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { GraphNode } from '@/lib/graph/types';
import type { QuestionBankEntry } from '@/lib/solve/types';

const MAX_CONTEXT_CHARS = 1200;

// ── Mistake context ────────────────────────────────────────────────

export function injectMistakeContext(
  basePrompt: string,
  mistakes: MistakeBookEntry[],
): string {
  if (!mistakes || mistakes.length === 0) return basePrompt;

  const kpCounts = new Map<string, number>();
  const errorTypeCounts = new Map<string, number>();

  for (const m of mistakes) {
    for (const kp of m.knowledgePoints) {
      kpCounts.set(kp, (kpCounts.get(kp) ?? 0) + 1);
    }
    errorTypeCounts.set(m.errorType, (errorTypeCounts.get(m.errorType) ?? 0) + 1);
  }

  const topKps = [...kpCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `"${name}"（${count}次）`)
    .join('、');

  const topErrors = [...errorTypeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${errorTypeLabel(type)}（${count}次）`)
    .join('、');

  const context = [
    '',
    '【学生错题分析】',
    `该学生共有 ${mistakes.length} 道错题记录。`,
    topKps ? `最容易出错的知识点：${topKps}。` : '',
    topErrors ? `主要错误类型：${topErrors}。` : '',
    '请根据以上信息，在回答时重点关注学生的薄弱知识点，多用相关例子帮助学生理解和巩固。',
  ]
    .filter(Boolean)
    .join('\n');

  const combined = basePrompt + '\n' + context;
  if (combined.length > basePrompt.length + MAX_CONTEXT_CHARS) return basePrompt + '\n' + context.slice(0, MAX_CONTEXT_CHARS);
  return combined;
}

// ── Graph context ──────────────────────────────────────────────────

export function injectGraphContext(
  basePrompt: string,
  nodes: GraphNode[],
): string {
  if (!nodes || nodes.length === 0) return basePrompt;

  const weakNodes = nodes
    .filter((n) => n.mastery < 50)
    .sort((a, b) => a.mastery - b.mastery);

  const strongNodes = nodes.filter((n) => n.mastery >= 80);

  const parts: string[] = ['', '【学生知识掌握情况】'];

  if (strongNodes.length > 0) {
    const names = strongNodes.slice(0, 3).map((n) => `"${n.name}"（${n.mastery}%）`).join('、');
    parts.push(`掌握较好的知识点：${names}。`);
  }

  if (weakNodes.length > 0) {
    const names = weakNodes.slice(0, 3).map((n) => `"${n.name}"（${n.mastery}%）`).join('、');
    parts.push(`薄弱知识点（需重点辅导）：${names}。`);
  }

  if (weakNodes.length === 0 && strongNodes.length === 0) return basePrompt;

  parts.push('请在回答中适当联系学生的薄弱点，帮助学生建立知识之间的联系。');

  const context = parts.join('\n');
  const combined = basePrompt + '\n' + context;
  if (combined.length > basePrompt.length + MAX_CONTEXT_CHARS) return basePrompt + '\n' + context.slice(0, MAX_CONTEXT_CHARS);
  return combined;
}

// ── Solve history context ────────────────────────────────────────

export function injectSolveHistory(
  basePrompt: string,
  entries: QuestionBankEntry[],
): string {
  if (!entries || entries.length === 0) return basePrompt;

  const recent = entries.slice(0, 5);
  const kpSet = new Set<string>();
  for (const e of entries) {
    for (const kp of e.knowledgePoints) kpSet.add(kp.name);
  }
  const allKps = [...kpSet].slice(0, 8).join('、');

  const lines = recent.map((e) => {
    const kps = e.knowledgePoints.map((kp) => kp.name).join('、');
    return `- ${e.problemText}（知识点：${kps}）`;
  });

  const context = [
    '',
    '【学生解题历史】',
    `该学生已解答 ${entries.length} 道题目。`,
    allKps ? `涉及知识点：${allKps}。` : '',
    '最近解过的题目：',
    ...lines,
    '请根据学生的解题历史，在回答时适当关联已学内容，帮助学生巩固和拓展。',
  ]
    .filter(Boolean)
    .join('\n');

  const combined = basePrompt + '\n' + context;
  if (combined.length > basePrompt.length + MAX_CONTEXT_CHARS) return basePrompt + '\n' + context.slice(0, MAX_CONTEXT_CHARS);
  return combined;
}

// ── Full system prompt builder ─────────────────────────────────────

export interface PromptContext {
  mistakes?: MistakeBookEntry[];
  graphNodes?: GraphNode[];
  solveHistory?: QuestionBankEntry[];
}

export function buildSystemPrompt(
  subject: string,
  difficulty: string,
  style: string,
  context?: PromptContext,
): string {
  const diffLabel =
    difficulty === 'junior' ? '初中' : difficulty === 'senior' ? '高中' : '大学';

  const styleHint =
    style === 'concise'
      ? '回答要简洁明了，抓住重点。'
      : style === 'heuristic'
        ? '用启发式的方式引导学生思考，不要直接给出完整答案，多用提问和提示。'
        : '回答要详细清楚，包含步骤和解释。';

  let prompt = `你是一位专业的${subject}学习助手，面向${diffLabel}水平的学生。
${styleHint}
要求：
1. 用中文回答，语气亲切自然，像一个耐心的老师。
2. 如果学生发了具体题目，请逐步分析、解答，并给出检验方法。
3. 如果学生问概念，先用通俗语言解释，再举一个简单例子。
4. 回答要针对学生的具体问题，不要泛泛而谈。
5. 适当使用 Markdown 格式（如加粗重点、公式、列表）让回答更清晰。`;

  if (context?.mistakes && context.mistakes.length > 0) {
    prompt = injectMistakeContext(prompt, context.mistakes);
  }

  if (context?.graphNodes && context.graphNodes.length > 0) {
    prompt = injectGraphContext(prompt, context.graphNodes);
  }

  if (context?.solveHistory && context.solveHistory.length > 0) {
    prompt = injectSolveHistory(prompt, context.solveHistory);
  }

  return prompt;
}

// ── Helpers ────────────────────────────────────────────────────────

function errorTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    calculation: '计算错误',
    concept: '概念不清',
    reasoning: '逻辑推理错误',
    reading: '审题不清',
    careless: '粗心大意',
  };
  return labels[type] ?? type;
}
