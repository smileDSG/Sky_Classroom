/**
 * Shared constants and utilities for solver agents.
 * Single source of truth for model mapping, env config, and routing.
 */
import type { ProblemSpec, SolverAgentType } from './types';
import type { ProviderId, ModelConfig } from '@/lib/types/provider';

// ── Agent → provider/model mapping ───────────────────────────────

export const AGENT_MODEL_MAP: Record<SolverAgentType, { providerId: ProviderId; modelId: string }> = {
  universal: { providerId: 'deepseek', modelId: 'deepseek-v4-flash' },
  science: { providerId: 'glm', modelId: 'glm-5.1' },
  humanities: { providerId: 'qwen', modelId: 'qwen3.6-plus' },
  grading: { providerId: 'deepseek', modelId: 'deepseek-v4-flash' },
};

export const ENV_KEY_MAP: Record<string, string> = {
  deepseek: 'DEEPSEEK_API_KEY',
  glm: 'GLM_API_KEY',
  qwen: 'QWEN_API_KEY',
};

export const ENV_URL_MAP: Record<string, string> = {
  deepseek: 'DEEPSEEK_BASE_URL',
  glm: 'GLM_BASE_URL',
  qwen: 'QWEN_BASE_URL',
};

/** Resolve ModelConfig for a solver agent type. */
export function resolveSolverModel(agentType: SolverAgentType): ModelConfig {
  const { providerId, modelId } = AGENT_MODEL_MAP[agentType];
  const apiKey = process.env[ENV_KEY_MAP[providerId] ?? ''] ?? '';
  const baseUrl = process.env[ENV_URL_MAP[providerId] ?? ''];
  return { providerId, modelId, apiKey, baseUrl: baseUrl || undefined, providerType: 'openai' };
}

// ── Keyword-based problem routing ────────────────────────────────

const SCIENCE_SUBJECTS = new Set(['数学', '物理', '化学', '生物', 'math', 'mathematics', 'physics', 'chemistry', 'biology']);
const HUMANITIES_SUBJECTS = new Set(['语文', '英语', '历史', '政治', '地理', 'chinese', 'english', 'history', 'politics', 'geography']);
const SCIENCE_KEYWORDS = ['物理', '化学', '数学', '生物', '力学', '微积分', '代数', '几何', '方程', '计算', '求解', '证明'];
const HUMANITIES_KEYWORDS = ['语文', '英语', '历史', '政治', '地理', '文学', '作文', '阅读', '分析', '论述', '谈谈'];

/** Classify a problem into agent type using keyword heuristics. */
export function classifyProblem(problemText: string, problemSpec?: ProblemSpec | null): SolverAgentType {
  const subject = problemSpec?.subject?.trim().toLowerCase();
  if (subject && SCIENCE_SUBJECTS.has(subject)) return 'science';
  if (subject && HUMANITIES_SUBJECTS.has(subject)) return 'humanities';

  let scienceScore = 0;
  let humanitiesScore = 0;
  for (const kw of SCIENCE_KEYWORDS) if (problemText.includes(kw)) scienceScore++;
  for (const kw of HUMANITIES_KEYWORDS) if (problemText.includes(kw)) humanitiesScore++;
  if (scienceScore > humanitiesScore) return 'science';
  if (humanitiesScore > scienceScore) return 'humanities';
  return 'universal';
}
