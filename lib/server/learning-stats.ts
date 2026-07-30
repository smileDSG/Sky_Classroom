/**
 * Shared learning-stats computation used by:
 * - app/api/sky/learning-stats/route.ts
 * - lib/teaching/learning-path-context.ts
 */

import { getServerStorage } from '@/lib/server/server-storage';
import { createUserStatsDAO } from '@/lib/storage/dao/user-stats';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { buildKnowledgeGraph } from '@/lib/knowledge-graph';
import { createLogger } from '@/lib/logger';
import type { LearningStatsResponse } from '@/lib/teaching/learning-path-types';

const log = createLogger('LearningStats');

const CHECKIN_TABLE = 'user_checkins';

interface CheckInEntry {
  userId: string;
  date: string;
  timestamp: number;
}

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function mistakeCauseFromErrorType(
  errorType: 'calculation' | 'concept' | 'reasoning' | 'reading' | 'careless',
): string {
  const map: Record<string, string> = {
    calculation: 'calculation-error',
    concept: 'concept-unclear',
    reasoning: 'method-wrong',
    reading: 'misreading',
    careless: 'careless',
  };
  return map[errorType] ?? 'concept-unclear';
}

/**
 * Build a LearningStatsResponse for the given user.
 * Computes study time, streak, check-in status, and mastery from the knowledge graph.
 */
export async function getLearningStats(userId: string): Promise<LearningStatsResponse> {
  const storage = await getServerStorage();
  const statsDAO = createUserStatsDAO(storage);
  const mistakeDAO = createMistakeBookDAO(storage);

  const stats = await statsDAO.getOrCreate(userId);

  // ── Checked in today ──
  const todayStr = getTodayStr();
  const checkInEntry = await storage.get<CheckInEntry>(CHECKIN_TABLE, `${userId}_${todayStr}`);
  const checkedInToday = !!checkInEntry?.data;

  // ── Calculate mastery from knowledge states and knowledge graph ──
  let masteryPercent = 0;
  try {
    const knowledgeStateDAO = createKnowledgeStateDAO(storage);
    const knowledgeStates = await knowledgeStateDAO.list(userId);

    if (knowledgeStates.length > 0) {
      const totalMastery = knowledgeStates.reduce((sum, state) => sum + state.mastery, 0);
      masteryPercent = Math.round((totalMastery / knowledgeStates.length) * 100);
    } else {
      // Fallback to the legacy knowledge graph when no event-driven states exist yet.
      const mistakesResult = await mistakeDAO.list(userId, { pageSize: 1000 });
      if (mistakesResult.items.length > 0) {
        const clientMistakes = mistakesResult.items.map((entry) => ({
          id: entry.id,
          problem: entry.problemText,
          userAnswer: entry.userAnswer,
          correctAnswer: entry.correctAnswer,
          cause: mistakeCauseFromErrorType(entry.errorType) as any,
          solvedAt: entry.lastReview ? new Date(entry.lastReview) : new Date(),
          reviewed: entry.reviewed,
          reviewCount: entry.reviewCount,
          knowledgePoints: entry.knowledgePoints ?? [],
        }));
        const graph = buildKnowledgeGraph(clientMistakes);
        if (graph.nodes.length > 0) {
          const totalMastery = graph.nodes.reduce((sum, node) => sum + node.mastery, 0);
          masteryPercent = Math.round(totalMastery / graph.nodes.length);
        }
      }
    }
  } catch (err) {
    log.error('Failed to calculate mastery:', err);
  }

  return {
    todayStudyMinutes: Math.round((stats.studySeconds / 60) * 10) / 10,
    streakDays: stats.checkinStreak,
    masteryPercent,
    checkedInToday,
    problemsAttempted: stats.problemsAttempted,
    problemsCorrect: stats.problemsCorrect,
    scenesCompleted: stats.scenesCompleted,
  };
}
