/**
 * Enrichment pipeline — main orchestrator.
 *
 * Flow:
 *   LLM generate questions (DeepSeek) → dedup via SQLite
 *   → solve (reuse solveWithHybrid) → store in SQLite question bank
 *
 * Processes subjects in priority order (数学→物理→化学→生物),
 * generating questions in batches and solving with 5 concurrent workers.
 * Supports checkpoint-based resume for long-running bulk enrichment runs.
 */

import type {
  EnrichJob,
  EnrichJobStats,
  EnrichQuestionResult,
  ExtractedQuestion,
  SubjectId,
  GradeLevel,
} from './types';
import { generateTemplateQuestions } from './template-generator';
import { scrapeQuestions } from './direct-scraper';
import { importLocalFile } from './local-file-importer';
import { saveQuestion, hasProblem } from './sqlite-store';
import { solveWithHybrid } from '../solver-agent';
import { createLogger } from '@/lib/logger';
import {
  MAX_STORE_PER_RUN,
  MAX_CONCURRENT_SOLVES,
  MIN_STORE_CONFIDENCE,
  createEmptyStats,
} from './config';

const log = createLogger('Enrichment:Pipeline');

// ── Subjects processed by the LLM generation flow (priority order) ───

const DEFAULT_LLM_SUBJECTS: SubjectId[] = ['math', 'physics', 'chemistry', 'biology'];

// ── Checkpoint ────────────────────────────────────────────────────────

interface EnrichmentCheckpoint {
  lastSubject: SubjectId;
  lastGradeLevel: GradeLevel;
  totalStored: number;
  totalFailed: number;
  timestamp: number;
}

const CHECKPOINT_PATH = '.data/enrichment-checkpoint.json';

function loadCheckpoint(): EnrichmentCheckpoint | null {
  try {
    const fs = require('fs');
    const data = fs.readFileSync(CHECKPOINT_PATH, 'utf-8');
    const cp = JSON.parse(data) as EnrichmentCheckpoint;
    log.info(`[Checkpoint] Loaded: subject=${cp.lastSubject}, grade=${cp.lastGradeLevel}, stored=${cp.totalStored}`);
    return cp;
  } catch {
    return null;
  }
}

function saveCheckpoint(cp: EnrichmentCheckpoint): void {
  try {
    const fs = require('fs');
    const dir = '.data';
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
    fs.writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2), 'utf-8');
  } catch (err) {
    log.warn(`[Checkpoint] Failed to save: ${err}`);
  }
}

// ── In-memory job state (server lifetime) ────────────────────────────

let currentJob: EnrichJob | null = null;
let lastJob: EnrichJob | null = null;

// ── Single question: solve → store ───────────────────────────────────

/**
 * Process one extracted question through the solve pipeline and store it.
 */
