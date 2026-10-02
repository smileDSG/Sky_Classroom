/**
 * Daily suggestion generator for the Star Tips dashboard.
 * Pure function — takes mistakes + stats, returns actionable suggestions.
 */

import type { MistakeRecord } from './types';
import { buildKnowledgeGraph } from './knowledge-graph';

export interface Suggestion {
  icon: string;
  text: string;
  action: { label: string; href: string };
}

interface QuickStats {
  streakDays: number;
  masteryPercent: number;
}

const CAUSE_LABELS: Record<string, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  misreading: '审题错误',
  'method-wrong': '方法错误',
  careless: '粗心',
  'format-error': '格式错误',
};

// 注: 原先这里有MILESTONE_NAMES（铜星/银星/金星…）配合"解锁XX徽章"话术，
// 与 PRD R-1/R-2「不做奖励徽章」冲突，已连同话术一并移除（2026-10-02）。

function getTopCause(mistakes: MistakeRecord[]): string {
  const counts = new Map<string, number>();
  for (const m of mistakes) {
    counts.set(m.cause, (counts.get(m.cause) ?? 0) + 1);
  }
  let top = '';
  let max = 0;
  for (const [cause, count] of counts) {
    if (count > max) {
      max = count;
      top = cause;
    }
  }
  return CAUSE_LABELS[top] ?? '综合';
}

export function generateSuggestions(mistakes: MistakeRecord[], stats: QuickStats): Suggestion[] {
  if (mistakes.length === 0) {
    return [
      {
        icon: '📸',
        text: '还没有学习记录，拍照搜题开始你的第一次练习吧！',
        action: { label: '去搜题', href: '/sky/cloud-mind/solve' },
      },
    ];
  }

  const suggestions: Suggestion[] = [];

  // ── 1. Weakest knowledge point ────────────────────────────────
  const graph = buildKnowledgeGraph(mistakes);
  const weakest = graph.nodes
    .filter((n) => n.mastery < 50)
    .sort((a, b) => a.mastery - b.mastery)[0];

  if (weakest) {
    const topCause = getTopCause(mistakes.filter((m) => m.knowledgePoints.includes(weakest.name)));
    suggestions.push({
      icon: '📌',
      text: `你的"${weakest.name}"掌握度仅 ${weakest.mastery}%，错因集中在${topCause}，建议今天重点复习`,
      action: {
        label: '去复习',
        href: `/sky/cloud-mind/memory?topic=${encodeURIComponent(weakest.name)}`,
      },
    });
  }

  // ── 2. Streak milestone approaching ───────────────────────────
  // PRD R-1/R-2：不做奖励徽章 / 虚拟奖励。这里改为**中性回顾**，
  // 只陈述"你已经连续学了 N 天"这个事实 + 明天继续的落点，
  // 不许诺"再坚持 X 天就能解锁 Y 徽章"这类奖励化表达。
  const streakMilestones = [3, 7, 14, 30, 60, 100];
  const nextMilestone = streakMilestones.find((m) => m > stats.streakDays);
  if (nextMilestone && nextMilestone - stats.streakDays <= 3) {
    suggestions.push({
      icon: '🔥',
      text:
        stats.streakDays > 0
          ? `已经连续学习 ${stats.streakDays} 天了，今天再复习一点，把这个节奏接住就好。`
          : '今天还没有学习记录，从一道错题开始就挺好。',
      action: { label: '去复习', href: '/sky/learning/mistakes' },
    });
  }

  // ── 3. Low mastery outlier ────────────────────────────────────
  const avgMastery = graph.nodes.reduce((s, n) => s + n.mastery, 0) / graph.nodes.length;
  const outliers = graph.nodes.filter((n) => n.mastery < avgMastery * 0.6 && n !== weakest);
  if (outliers.length > 0) {
    const target = outliers[0];
    suggestions.push({
      icon: '📊',
      text: `"${target.name}"掌握度 ${target.mastery}%，显著低于平均 ${avgMastery}%，推荐做 ${Math.min(target.problemCount, 5)} 道同类题`,
      action: {
        label: '去出题',
        href: `/sky/cloud-mind/quiz?topic=${encodeURIComponent(target.name)}`,
      },
    });
  }

  // ── 4. Due for review ─────────────────────────────────────────
  const now = Date.now();
  const dueToday = mistakes.filter((m) => !m.reviewed && (!m.nextReview || m.nextReview <= now));
  if (dueToday.length > 0) {
    suggestions.push({
      icon: '⏰',
      text: `今天有 ${dueToday.length} 道题需要复习，花 10 分钟巩固一下吧`,
      action: { label: '去复习', href: '/sky/cloud-mind/memory' },
    });
  }

  // ── 5. Recent mistake surge ───────────────────────────────────
  const oneDayAgo = now - 86400000;
  const todayMistakes = mistakes.filter((m) => new Date(m.solvedAt).getTime() > oneDayAgo);
  if (todayMistakes.length >= 5) {
    suggestions.push({
      icon: '💡',
      text: `今天搜了 ${todayMistakes.length} 道题，记得休息一下，劳逸结合效果更好`,
      action: { label: '学习记录', href: '/sky/learning/profile-dashboard' },
    });
  }

  // ── 6. Mastery improvement ────────────────────────────────────
  if (stats.masteryPercent >= 70 && graph.nodes.length >= 3) {
    suggestions.push({
      icon: '🌟',
      text: `知识掌握度已达 ${stats.masteryPercent}%，保持这个节奏，争取全面掌握！`,
      action: { label: '查看图谱', href: '/sky/learning/graph' },
    });
  }

  return suggestions.slice(0, 3);
}
