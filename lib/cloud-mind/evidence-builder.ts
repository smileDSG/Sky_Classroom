import type { KBStats } from '@/lib/knowledge-base/types';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import { canonicalizeKnowledgePoint } from '@/lib/adaptive-learning/knowledge/knowledge-point-registry';
import type { EvidenceItem } from './types';

function isRecent(timestamp: number | undefined, days: number): boolean {
  if (!timestamp) return false;
  return timestamp >= Date.now() - days * 24 * 60 * 60 * 1000;
}

export function countRecentMistakesByKnowledge(
  mistakes: MistakeBookEntry[],
  days = 7,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const mistake of mistakes) {
    if (mistake.lastReview && !isRecent(mistake.lastReview, days)) continue;
    for (const point of mistake.knowledgePoints) {
      const canonical = canonicalizeKnowledgePoint(point);
      counts.set(canonical.name, (counts.get(canonical.name) ?? 0) + 1);
    }
  }
  return counts;
}

export function buildKnowledgePointEvidence(input: {
  knowledgePoint: string;
  mastery?: number;
  recentMistakeCount?: number;
  dueReviewCount?: number;
  kbStats?: KBStats | null;
}): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];

  if (typeof input.mastery === 'number') {
    evidence.push({
      type: 'profile',
      title: '学情画像',
      summary: `${input.knowledgePoint} 当前掌握度 ${Math.round(input.mastery)}%`,
      sourceId: `profile:${input.knowledgePoint}`,
      confidence: Math.max(0.45, Math.min(0.96, 1 - input.mastery / 140)),
    });
  }

  if ((input.recentMistakeCount ?? 0) > 0) {
    evidence.push({
      type: 'mistake',
      title: '错题证据',
      summary: `最近记录中有 ${input.recentMistakeCount} 次相关错误`,
      sourceId: `mistakes:${input.knowledgePoint}`,
      confidence: Math.min(0.95, 0.55 + (input.recentMistakeCount ?? 0) * 0.08),
    });
  }

  if ((input.dueReviewCount ?? 0) > 0) {
    evidence.push({
      type: 'memory',
      title: '复习证据',
      summary: `有 ${input.dueReviewCount} 条相关复习任务已经到期`,
      sourceId: `reviews:${input.knowledgePoint}`,
      confidence: 0.78,
    });
  }

  if ((input.kbStats?.totalDocuments ?? 0) > 0) {
    evidence.push({
      type: 'knowledge',
      title: '资料依据',
      summary: `知识库已有 ${input.kbStats?.totalDocuments ?? 0} 份资料可用于讲解和出题`,
      sourceId: 'knowledge-base',
      confidence: 0.72,
    });
  }

  return evidence.slice(0, 4);
}

export function buildNewUserEvidence(kbStats?: KBStats | null): EvidenceItem[] {
  const evidence: EvidenceItem[] = [
    {
      type: 'behavior',
      title: '学习起点',
      summary: '当前还没有足够的答题和复习记录',
      sourceId: 'new-user',
      confidence: 0.9,
    },
  ];

  if ((kbStats?.totalDocuments ?? 0) > 0) {
    evidence.push({
      type: 'knowledge',
      title: '资料准备',
      summary: `知识库已有 ${kbStats?.totalDocuments ?? 0} 份资料，可先从资料生成练习`,
      sourceId: 'knowledge-base',
      confidence: 0.75,
    });
  }

  return evidence;
}