async function processOneQuestion(
  question: ExtractedQuestion,
  stats: EnrichJobStats,
): Promise<EnrichQuestionResult> {
  const result: EnrichQuestionResult = {
    extracted: question,
    solved: false,
    stored: false,
  };

  // Solve using the existing hybrid strategy
  try {
    const agentType = subjectToAgentType(question.subject);
    const { solution, usedAgents } = await solveWithHybrid(
      agentType,
      question.problemText,
      null, // no image
    );

    if (solution.solution && solution.answer) {
      result.solved = true;
      result.solution = solution.solution;
      result.agentType = usedAgents[usedAgents.length - 1] ?? agentType;
      result.solveConfidence = solution.confidence ?? 0.5;

      // Store in SQLite question bank if confidence is sufficient
      if (solution.confidence >= MIN_STORE_CONFIDENCE) {
        // Dedup already happened before solving, so this is always a fresh insert.
        saveQuestion({
          problemText: question.problemText,
          answer: solution.answer,
          solution: solution.solution,
          knowledgePoints: (solution.knowledgePoints ?? []).map((k) => ({
            name: k.name,
            description: k.description,
            difficulty: k.difficulty,
          })),
          subject: question.subject,
          gradeLevel: question.gradeLevel,
          agentId: String(result.agentType ?? 'universal'),
          confidence: solution.confidence ?? 0.5,
          sourceUrl: question.sourceUrl,
        });

        result.stored = true;
        stats.totalStored++;
        if (!stats.bySubject[question.subject]) {
          stats.bySubject[question.subject] = {
            searched: 0, fetched: 0, extracted: 0, solved: 0, stored: 0, failed: 0,
          };
        }
        stats.bySubject[question.subject].stored++;
        log.info(`[Pipeline] Stored: ${question.problemText.slice(0, 60)}...`);
      } else {
        log.info(`[Pipeline] Low confidence (${solution.confidence}), skipping store`);
        stats.totalFailed++;
      }
    } else {
      log.warn(`[Pipeline] Empty solution for: ${question.problemText.slice(0, 60)}`);
      stats.totalFailed++;
    }

    stats.totalSolved++;
    if (stats.bySubject[question.subject]) {
      stats.bySubject[question.subject].solved++;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[Pipeline] Solve failed: ${msg}`);
    result.error = msg;
    stats.totalFailed++;
  }

  return result;
}

// ── Process questions with concurrency limiting ─────────────────────

async function processBatch(
  questions: ExtractedQuestion[],
  stats: EnrichJobStats,
  concurrency: number = MAX_CONCURRENT_SOLVES,
): Promise<EnrichQuestionResult[]> {
  const results: EnrichQuestionResult[] = [];
  const queue = [...questions];

  async function worker() {
    while (queue.length > 0) {
      const q = queue.shift();
      if (!q) break;
      const r = await processOneQuestion(q, stats);
      results.push(r);
    }
  }

  // Run N concurrent workers
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

// ── Subject → agent type mapping ────────────────────────────────────
// NOTE: Always use 'universal' (DeepSeek) since only DeepSeek key is configured.
// The multi-model hybrid fallback (GLM, Qwen) requires separate API keys.
// This avoids "API key required" errors from unavailable providers.

function subjectToAgentType(_subject: SubjectId) {
  return 'universal' as const;
}

// ── Main entry point ────────────────────────────────────────────────

export interface RunEnrichmentOptions {
  /** Specific subjects to run (default: math, physics, chemistry, biology in priority order) */
  subjects?: SubjectId[];
  /** Specific grade levels (default: senior, college) */
  gradeLevels?: GradeLevel[];
  /** Max questions to solve & store */
  maxQuestions?: number;
  /** @internal Bypass the concurrent-run guard for parallel execution */
  _parallel?: boolean;
}

/**
 * Run the full enrichment pipeline using LLM generation + SQLite storage.
 *
 * Processes subjects in priority order. For each subject/grade combination,
 * generates questions via DeepSeek in batches of 20, deduplicates against
 * the SQLite store, solves with 5 concurrent workers, and stores results.
 *
 * Supports checkpoint-based resume: if a checkpoint file exists, the pipeline
 * resumes from the last subject/grade level, picking up where it left off.
 *
 * @returns The completed job with statistics
 */
export async function runEnrichment(opts: RunEnrichmentOptions = {}): Promise<EnrichJob> {
  const {
    subjects = DEFAULT_LLM_SUBJECTS,
    gradeLevels = ['senior', 'college'],
    maxQuestions = MAX_STORE_PER_RUN,
    _parallel = false,
  } = opts;

  // Prevent concurrent runs (skipped for parallel sub-jobs)
  if (!_parallel && currentJob?.status === 'running') {
    log.warn('[Pipeline] Enrichment already running');
    return currentJob;
  }

  const job: EnrichJob = {
    id: `enrich_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'running',
    subject: subjects[0],
    gradeLevels,
    startedAt: Date.now(),
    stats: createEmptyStats(),
  };

  if (!_parallel) {
    currentJob = job;
  }
  log.info(`[Pipeline] Starting enrichment job ${job.id} (target: ${maxQuestions} questions)`);

  // ── Resume from checkpoint ─────────────────────────────────────────
  let resumeSubjectIdx = 0;
  let resumeGradeIdx = 0;

  const cp = loadCheckpoint();
  if (cp) {
    const foundSubjectIdx = subjects.indexOf(cp.lastSubject);
    if (foundSubjectIdx !== -1) {
      resumeSubjectIdx = foundSubjectIdx;
      const foundGradeIdx = gradeLevels.indexOf(cp.lastGradeLevel);
      if (foundGradeIdx !== -1) {
        resumeGradeIdx = foundGradeIdx;
      }
      job.stats.totalStored = cp.totalStored;
      job.stats.totalFailed = cp.totalFailed;
      log.info(`[Pipeline] Resuming from ${cp.lastSubject}/${cp.lastGradeLevel} (${cp.totalStored} already stored)`);
    }
  }

  try {
    const BATCH_SIZE = 20;
    let batchCount = 0;
    const allDatasetQuestions: ExtractedQuestion[] = [];

    for (let si = resumeSubjectIdx; si < subjects.length; si++) {
      const subject = subjects[si];
      if (job.stats.totalStored >= maxQuestions) {
        log.info(`[Pipeline] Reached target (${maxQuestions} stored), stopping`);
        break;
      }

      const gradeStartIdx = si === resumeSubjectIdx ? resumeGradeIdx : 0;

      for (let gi = gradeStartIdx; gi < gradeLevels.length; gi++) {
        const gradeLevel = gradeLevels[gi];
        if (job.stats.totalStored >= maxQuestions) {
          log.info(`[Pipeline] Reached target (${maxQuestions} stored), stopping`);
          break;
        }

        job.subject = subject;

        // Initialize per-subject stats
        if (!job.stats.bySubject[subject]) {
          job.stats.bySubject[subject] = {
            searched: 0, fetched: 0, extracted: 0, solved: 0, stored: 0, failed: 0,
          };
        }

        log.info(`[Pipeline] Processing ${subject}/${gradeLevel} (stored: ${job.stats.totalStored}/${maxQuestions})`);

        // ① Load questions from local datasets — only for the current subject
        const subjectDatasets: Record<SubjectId, Array<{ files: string[]; format: 'tal-scq5k' | 'agieval'; agievalSubject?: SubjectId }>> = {
          math: [{ files: ['.data/tal-scq5k-train.jsonl', '.data/tal-scq5k-test.jsonl'], format: 'tal-scq5k' }],
          physics: [{ files: ['.data/agieval-gaokao-physics.jsonl'], format: 'agieval', agievalSubject: 'physics' as SubjectId }],
          chemistry: [{ files: ['.data/agieval-gaokao-chemistry.jsonl'], format: 'agieval', agievalSubject: 'chemistry' as SubjectId }],
          biology: [{ files: ['.data/agieval-gaokao-biology.jsonl'], format: 'agieval', agievalSubject: 'biology' as SubjectId }],
          chinese: [],
          english: [],
          history: [],
          geography: [],
          politics: [],
        };
        const cfg = subjectDatasets[subject] ?? [];
        for (const c of cfg) {
          for (const file of c.files) {
            try {
              const imported = await importLocalFile({
                filePath: file,
                format: c.format,
                agievalSubject: c.agievalSubject,
              });
              log.info(`[Pipeline] Loaded ${imported.length} from ${file} for ${subject}`);
              allDatasetQuestions.push(...imported);
            } catch (err) {
              log.warn(`[Pipeline] Failed to load ${file}: ${err}`);
            }
          }
        }
        log.info(`[Pipeline] ${subject}: ${allDatasetQuestions.length} dataset questions loaded`);

        let datasetIndex = 0;
        let consecutiveEmptyBatches = 0;

        while (job.stats.totalStored < maxQuestions) {
          // ① Get questions: dataset first → scrape second → templates last
          let generated: ExtractedQuestion[] = [];

          // Use dataset questions (real exam problems) when available
          while (generated.length < BATCH_SIZE && datasetIndex < allDatasetQuestions.length) {
            generated.push(allDatasetQuestions[datasetIndex]);
            datasetIndex++;
          }

          // Scrape for more
          if (generated.length < BATCH_SIZE) {
            const scraped = await scrapeQuestions({
              subject,
              gradeLevel,
              maxQuestions: BATCH_SIZE - generated.length,
            });
            generated = [...generated, ...scraped];
          }

          // Fill gap with templates
          if (generated.length < BATCH_SIZE) {
            const templateCount = BATCH_SIZE - generated.length;
            const templates = generateTemplateQuestions({
              subject,
              gradeLevel,
              count: templateCount,
            });
            generated = [...generated, ...templates];
          }

          if (generated.length === 0) {
            consecutiveEmptyBatches++;
            log.warn(`[Pipeline] Empty batch for ${subject}/${gradeLevel} (${consecutiveEmptyBatches} consecutive)`);
            if (consecutiveEmptyBatches >= 3) {
              log.warn(`[Pipeline] Too many empty batches, moving to next grade/subject`);
              break;
            }
            continue;
          }
          consecutiveEmptyBatches = 0;

          job.stats.totalExtracted += generated.length;
          job.stats.bySubject[subject].extracted += generated.length;

          // ② Dedup against SQLite
          const newQuestions = generated.filter((q) => !hasProblem(q.problemText));
          const dupedCount = generated.length - newQuestions.length;

          if (newQuestions.length === 0) {
            log.info(`[Pipeline] All ${generated.length} questions already stored (dedup)`);
            batchCount++;
            continue;
          }

          // ③ Solve with concurrent workers
          await processBatch(newQuestions, job.stats);

          batchCount++;

          // ④ Log progress
          const subjectStats = job.stats.bySubject[subject];
          log.info(
            `[${subject}] Batch ${batchCount}: ${generated.length} generated → ${dupedCount} duped → ` +
            `${newQuestions.length} new → ${job.stats.totalStored} total stored ` +
            `(${job.stats.totalFailed} failed)`,
          );

          // ⑤ Save checkpoint every 5 batches
          if (batchCount % 5 === 0) {
            saveCheckpoint({
              lastSubject: subject,
              lastGradeLevel: gradeLevel,
              totalStored: job.stats.totalStored,
              totalFailed: job.stats.totalFailed,
              timestamp: Date.now(),
            });
            log.info(`[Checkpoint] Saved: ${job.stats.totalStored} stored, ${job.stats.totalFailed} failed`);
          }

          // ⑥ Brief pause between batches to let LLM breathe
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    job.status = 'completed';
    job.completedAt = Date.now();
    log.info(
      `[Pipeline] Job ${job.id} completed: ${job.stats.totalStored} stored, ${job.stats.totalFailed} failed`,
    );

    // Clear checkpoint on successful completion
    try {
      const fs = require('fs');
      fs.unlinkSync(CHECKPOINT_PATH);
    } catch { /* no checkpoint to clear */ }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[Pipeline] Job ${job.id} failed: ${msg}`);
    job.status = 'failed';
    job.error = msg;

    // Save checkpoint on failure for resume
    if (job.subject && job.gradeLevels.length > 0) {
      saveCheckpoint({
        lastSubject: job.subject,
        lastGradeLevel: job.gradeLevels[0],
        totalStored: job.stats.totalStored,
        totalFailed: job.stats.totalFailed,
        timestamp: Date.now(),
      });
    }
  }

  if (!_parallel) {
    lastJob = job;
    currentJob = null;
  }
  return job;
}

/**
 * Run enrichment for all subjects in parallel.
 *
 * Each subject gets its own job and processes concurrently.
 * Stats from all jobs are merged into a single aggregated result.
 *
 * @returns Aggregated EnrichJob with combined statistics from all subjects
 */
export async function runEnrichmentParallel(opts: RunEnrichmentOptions = {}): Promise<EnrichJob> {
  const {
    subjects = DEFAULT_LLM_SUBJECTS,
    gradeLevels = ['senior', 'college'],
    maxQuestions = MAX_STORE_PER_RUN,
  } = opts;

  // Prevent concurrent runs at the top level
  if (currentJob?.status === 'running') {
    log.warn('[Pipeline] Enrichment already running');
    return currentJob;
  }

  const aggregatedJob: EnrichJob = {
    id: `enrich_parallel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'running',
    subject: subjects[0],
    gradeLevels,
    startedAt: Date.now(),
    stats: createEmptyStats(),
  };

  currentJob = aggregatedJob;
  log.info(`[Pipeline:Parallel] Starting parallel enrichment for ${subjects.length} subjects`);

  const perSubjectMax = Math.ceil(maxQuestions / subjects.length);

  const jobPromises = subjects.map((subject) =>
    runEnrichment({
      subjects: [subject],
      gradeLevels,
      maxQuestions: perSubjectMax,
      _parallel: true,
    }),
  );

  const results = await Promise.allSettled(jobPromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const job = result.value;
      aggregatedJob.stats.totalSearched += job.stats.totalSearched;
      aggregatedJob.stats.totalFetched += job.stats.totalFetched;
      aggregatedJob.stats.totalExtracted += job.stats.totalExtracted;
      aggregatedJob.stats.totalSolved += job.stats.totalSolved;
      aggregatedJob.stats.totalStored += job.stats.totalStored;
      aggregatedJob.stats.totalFailed += job.stats.totalFailed;

      for (const [subj, subStats] of Object.entries(job.stats.bySubject)) {
        if (!aggregatedJob.stats.bySubject[subj]) {
          aggregatedJob.stats.bySubject[subj] = {
            searched: 0, fetched: 0, extracted: 0, solved: 0, stored: 0, failed: 0,
          };
        }
        const agg = aggregatedJob.stats.bySubject[subj];
        agg.searched += subStats.searched;
        agg.fetched += subStats.fetched;
        agg.extracted += subStats.extracted;
        agg.solved += subStats.solved;
        agg.stored += subStats.stored;
        agg.failed += subStats.failed;
      }
    } else {
      log.error(`[Pipeline:Parallel] Subject job failed: ${result.reason}`);
    }
  }

  aggregatedJob.status = 'completed';
  aggregatedJob.completedAt = Date.now();
  log.info(
    `[Pipeline:Parallel] Completed: ${aggregatedJob.stats.totalStored} stored, ${aggregatedJob.stats.totalFailed} failed`,
  );

  lastJob = aggregatedJob;
  currentJob = null;
  return aggregatedJob;
}

/**
 * Get current enrichment status.
 */
export function getEnrichmentStatus() {
  return {
    isRunning: currentJob?.status === 'running',
    currentJob,
    lastJob,
    totalStored: lastJob?.stats?.totalStored ?? 0,
  };
}

/**
 * Get detailed enrichment progress including estimates.
 */
export function getEnrichmentProgress() {
  const now = Date.now();
  const elapsed = currentJob?.startedAt ? now - currentJob.startedAt : 0;

  const totalStored = currentJob?.stats?.totalStored ?? lastJob?.stats?.totalStored ?? 0;
  const totalSolved = currentJob?.stats?.totalSolved ?? lastJob?.stats?.totalSolved ?? 0;
  const totalFailed = currentJob?.stats?.totalFailed ?? lastJob?.stats?.totalFailed ?? 0;
  const bySubject = currentJob?.stats?.bySubject ?? lastJob?.stats?.bySubject ?? {};
  const currentSubject = currentJob?.subject ?? null;

  let estimatedRemainingMs = 0;
  if (totalStored > 0 && elapsed > 0) {
    const rate = totalStored / elapsed; // questions per ms
    const remaining = MAX_STORE_PER_RUN - totalStored;
    estimatedRemainingMs = rate > 0 ? remaining / rate : 0;
  }

  return {
    totalStored,
    totalSolved,
    totalFailed,
    bySubject,
    currentSubject,
    elapsedMs: elapsed,
    estimatedRemainingMs,
  };
}
