/**
 * D-001 Student Profile — Aggregation Engine
 *
 * Builds a StudentProfile by combining:
 * - User stats from the unified storage (problemsAttempted/problemsCorrect)
 * - Mistake data via buildKnowledgeGraph (knowledge mastery, weakPoints)
 * - Error pattern analysis from mistake records
 *
 * Includes a 5-minute in-memory cache that invalidates on answer submission.
 */

import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { buildKnowledgeGraph, getMasterySummary } from '@/lib/mistakes/knowledge-graph';
import type { MistakeRecord } from '@/lib/mistakes/types';
import type { MistakeCause } from '@/lib/solve/types';
import type { Subject } from '@/lib/solve/agents/analyze-types';
import type { StudentProfile, ErrorPattern, ProfileCacheEntry } from './profile-types';
import { createLogger } from '@/lib/logger';

const log = createLogger('StudentProfile');

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, ProfileCacheEntry>();

// ── Error type mapping ────────────────────────────────────────────

function mistakeCauseFromErrorType(
  errorType: 'calculation' | 'concept' | 'reasoning' | 'reading' | 'careless',
): MistakeCause {
  switch (errorType) {
    case 'calculation':
      return 'calculation-error';
    case 'concept':
      return 'concept-unclear';
    case 'reasoning':
      return 'method-wrong';
    case 'reading':
      return 'misreading';
    case 'careless':
      return 'careless';
  }
}

// ── Subject inference from knowledge point name ───────────────────

function inferSubject(kp: string): Subject {
  if (/方程|函数|代数|几何|三角|概率|统计|微积分|数列/.test(kp)) return 'math';
  if (/力|电|磁|光|热|原子|牛顿|能量|动量|速度|加速度/.test(kp)) return 'physics';
  if (/元素|反应|化学键|摩尔|氧化还原|离子|溶液|有机/.test(kp)) return 'chemistry';
  if (/细胞|基因|生态|遗传|酶|蛋白质|DNA|进化/.test(kp)) return 'biology';
  if (/诗|词|文言|修辞|作文|标点|病句/.test(kp)) return 'chinese';
  if (/语法|时态|从句|单词|阅读.*英/.test(kp)) return 'english';
  if (/朝代|事件|人物|革命|战争|条约/.test(kp)) return 'history';
  if (/地形|气候|洋流|人口|城市|资源/.test(kp)) return 'geography';
  if (/政治|经济|哲学|法律|文化|社会/.test(kp)) return 'politics';
  return 'unknown';
}

// ── Cache helpers ─────────────────────────────────────────────────

function getCached(userId: string): StudentProfile | null {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    cache.delete(userId);
    return null;
  }
  return entry.profile;
}

function setCached(userId: string, profile: StudentProfile) {
  cache.set(userId, { profile, cachedAt: Date.now() });
}

export function invalidateProfileCache(userId: string) {
  cache.delete(userId);
}

// ── Profile builder ───────────────────────────────────────────────

/**
 * Build a complete StudentProfile for the given user.
 * Uses the unified storage (MySQL/Supabase/memory) on the server side.
 */
export async function buildStudentProfile(userId: string): Promise<StudentProfile> {
  const cached = getCached(userId);
  if (cached) return cached;

  const storage = await getServerStorage();
  const mistakeDAO = createMistakeBookDAO(storage);

  // Fetch all mistakes
  const { items: mistakes } = await mistakeDAO.list({ pageSize: 9999 });
  log.info(`Building profile for ${userId}: ${mistakes.length} mistakes loaded`);

  // Build knowledge graph from mistakes
  const kgMistakes: MistakeRecord[] = mistakes.map((m) => ({
    id: m.id,
    problem: m.problemText,
    userAnswer: m.userAnswer,
    correctAnswer: m.correctAnswer,
    cause: mistakeCauseFromErrorType(m.errorType),
    solvedAt: new Date(m.lastReview ?? Date.now()),
    reviewed: m.reviewed,
    reviewCount: m.reviewCount,
    knowledgePoints: m.knowledgePoints,
  }));

  const graph = buildKnowledgeGraph(kgMistakes);
  const masterySummary = getMasterySummary(graph);

  // Build masteryByKnowledge from graph nodes
  const masteryByKnowledge: Record<string, number> = {};
  for (const node of graph.nodes) {
    masteryByKnowledge[node.name] = node.mastery;
  }

  // Build masteryBySubject by grouping knowledge points
  const subjectTotals = new Map<Subject, { sum: number; count: number }>();
  for (const node of graph.nodes) {
    const subject = inferSubject(node.name);
    if (!subjectTotals.has(subject)) {
      subjectTotals.set(subject, { sum: 0, count: 0 });
    }
    const entry = subjectTotals.get(subject)!;
    entry.sum += node.mastery;
    entry.count += 1;
  }
  const masteryBySubject: Record<Subject, number> = {} as Record<Subject, number>;
  const allSubjects: Subject[] = [
    'math',
    'physics',
    'chemistry',
    'biology',
    'chinese',
    'english',
    'history',
    'geography',
    'politics',
  ];
  for (const subj of allSubjects) {
    const data = subjectTotals.get(subj);
    masteryBySubject[subj] = data ? Math.round(data.sum / data.count) : 0;
  }

  // Weak/strong points from graph
  const weakPoints = graph.nodes.filter((n) => n.mastery < 30).map((n) => n.id);
  const strongPoints = graph.nodes.filter((n) => n.mastery > 80).map((n) => n.id);

  // Error patterns: group by (knowledgePoint, cause)
  const errorPatternMap = new Map<string, ErrorPattern>();
  for (const m of mistakes) {
    const cause = mistakeCauseFromErrorType(m.errorType);
    const lastOccurrence = new Date(m.lastReview ?? Date.now());
    for (const kp of m.knowledgePoints) {
      const key = `${kp}:${cause}`;
      if (errorPatternMap.has(key)) {
        const pattern = errorPatternMap.get(key)!;
        pattern.frequency += 1;
        if (lastOccurrence > pattern.lastOccurrence) {
          pattern.lastOccurrence = lastOccurrence;
        }
      } else {
        errorPatternMap.set(key, {
          knowledgePoint: kp,
          errorType: cause,
          frequency: 1,
          lastOccurrence,
        });
      }
    }
  }
  const errorPatterns = Array.from(errorPatternMap.values());

  // Aggregate totals
  const totalQuestions = graph.nodes.reduce((sum, n) => sum + n.problemCount, 0);
  const totalCorrect = Math.max(0, totalQuestions - mistakes.length);

  const profile: StudentProfile = {
    userId,
    masteryBySubject,
    masteryByKnowledge,
    weakPoints,
    strongPoints,
    errorPatterns,
    totalQuestions,
    totalCorrect,
    lastUpdated: new Date(),
  };

  setCached(userId, profile);
  return profile;
}
