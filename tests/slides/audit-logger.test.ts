import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createAudit,
  getAudit,
  startStep,
  endStep,
  errorStep,
  recordLLMCall,
  finalizeAudit,
  getAuditSummary,
} from '@/lib/slides/agent/audit-logger';

describe('Audit Logger', () => {
  const jobId = 'test-job-001';
  const topic = '光合作用';
  const difficulty = '高中';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('creates an audit record', () => {
    const audit = createAudit(jobId, topic, difficulty);
    expect(audit.jobId).toBe(jobId);
    expect(audit.topic).toBe(topic);
    expect(audit.difficulty).toBe(difficulty);
    expect(audit.finalStatus).toBe('running');
    expect(audit.steps).toEqual([]);
    expect(audit.llmCalls).toEqual([]);
  });

  it('retrieves an audit by jobId', () => {
    createAudit(jobId, topic, difficulty);
    const retrieved = getAudit(jobId);
    expect(retrieved).toBeTruthy();
    expect(retrieved?.jobId).toBe(jobId);
  });

  it('returns undefined for non-existent job', () => {
    const retrieved = getAudit('non-existent');
    expect(retrieved).toBeUndefined();
  });

  it('records steps with timing', () => {
    createAudit(jobId, topic, difficulty);

    startStep(jobId, 'planning');
    vi.advanceTimersByTime(1000);
    endStep(jobId, 'planning');

    const audit = getAudit(jobId)!;
    expect(audit.steps).toHaveLength(1);
    expect(audit.steps[0].name).toBe('planning');
    expect(audit.steps[0].status).toBe('done');
    expect(audit.steps[0].durationMs).toBe(1000);
  });

  it('records error steps', () => {
    createAudit(jobId, topic, difficulty);

    startStep(jobId, 'planning');
    vi.advanceTimersByTime(500);
    errorStep(jobId, 'planning', '大纲生成失败');

    const audit = getAudit(jobId)!;
    expect(audit.steps[0].status).toBe('error');
    expect(audit.steps[0].error).toBe('大纲生成失败');
    expect(audit.steps[0].durationMs).toBe(500);
  });

  it('records multiple sequential steps', () => {
    createAudit(jobId, topic, difficulty);

    startStep(jobId, 'planning');
    vi.advanceTimersByTime(1000);
    endStep(jobId, 'planning');

    startStep(jobId, 'sections');
    vi.advanceTimersByTime(2000);
    endStep(jobId, 'sections');

    const audit = getAudit(jobId)!;
    expect(audit.steps).toHaveLength(2);
    expect(audit.steps[0].name).toBe('planning');
    expect(audit.steps[1].name).toBe('sections');
  });

  it('auto-closes previous running step when starting new one', () => {
    createAudit(jobId, topic, difficulty);

    startStep(jobId, 'planning');
    vi.advanceTimersByTime(1000);
    startStep(jobId, 'sections'); // should auto-close planning

    const audit = getAudit(jobId)!;
    expect(audit.steps[0].status).toBe('done');
    expect(audit.steps[0].durationMs).toBe(1000);
    expect(audit.steps[1].status).toBe('running');
  });

  it('records LLM calls', () => {
    createAudit(jobId, topic, difficulty);

    recordLLMCall(jobId, 'planning', 'deepseek-v4-pro', 5000, 1200, 800);
    recordLLMCall(jobId, 'page_design_1', 'deepseek-v4-pro', 3000, 500, 400);

    const audit = getAudit(jobId)!;
    expect(audit.llmCalls).toHaveLength(2);
    expect(audit.llmCalls[0].step).toBe('planning');
    expect(audit.llmCalls[0].promptTokens).toBe(1200);
    expect(audit.llmCalls[0].completionTokens).toBe(800);
    expect(audit.llmCalls[1].step).toBe('page_design_1');
  });

  it('finalizes audit with success status', () => {
    createAudit(jobId, topic, difficulty);

    startStep(jobId, 'planning');
    vi.advanceTimersByTime(1000);
    endStep(jobId, 'planning');

    const finalized = finalizeAudit(jobId, 'success', {
      pageCount: 20,
      qaScore: 85,
      qaPassed: true,
      designDNA: { styleName: '测试风格', mood: '专业', density: 'moderate' },
    });

    expect(finalized?.finalStatus).toBe('success');
    expect(finalized?.pageCount).toBe(20);
    expect(finalized?.qaScore).toBe(85);
    expect(finalized?.qaPassed).toBe(true);
    expect(finalized?.totalDurationMs).toBeDefined();
    expect(finalized?.endedAt).toBeDefined();
  });

  it('finalizes audit with error status', () => {
    createAudit(jobId, topic, difficulty);
    startStep(jobId, 'planning');

    const finalized = finalizeAudit(jobId, 'error', {
      error: 'LLM 调用失败',
      designDNA: { styleName: '测试', mood: '测试', density: 'sparse' },
    });

    expect(finalized?.finalStatus).toBe('error');
    expect(finalized?.error).toBe('LLM 调用失败');
  });

  it('auto-closes running step on finalize', () => {
    createAudit(jobId, topic, difficulty);
    startStep(jobId, 'planning');
    vi.advanceTimersByTime(1000);

    finalizeAudit(jobId, 'success');

    const audit = getAudit(jobId)!;
    expect(audit.steps[0].status).toBe('done');
    expect(audit.steps[0].durationMs).toBe(1000);
  });

  it('getAuditSummary returns formatted string', () => {
    createAudit(jobId, topic, difficulty);
    startStep(jobId, 'planning');
    vi.advanceTimersByTime(1000);
    endStep(jobId, 'planning');
    recordLLMCall(jobId, 'planning', 'deepseek', 5000, 100, 200);
    finalizeAudit(jobId, 'success', { pageCount: 15, qaScore: 90, qaPassed: true });

    const summary = getAuditSummary(jobId);
    expect(summary).toContain('Audit Summary');
    expect(summary).toContain(jobId);
    expect(summary).toContain(topic);
    expect(summary).toContain('planning');
    expect(summary).toContain('deepseek');
    expect(summary).toContain('PASS');
  });

  it('returns no-audit message for unknown job in summary', () => {
    const summary = getAuditSummary('unknown');
    expect(summary).toContain('No audit found');
  });
});
