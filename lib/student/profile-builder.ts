/**
 * D-001 Student Profile — Aggregation Engine
 *
 * Builds a StudentProfile by combining:
 * - User stats from the unified storage (problemsAttempted/problemsCorrect)
 * - Mistake data for error patterns and review workload
 * - Error pattern analysis from mistake records
 *
 * Includes disk-based cache with 30-minute TTL for persistence across restarts.
 */

import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { inferSubject } from '@/lib/mistakes/subject-inference';
import { createQuizAttemptDAO } from './quiz-attempts';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { getCurriculumPack } from '@/lib/adaptive-learning/curriculum/registry';
import type { MistakeCause } from '@/lib/solve/types';
import type { Subject } from '@/lib/solve/agents/analyze-types';
import {
  STUDENT_PROFILE_CACHE_VERSION,
  type StudentProfile,
  type ErrorPattern,
  type ProfileCacheEntry,
} from './profile-types';
import { analyzeQuizPerformance } from './quiz-performance-analyzer';
import { createLogger } from '@/lib/logger';
import { ensureDemoLearningData } from '@/lib/demo/admin-mistake-seed';
import { canonicalizeKnowledgePoint } from '@/lib/adaptive-learning/knowledge/knowledge-point-registry';
import { promises as fs } from 'fs';
import path from 'path';

export { inferSubject };

const log = createLogger('StudentProfile');

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_DIR = path.join(process.cwd(), 'data', 'student-profiles');
const ADMIN_DEMO_USER_ID = 'admin-default';
const ADMIN_DEMO_SOURCE_ID = 'default-user';

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

function addMasterySample<K extends string>(
  target: Map<K, { correct: number; total: number }>,
  key: K,
  isCorrect: boolean,
): void {
  const entry = target.get(key) ?? { correct: 0, total: 0 };
  entry.total += 1;
  if (isCorrect) entry.correct += 1;
  target.set(key, entry);
}

// ── Cache helpers ─────────────────────────────────────────────────

async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }
}

function getCachePath(userId: string): string {
  // Sanitize userId for filename
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(CACHE_DIR, `${safeId}.json`);
}

async function getCached(userId: string): Promise<StudentProfile | null> {
  try {
    const cachePath = getCachePath(userId);
    const data = await fs.readFile(cachePath, 'utf-8');
    const entry: ProfileCacheEntry = JSON.parse(data);

    if (
      entry.cacheVersion !== STUDENT_PROFILE_CACHE_VERSION ||
      Date.now() - entry.cachedAt > CACHE_TTL_MS
    ) {
      // Cache expired, delete file
      await fs.unlink(cachePath).catch(() => {});
      return null;
    }

    // Restore Date objects
    entry.profile.lastUpdated = new Date(entry.profile.lastUpdated);
    for (const pattern of entry.profile.errorPatterns) {
      pattern.lastOccurrence = new Date(pattern.lastOccurrence);
    }

    return entry.profile;
  } catch {
    return null;
  }
}

async function getAdminDemoProfile(): Promise<StudentProfile | null> {
  try {
    const data = await fs.readFile(getCachePath(ADMIN_DEMO_SOURCE_ID), 'utf-8');
    const entry: ProfileCacheEntry = JSON.parse(data);
    if (entry.cacheVersion !== STUDENT_PROFILE_CACHE_VERSION) return null;
    entry.profile.lastUpdated = new Date(entry.profile.lastUpdated);
    entry.profile.errorPatterns = entry.profile.errorPatterns.map((pattern) => ({
      ...pattern,
      lastOccurrence: new Date(pattern.lastOccurrence),
    }));
    return { ...entry.profile, userId: ADMIN_DEMO_USER_ID };
  } catch {
    return null;
  }
}

async function setCached(userId: string, profile: StudentProfile) {
  try {
    await ensureCacheDir();
    const cachePath = getCachePath(userId);
    const entry: ProfileCacheEntry = {
      profile,
      cachedAt: Date.now(),
      cacheVersion: STUDENT_PROFILE_CACHE_VERSION,
    };
    await fs.writeFile(cachePath, JSON.stringify(entry, null, 2), 'utf-8');
  } catch (err) {
    log.warn('Failed to write profile cache:', err);
  }
}

