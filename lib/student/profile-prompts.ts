/**
 * D-001-c Student Profile — Prompt Context Builder
 *
 * Serializes a StudentProfile into a concise, LLM-friendly context string
 * that can be injected into prompts for quiz / memory-card / teaching agents.
 */

import type { StudentProfile } from './profile-types';

export interface ProfilePromptOptions {
  /** Max weak points to include (default 5) */
  maxWeakPoints?: number;
  /** Max strong points to include (default 5) */
  maxStrongPoints?: number;
  /** Max error patterns to include (default 3) */
  maxErrorPatterns?: number;
  /** Include recent quiz performance summary (default true) */
  includeRecent?: boolean;
  /** Include per-knowledge-point mastery for the listed points (default true) */
  includeKnowledgeMastery?: boolean;
  /** Knowledge points to highlight (e.g. current section's points) */
  highlightKnowledgePoints?: string[];
}

/**
 * Build a standardized learning-profile context block for LLM prompts.
 */
export function buildProfileContextPrompt(
  profile: StudentProfile,
  options: ProfilePromptOptions = {},
): string {
  const {
    maxWeakPoints = 5,
    maxStrongPoints = 5,
    maxErrorPatterns = 3,
    includeRecent = true,
    includeKnowledgeMastery = true,
    highlightKnowledgePoints,
  } = options;

  const weakPoints = profile.weakPoints.slice(0, maxWeakPoints);
  const strongPoints = profile.strongPoints.slice(0, maxStrongPoints);
  const errorPatterns = profile.errorPatterns
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, maxErrorPatterns);

  const overallAccuracy =
    profile.totalQuestions > 0
      ? Math.round((profile.totalCorrect / profile.totalQuestions) * 100)
      : 0;

  let context = `## 学生学情\n`;
  context += `- 总答题数：${profile.totalQuestions}，正确数：${profile.totalCorrect}，整体正确率：${overallAccuracy}%\n`;

  if (weakPoints.length > 0) {
    context += `\n### 薄弱知识点（需重点强化）\n`;
    for (const kp of weakPoints) {
      const mastery = profile.masteryByKnowledge[kp] ?? 0;
      context += includeKnowledgeMastery ? `- ${kp}（掌握度 ${mastery}%）\n` : `- ${kp}\n`;
    }
  }

  if (strongPoints.length > 0) {
    context += `\n### 已掌握知识点（可快速复习或跳过基础）\n`;
    for (const kp of strongPoints) {
      const mastery = profile.masteryByKnowledge[kp] ?? 0;
      context += includeKnowledgeMastery ? `- ${kp}（掌握度 ${mastery}%）\n` : `- ${kp}\n`;
    }
  }

  if (errorPatterns.length > 0) {
    context += `\n### 高频错误模式\n`;
    for (const ep of errorPatterns) {
      context += `- ${ep.knowledgePoint}：${ep.errorType}（${ep.frequency}次）\n`;
    }
  }

  if (includeRecent && profile.recentQuizPerformance) {
    const r = profile.recentQuizPerformance;
    context += `\n### 近期测验表现（最近7天）\n`;
    context += `- 整体正确率：${r.overallAccuracy}%\n`;
    context += `- 高频错因：${r.topErrorCauses.join('、') || '无'}\n`;
    const depthText =
      r.recommendedDepthShift === 'deeper'
        ? '可适当提升深度'
        : r.recommendedDepthShift === 'shallower'
          ? '建议降低深度、夯实基础'
          : '保持当前深度';
    context += `- 深度建议：${depthText}\n`;
  }

  if (highlightKnowledgePoints && highlightKnowledgePoints.length > 0) {
    context += `\n### 本节涉及知识点掌握度\n`;
    for (const kp of highlightKnowledgePoints) {
      const mastery = profile.masteryByKnowledge[kp];
      if (mastery !== undefined) {
        const level = mastery < 30 ? '薄弱' : mastery > 80 ? '已掌握' : '需强化';
        context += `- ${kp}：${mastery}%（${level}）\n`;
      }
    }
  }

  return context;
}
