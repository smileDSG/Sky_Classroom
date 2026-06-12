/**
 * D-001 Student Profile — Aggregation Engine
 *
 * Builds a StudentProfile by combining:
 * - User stats from the unified storage (problemsAttempted/problemsCorrect)
 * - Mistake data via buildKnowledgeGraph (knowledge mastery, weakPoints)
 * - Error pattern analysis from mistake records
 *
 * Includes disk-based cache with 30-minute TTL for persistence across restarts.
 */

import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { buildKnowledgeGraph, getMasterySummary } from '@/lib/mistakes/knowledge-graph';
import { inferSubject } from '@/lib/mistakes/subject-inference';
import type { MistakeRecord } from '@/lib/mistakes/types';
import type { MistakeCause } from '@/lib/solve/types';
import type { Subject } from '@/lib/solve/agents/analyze-types';
import type { StudentProfile, ErrorPattern, ProfileCacheEntry } from './profile-types';
import { analyzeQuizPerformance } from './quiz-performance-analyzer';
import { createLogger } from '@/lib/logger';
import { promises as fs } from 'fs';
import path from 'path';

const log = createLogger('StudentProfile');

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_DIR = path.join(process.cwd(), 'data', 'student-profiles');

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

    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
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

async function setCached(userId: string, profile: StudentProfile) {
  try {
    await ensureCacheDir();
    const cachePath = getCachePath(userId);
    const entry: ProfileCacheEntry = { profile, cachedAt: Date.now() };
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
  const cached = await getCached(userId);
  if (cached) {
    log.info(`Profile cache hit for ${userId}`);
    return cached;
  }

  log.info(`Profile cache miss for ${userId}, building...`);
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