export async function invalidateProfileCache(userId: string) {
  try {
    const cachePath = getCachePath(userId);
    await fs.unlink(cachePath).catch(() => {});
  } catch {
    // Ignore
  }
}

// ── Profile builder ───────────────────────────────────────────────

/**
 * Build a complete StudentProfile for the given user.
 * Uses the unified storage (MySQL/Supabase/memory) on the server side.
 */
export async function buildStudentProfile(userId: string): Promise<StudentProfile> {
  const storage = await getServerStorage();
  const demoSeed = await ensureDemoLearningData(userId, storage);
  if (demoSeed.changed) {
    await invalidateProfileCache(userId);
  }

  const cached = await getCached(userId);
  if (cached && (userId !== ADMIN_DEMO_USER_ID || cached.totalQuestions > 0)) {
    log.info(`Profile cache hit for ${userId}`);
    return cached;
  }

  if (userId === ADMIN_DEMO_USER_ID) {
    const demoProfile = await getAdminDemoProfile();
    if (demoProfile) {
      await setCached(userId, demoProfile);
      return demoProfile;
    }
  }

  log.info(`Profile cache miss for ${userId}, building...`);
  const mistakeDAO = createMistakeBookDAO(storage);
  const quizAttemptDAO = createQuizAttemptDAO(storage);
  const knowledgeStateDAO = createKnowledgeStateDAO(storage);

  // Fetch all learning signals
  const [{ items: mistakes }, quizAttempts, knowledgeStates] = await Promise.all([
    mistakeDAO.list(userId, { pageSize: 9999 }),
    quizAttemptDAO.list({ userId }),
    knowledgeStateDAO.list(userId),
  ]);
  log.info(
    `Building profile for ${userId}: ${mistakes.length} mistakes, ` +
      `${quizAttempts.length} quiz attempts, ${knowledgeStates.length} knowledge states loaded`,
  );

  const quizKnowledgeStats = new Map<
    string,
    { name: string; correct: number; total: number }
  >();
  const quizSubjectStats = new Map<Subject, { correct: number; total: number }>();
  for (const attempt of quizAttempts) {
    for (const question of attempt.questions) {
      addMasterySample(quizSubjectStats, attempt.subject, question.isCorrect);
      const points =
        question.knowledgePoints.length > 0
          ? question.knowledgePoints
          : attempt.topic
            ? [attempt.topic]
            : ['综合练习'];
      for (const point of points) {
        const canonical = canonicalizeKnowledgePoint(point);
        const stat = quizKnowledgeStats.get(canonical.id) ?? {
          name: canonical.name,
          correct: 0,
          total: 0,
        };
        stat.total += 1;
        if (question.isCorrect) stat.correct += 1;
        quizKnowledgeStats.set(canonical.id, stat);
      }
    }
  }

  // Mastery comes from assessed evidence. Mistakes remain error evidence and
  // review tasks; they must not independently label a concept as mastered.
  const masteryByKnowledge: Record<string, number> = {};
  for (const stat of quizKnowledgeStats.values()) {
    const quizMastery = Math.round((stat.correct / stat.total) * 100);
    masteryByKnowledge[stat.name] = quizMastery;
  }

  const curriculumNodes = new Map(
    getCurriculumPack('gaokao-math-2026.1').nodes.map((node) => [node.id, node]),
  );
  const projectedStates = new Map<
    string,
    {
      name: string;
      subject: Subject;
      mastery: number;
      evidenceCount: number;
      lastEvidenceAt: number;
    }
  >();

  // Old hashed node IDs and new canonical concept IDs can coexist during
  // migration. Keep one projection per concept, preferring the richer state.
  for (const state of knowledgeStates) {
    const node = curriculumNodes.get(state.nodeId);
    const canonical = node
      ? { id: node.id, name: node.name, subject: 'math' as Subject }
      : canonicalizeKnowledgePoint(state.displayName ?? state.nodeId);
    const subject: Subject =
      canonical.subject === 'computer-science' || canonical.subject === 'artificial-intelligence'
        ? 'unknown'
        : canonical.subject;
    const candidate = {
      name: canonical.name,
      subject,
      mastery: Math.round(state.mastery * 100),
      evidenceCount: state.evidenceCount,
      lastEvidenceAt: new Date(state.lastEvidenceAt ?? state.lastReviewedAt ?? 0).getTime(),
    };
    const current = projectedStates.get(canonical.id);
    if (
      !current ||
      candidate.evidenceCount > current.evidenceCount ||
      (candidate.evidenceCount === current.evidenceCount &&
        candidate.lastEvidenceAt > current.lastEvidenceAt)
    ) {
      projectedStates.set(canonical.id, candidate);
    }
  }

  const mappedStateMasteries = new Map<Subject, number[]>();
  for (const projection of projectedStates.values()) {
    masteryByKnowledge[projection.name] = projection.mastery;
    const subjectMasteries = mappedStateMasteries.get(projection.subject) ?? [];
    subjectMasteries.push(projection.mastery);
    mappedStateMasteries.set(projection.subject, subjectMasteries);
  }

  // Build masteryBySubject from quiz evidence, then let knowledge states take
  // precedence for subjects that have unified evidence.
  const subjectTotals = new Map<Subject, { sum: number; count: number }>();
  for (const [subject, stat] of quizSubjectStats) {
    if (!subjectTotals.has(subject)) {
      subjectTotals.set(subject, { sum: 0, count: 0 });
    }
    const entry = subjectTotals.get(subject)!;
    entry.sum += Math.round((stat.correct / stat.total) * 100);
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
    'unknown',
  ];
  for (const subj of allSubjects) {
    const stateMasteries = mappedStateMasteries.get(subj);
    if (stateMasteries && stateMasteries.length > 0) {
      masteryBySubject[subj] = Math.round(
        stateMasteries.reduce((sum, mastery) => sum + mastery, 0) / stateMasteries.length,
      );
      continue;
    }
    const data = subjectTotals.get(subj);
    masteryBySubject[subj] = data ? Math.round(data.sum / data.count) : 0;
  }

  // Weak/strong points from the unified mastery projection.
  const weakPoints = Object.entries(masteryByKnowledge)
    .filter(([, mastery]) => mastery < 30)
    .map(([point]) => point);
  const strongPoints = Object.entries(masteryByKnowledge)
    .filter(([, mastery]) => mastery > 80)
    .map(([point]) => point);

  // Error patterns: group by (knowledgePoint, cause)
  const errorPatternMap = new Map<string, ErrorPattern>();
  for (const m of mistakes) {
    const cause = mistakeCauseFromErrorType(m.errorType);
    const lastOccurrence = new Date(m.lastReview ?? Date.now());
    for (const kp of m.knowledgePoints) {
      const canonical = canonicalizeKnowledgePoint(kp);
      const key = `${canonical.id}:${cause}`;
      if (errorPatternMap.has(key)) {
        const pattern = errorPatternMap.get(key)!;
        pattern.frequency += 1;
        if (lastOccurrence > pattern.lastOccurrence) {
          pattern.lastOccurrence = lastOccurrence;
        }
      } else {
        errorPatternMap.set(key, {
          knowledgePoint: canonical.name,
          errorType: cause,
          frequency: 1,
          lastOccurrence,
        });
      }
    }
  }
  const errorPatterns = Array.from(errorPatternMap.values());

  // Aggregate totals
  const mistakeQuestionTotal = mistakes.length;
  const quizQuestionTotal = quizAttempts.reduce((sum, attempt) => sum + attempt.total, 0);
  const quizCorrectTotal = quizAttempts.reduce((sum, attempt) => sum + attempt.correct, 0);
  const totalQuestions = mistakeQuestionTotal + quizQuestionTotal;
  const totalCorrect = quizCorrectTotal;

  // Build recent quiz performance summary (async, non-blocking on failure)
  let recentQuizPerformance: StudentProfile['recentQuizPerformance'];
  try {
    recentQuizPerformance = await analyzeQuizPerformance(userId, { recentDays: 7 });
  } catch {
    recentQuizPerformance = undefined;
  }

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
    recentQuizPerformance,
  };

  await setCached(userId, profile);
  return profile;
}
