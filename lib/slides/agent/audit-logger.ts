/**
 * Audit Logger — structured, per-job logging for the PPT generation pipeline.
 *
 * Collects timing, decisions, LLM token usage, and errors across all stages.
 * Outputs JSON for downstream analysis and debugging.
 */
import { createLogger } from '@/lib/logger';

const log = createLogger('AuditLogger');

// ── Types ────────────────────────────────────────────────────────────

export interface AuditStep {
  name: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  status: 'running' | 'done' | 'error';
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLLMCall {
  step: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs: number;
  timestamp: number;
}

export interface AuditRecord {
  jobId: string;
  topic: string;
  difficulty: string;
  startedAt: number;
  endedAt?: number;
  totalDurationMs?: number;
  designDNA?: {
    styleName: string;
    mood: string;
    density: string;
    layoutType?: string;
  };
  steps: AuditStep[];
  llmCalls: AuditLLMCall[];
  finalStatus: 'success' | 'error' | 'running';
  error?: string;
  pageCount?: number;
  qaScore?: number;
  qaPassed?: boolean;
}

// ── In-memory store ──────────────────────────────────────────────────

const audits = new Map<string, AuditRecord>();

// Background cleanup: remove audits older than 30 min
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, audit] of audits) {
    if (audit.endedAt && audit.endedAt < cutoff) {
      audits.delete(id);
    }
  }
}, 60_000);

// ── Public API ───────────────────────────────────────────────────────

export function createAudit(jobId: string, topic: string, difficulty: string): AuditRecord {
  const audit: AuditRecord = {
    jobId,
    topic,
    difficulty,
    startedAt: Date.now(),
    steps: [],
    llmCalls: [],
    finalStatus: 'running',
  };
  audits.set(jobId, audit);
  log.info(`[Audit:${jobId}] created — topic="${topic}" difficulty="${difficulty}"`);
  return audit;
}

export function getAudit(jobId: string): AuditRecord | undefined {
  return audits.get(jobId);
}

export function startStep(jobId: string, name: string, metadata?: Record<string, unknown>): void {
  const audit = audits.get(jobId);
  if (!audit) return;

  // Close any previous running step
  const prev = audit.steps[audit.steps.length - 1];
  if (prev && prev.status === 'running') {
    prev.endedAt = Date.now();
    prev.durationMs = prev.endedAt - prev.startedAt;
    prev.status = 'done';
  }

  audit.steps.push({
    name,
    startedAt: Date.now(),
    status: 'running',
    metadata,
  });

  log.info(`[Audit:${jobId}] step START — ${name}`, metadata ?? '');
}

export function endStep(jobId: string, name: string, metadata?: Record<string, unknown>): void {
  const audit = audits.get(jobId);
  if (!audit) return;

  const step = audit.steps.find((s) => s.name === name && s.status === 'running');
  if (!step) return;

  step.endedAt = Date.now();
  step.durationMs = step.endedAt - step.startedAt;
  step.status = 'done';
  if (metadata) step.metadata = { ...step.metadata, ...metadata };

  log.info(`[Audit:${jobId}] step DONE — ${name} (${step.durationMs}ms)`, metadata ?? '');
}

export function errorStep(jobId: string, name: string, error: string): void {
  const audit = audits.get(jobId);
  if (!audit) return;

  let step = audit.steps.find((s) => s.name === name && s.status === 'running');
  if (!step) {
    // Fallback: find the most recent running step if exact name not found
    step = [...audit.steps].reverse().find((s) => s.status === 'running');
  }
  if (step) {
    step.endedAt = Date.now();
    step.durationMs = step.endedAt - step.startedAt;
    step.status = 'error';
    step.error = error;
  } else {
    // No running step — create a synthetic error step so the error is not lost
    audit.steps.push({
      name,
      startedAt: Date.now(),
      endedAt: Date.now(),
      durationMs: 0,
      status: 'error',
      error,
    });
  }

  log.error(`[Audit:${jobId}] step ERROR — ${name}: ${error}`);
}

export function recordLLMCall(
  jobId: string,
  step: string,
  model: string,
  durationMs: number,
  promptTokens?: number,
  completionTokens?: number,
): void {
  const audit = audits.get(jobId);
  if (!audit) return;

  audit.llmCalls.push({
    step,
    model,
    promptTokens,
    completionTokens,
    durationMs,
    timestamp: Date.now(),
  });

  log.info(
    `[Audit:${jobId}] LLM — ${step} model=${model} tokens=${promptTokens ?? '?'}+${completionTokens ?? '?'} duration=${durationMs}ms`,
  );
}

export function finalizeAudit(
  jobId: string,
  status: 'success' | 'error',
  options?: {
    error?: string;
    pageCount?: number;
    qaScore?: number;
    qaPassed?: boolean;
    designDNA?: AuditRecord['designDNA'];
  },
): AuditRecord | undefined {
  const audit = audits.get(jobId);
  if (!audit) return;

  // Close any running step with the appropriate final status
  const prev = audit.steps[audit.steps.length - 1];
  if (prev && prev.status === 'running') {
    prev.endedAt = Date.now();
    prev.durationMs = prev.endedAt - prev.startedAt;
    prev.status = status === 'error' ? 'error' : 'done';
  }

  audit.endedAt = Date.now();
  audit.totalDurationMs = audit.endedAt - audit.startedAt;
  audit.finalStatus = status;

  if (options?.error) audit.error = options.error;
  if (options?.pageCount !== undefined) audit.pageCount = options.pageCount;
  if (options?.qaScore !== undefined) audit.qaScore = options.qaScore;
  if (options?.qaPassed !== undefined) audit.qaPassed = options.qaPassed;
  if (options?.designDNA) audit.designDNA = options.designDNA;

  log.info(`[Audit:${jobId}] FINALIZE — status=${status} duration=${audit.totalDurationMs}ms`, {
    pageCount: audit.pageCount,
    qaScore: audit.qaScore,
    qaPassed: audit.qaPassed,
    steps: audit.steps.map((s) => ({ name: s.name, durationMs: s.durationMs })),
    llmCalls: audit.llmCalls.length,
  });

  return audit;
}

export function getAuditSummary(jobId: string): string {
  const audit = audits.get(jobId);
  if (!audit) return `No audit found for job ${jobId}`;

  const lines = [
    `=== Audit Summary: ${jobId} ===`,
    `Topic: ${audit.topic} | Difficulty: ${audit.difficulty}`,
    `Status: ${audit.finalStatus} | Duration: ${audit.totalDurationMs}ms`,
    `Pages: ${audit.pageCount ?? '?'} | QA: ${audit.qaScore ?? '?'}/100 ${audit.qaPassed ? 'PASS' : 'FAIL'}`,
    `LLM Calls: ${audit.llmCalls.length}`,
    'Steps:',
    ...audit.steps.map(
      (s) =>
        `  ${s.name}: ${s.durationMs ?? '?'}ms ${s.status === 'error' ? `[ERROR: ${s.error}]` : ''}`,
    ),
    'LLM Details:',
    ...audit.llmCalls.map(
      (c) =>
        `  ${c.step}: ${c.model} | ${c.durationMs}ms | ${c.promptTokens ?? '?'}→${c.completionTokens ?? '?'}`,
    ),
    '================================',
  ];

  return lines.join('\n');
}
