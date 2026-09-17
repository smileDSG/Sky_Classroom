/**
 * Pipeline — orchestrates the full PPT generation flow.
 *
 * Planning → Section Agents (concurrent) → Page Design Agents (concurrent)
 * → Merge → LibreOffice preview PNGs.
 */
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import pptxgen from 'pptxgenjs';
import { planOutline, type Outline } from './planning-agent';
import { generateSectionContent, type SectionOutput } from './section-agent';
import { designPage } from './page-design-agent';
import { instructionExecutor, type PageInstructions } from './instruction-executor';
import { generatePreviewFromPptx } from '../pptx-preview';
import { runQA, type QAReport } from './qa-agent';
import { acquireGenerationSlot } from '@/lib/server/generation-gate';
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { DesignDNA } from './design-dna';
import { withConcurrencyLimit } from './concurrency';
import { callLLM } from '@/lib/ai/llm';
import { buildThemeFromDesignDNA } from '@/lib/slides/pptx-themes';
import {
  buildTemplateDeckBuffer,
  generateTemplateDeckContent,
  summarizeTemplatePages,
} from '@/lib/slides/template-deck';
import type { PptxThemeId } from '@/lib/slides/types';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import {
  buildSlidesPromptDirective,
  type SlidesAdaptivePolicy,
} from '@/lib/slides/personalization';
import {
  createAudit,
  startStep,
  endStep,
  errorStep,
  recordLLMCall,
  finalizeAudit,
} from './audit-logger';

const log = createLogger('Pipeline');

// ── Types ────────────────────────────────────────────────────────────

export interface GenerateOptions {
  topic: string;
  difficulty: string;
  minPages: number;
  maxPages: number;
  designDNA: DesignDNA;
  languageModel: LanguageModel;
  jobId: string;
  /** Target audience education level from user personalization */
  educationLevel?: string;
  /** Server-resolved learner-profile policy. Never trust a client-provided policy here. */
  personalization?: SlidesAdaptivePolicy;
}

export type PipelineStage =
  | 'planning'
  | 'sections_generating'
  | 'pages_designing'
  | 'merging'
  | 'qa_reviewing'
  | 'repairing'
  | 'done';

export interface JobOutlinePage {
  pageNum: number;
  title: string;
  type: string;
}

export interface StageTiming {
  startAt: number;
  endAt?: number;
  durationMs?: number;
}

export interface JobState {
  jobId: string;
  userId?: string;
  cancelled?: boolean;
  stage: PipelineStage;
  pipelineMode?: 'openmaic' | 'legacy';
  message: string;
  progress: number;
  totalPages: number;
  /** Full outline (available after planning stage) */
  outline?: JobOutlinePage[];
  /** Currently active page being designed */
  currentPage?: JobOutlinePage;
  /** Pages whose content has been generated (available after sections stage) */
  completedSlides?: JobOutlinePage[];
  pptxUrl?: string;
  fileName?: string;
  previewImages?: string[];
  qaReport?: {
    totalScore: number;
    pass: boolean;
    issues: Array<{
      pageNum: number;
      severity: string;
      type: string;
      layer: string;
      detail: string;
    }>;
  };
  error?: string;
  /** Per-stage timing for accurate ETA estimation */
  stageTimings?: Record<string, StageTiming>;
  /** Overall pipeline start timestamp */
  startedAt?: number;
  /** Overall pipeline end timestamp */
  finishedAt?: number;
  /** Learner-profile strategy used for this generation. */
  personalization?: SlidesAdaptivePolicy;
}

// ── Job Manager ──────────────────────────────────────────────────────
// Use globalThis to survive Turbopack HMR module reloads in dev mode.
// In production each request shares the same process, so this is safe too.
const _global = globalThis as Record<string, unknown>;
if (!_global.__pptJobs) _global.__pptJobs = new Map<string, JobState>();
if (!_global.__pptDoneTs) _global.__pptDoneTs = new Map<string, number>();
const jobs = _global.__pptJobs as Map<string, JobState>;
const _doneTimestamps = _global.__pptDoneTs as Map<string, number>;

export function createJob(jobId: string, totalPages?: number, userId?: string): JobState {
  const now = Date.now();
  const state: JobState = {
    jobId,
    userId,
    stage: 'planning',
    message: '正在规划课程大纲...',
    progress: 0,
    totalPages: totalPages || 0,
    startedAt: now,
    stageTimings: { planning: { startAt: now } },
  };
  jobs.set(jobId, state);
  return state;
}

export function getJob(jobId: string): JobState | undefined {
  return jobs.get(jobId);
}

export function listAllJobs(): Array<JobState & { doneAt?: number }> {
  const result: Array<JobState & { doneAt?: number }> = [];
  for (const [id, job] of jobs) {
    const clone = { ...job };
    const doneAt = _doneTimestamps.get(id);
    if (doneAt) (clone as Record<string, unknown>).doneAt = doneAt;
    result.push(clone);
  }
  // Sort by most recent first
  return result.sort((a, b) => {
    const aTime = (a as unknown as { doneAt?: number }).doneAt || 0;
    const bTime = (b as unknown as { doneAt?: number }).doneAt || 0;
    return bTime - aTime;
  });
}

const DIAGNOSTIC_LOG_PATH = path.join(process.cwd(), 'logs', 'pipeline-diagnostic.log');
function logToFile(level: string, tag: string, message: string) {
  try {
    const line = `[${new Date().toISOString()}] [${level}] [${tag}] ${message}\n`;
    fsSync.appendFileSync(DIAGNOSTIC_LOG_PATH, line);
  } catch {
    /* ignore */
  }
}

export function updateJob(jobId: string, update: Partial<JobState>) {
  const job = jobs.get(jobId);
  if (!job) return;
  if (job.cancelled) return;

  // Auto-track stage timing when stage changes
  const newStage = update.stage;
  if (newStage && newStage !== job.stage && job.stageTimings) {
    const now = Date.now();
    // Close current stage
    const currentTiming = job.stageTimings[job.stage];
    if (currentTiming && !currentTiming.endAt) {
      currentTiming.endAt = now;
      currentTiming.durationMs = now - currentTiming.startAt;
      logToFile(
        'INFO',
        'PipelineTiming',
        `${jobId} stage=${job.stage} duration=${currentTiming.durationMs}ms`,
      );
    }
    // Open new stage
    if (!job.stageTimings[newStage]) {
      job.stageTimings[newStage] = { startAt: now };
    }
  }

  Object.assign(job, update);
}

export function cancelJob(jobId: string, userId: string): JobState | undefined {
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId || job.stage === 'done') return undefined;

  updateJob(jobId, {
    cancelled: true,
    stage: 'done',
    message: '课件生成已取消',
    error: '用户取消了生成',
    finishedAt: Date.now(),
  });
  return jobs.get(jobId);
}

// Max concurrent pipeline jobs (safety valve against resource exhaustion)
const MAX_CONCURRENT_JOBS = 5;

export function getActiveJobCount(): number {
  let count = 0;
  for (const job of jobs.values()) {
    if (job.stage !== 'done') count++;
  }
  return count;
}

// Background cleanup: remove jobs that have been done for > 2 hours
setInterval(() => {
  const cutoff = Date.now() - 120 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.stage === 'done') {
      const doneAt = _doneTimestamps.get(id);
      if (!doneAt) {
        _doneTimestamps.set(id, Date.now()); // First time seeing it done, skip
      } else if (doneAt < cutoff) {
        jobs.delete(id);
        _doneTimestamps.delete(id);
      }
    }
    if (job.stage === 'done' && job.error) {
      // Error jobs: keep for 2 min
      const errAt = _doneTimestamps.get(id);
      if (!errAt) _doneTimestamps.set(id, Date.now());
      else if (errAt < Date.now() - 2 * 60 * 1000) {
        jobs.delete(id);
        _doneTimestamps.delete(id);
      }
    }
  }
}, 60_000);

// ── Pipeline ─────────────────────────────────────────────────────────

export async function runPipeline(options: GenerateOptions): Promise<void> {
  const {
    topic,
    difficulty,
    minPages,
    maxPages,
    designDNA,
    languageModel,
    jobId,
    educationLevel,
    personalization,
  } = options;

  // Initialize audit
  createAudit(jobId, topic, difficulty);
  startStep(jobId, 'planning');
  if (personalization) updateJob(jobId, { personalization });

  // Global multi-user concurrency gate: queue instead of hard-rejecting when
  // too many heavy pipelines are already running (see generation-gate.ts).
  const releaseGenerationSlot = await acquireGenerationSlot(() => {
    updateJob(jobId, { message: '排队等待生成...', progress: 0 });
  });

  try {
    if (process.env.SKY_SLIDES_LEGACY_PIPELINE !== 'true') {
      const openMaicResult = await runOpenMaicSlidesPipeline(options);
      endStep(jobId, 'planning', {
        totalPages: openMaicResult.totalPages,
        mode: 'openmaic-element-level',
      });
      finalizeAudit(jobId, 'success', {
        pageCount: openMaicResult.totalPages,
        designDNA: {
          styleName: designDNA.styleName,
          mood: designDNA.mood,
          density: designDNA.decoration.density,
          layoutType: designDNA.layoutType,
        },
      });
      log.info(
        `[Pipeline:${jobId}] 天空课堂 complete: ${openMaicResult.pptxUrl} (${openMaicResult.totalPages} pages)`,
      );
      return;
    }

    const publicDir = path.resolve(process.cwd(), 'public');
    const outputDir = path.join(publicDir, 'temp', 'pptx');
    await fs.mkdir(outputDir, { recursive: true });

    // ══ Step 1: Planning ══
    updateJob(jobId, {
      stage: 'planning',
      pipelineMode: 'legacy',
      message: '正在规划课程大纲...',
      progress: 5,
    });
    // Heartbeat: slowly increment progress while LLM runs
    let planningHeartbeat: ReturnType<typeof setInterval> | null = null;
    let planResult: Awaited<ReturnType<typeof planOutline>> | undefined;
    try {
      planningHeartbeat = setInterval(() => {
        const job = getJob(jobId);
        if (job && job.stage === 'planning' && job.progress < 30) {
          updateJob(jobId, { progress: job.progress + 1 });
        }
      }, 10000); // +1% every 10s, up to 30%
      planResult = await planOutline(
        topic,
        difficulty,
        minPages,
        maxPages,
        designDNA,
        languageModel,
        educationLevel,
      );

      // Retry once on transient connection errors
      if (
        !planResult.success &&
        planResult.error &&
        /terminated|timeout|aborted|ECONNRESET|ETIMEDOUT/i.test(planResult.error)
      ) {
        log.warn(
          `[Pipeline:${jobId}] Planning failed with "${planResult.error}", retrying once...`,
        );
        updateJob(jobId, { message: '大纲规划遇到网络波动，正在重试...', progress: 3 });
        await new Promise((r) => setTimeout(r, 3000));
        planResult = await planOutline(
          topic,
          difficulty,
          minPages,
          maxPages,
          designDNA,
          languageModel,
          educationLevel,
        );
      }

      // Record planning LLM call (approximate from no direct access — logged in planning-agent)
      clearInterval(planningHeartbeat);
      planningHeartbeat = null;

      if (!planResult.success || !planResult.outline) {
        errorStep(jobId, 'planning', planResult.error || '大纲规划失败');
        finalizeAudit(jobId, 'error', {
          error: planResult.error || '大纲规划失败',
          designDNA: {
            styleName: designDNA.styleName,
            mood: designDNA.mood,
            density: designDNA.decoration.density,
            layoutType: designDNA.layoutType,
          },
        });
        updateJob(jobId, { stage: 'done', progress: 0, error: planResult.error || '大纲规划失败' });
        return;
      }
    } finally {
      if (planningHeartbeat) clearInterval(planningHeartbeat);
    }

    endStep(jobId, 'planning', {
      totalPages: planResult.totalPages,
      sections: planResult.outline.sections.length,
    });

    const outline = planResult.outline;
    const outlinePages = outline.sections.flatMap((s) =>
      s.pages.map((p) => ({ pageNum: p.pageNum, title: p.title, type: p.type })),
    );
    // eslint-disable-next-line no-console
    console.log(
      `[Pipeline:${jobId}] Planning done. outlinePages count=${outlinePages.length}, totalPages=${planResult.totalPages}`,
    );
    updateJob(jobId, {
      stage: 'planning',
      message: `大纲规划完成，共 ${outline.sections.length} 章节 ${planResult.totalPages} 页`,
      progress: 15,
      totalPages: planResult.totalPages,
      outline: outlinePages,
    });

    // ══ Step 2: Section Agents (concurrent, capped) ══
    startStep(jobId, 'sections', { sectionCount: outline.sections.length });
    updateJob(jobId, {
      stage: 'sections_generating',
      message: `正在生成 ${outline.sections.length} 个章节内容...`,
      progress: 20,
    });
    let sectionsHeartbeat: ReturnType<typeof setInterval> | null = null;
    let completedSections = 0;
    try {
      sectionsHeartbeat = setInterval(() => {
        const job = getJob(jobId);
        if (job && job.stage === 'sections_generating' && job.progress < 35) {
          updateJob(jobId, { progress: job.progress + 1 });
        }
      }, 8000);

      const sectionResults = await withConcurrencyLimit(
        outline.sections,
        4, // Reduced from 12 to avoid provider-side connection saturation / termination
        async (section, idx) => {
          const nextSectionTitle = outline.sections[idx + 1]?.title;
          let result = await generateSectionContent(
            section,
            topic,
            difficulty,
            designDNA,
            languageModel,
            nextSectionTitle,
            educationLevel,
          );
          // Retry once on transient connection errors (terminated / timeout)
          if (
            !result.success &&
            result.error &&
            /terminated|timeout|aborted|ECONNRESET|ETIMEDOUT/i.test(result.error)
          ) {
            log.warn(
              `[Pipeline:${jobId}] Section ${idx} "${section.title}" failed with "${result.error}", retrying once...`,
            );
            await new Promise((r) => setTimeout(r, 3000));
            result = await generateSectionContent(
              section,
              topic,
              difficulty,
              designDNA,
              languageModel,
              nextSectionTitle,
              educationLevel,
            );
          }
          completedSections++;
          const sectionPages = section.pages.map((p) => ({
            pageNum: p.pageNum,
            title: p.title || `第 ${p.pageNum} 页`,
            type: p.type,
          }));
          const job = getJob(jobId);
          const baseSlides = job?.completedSlides || [];
          const sectionPageNums = new Set(sectionPages.map((s) => s.pageNum));
          const mergedSlides = baseSlides
            .filter((s) => !sectionPageNums.has(s.pageNum))
            .concat(sectionPages);
          mergedSlides.sort((a, b) => a.pageNum - b.pageNum);

          updateJob(jobId, {
            message: `章节内容：${completedSections}/${outline.sections.length} — 第 ${idx + 1} 章「${section.title}」${result.success ? '✓' : '✗ 降级'} `,
            progress: 20 + Math.round((completedSections / outline.sections.length) * 20),
            completedSlides: mergedSlides,
          });
          return result;
        },
        900_000,
        300, // Stagger start by 300ms to smooth out connection spikes
      );

      clearInterval(sectionsHeartbeat);
      sectionsHeartbeat = null;
      endStep(jobId, 'sections', { completedSections, totalSections: outline.sections.length });

      // Strict: no fallback allowed — either all sections succeed or fail the pipeline
      const allContent: SectionOutput[] = [];
      for (let i = 0; i < sectionResults.length; i++) {
        const result = sectionResults[i];
        if (!result.success || !result.output) {
          throw new Error(
            `Section ${i} "${outline.sections[i].title}" failed: ${result.error || 'unknown error'}`,
          );
        }
        allContent.push(result.output);
      }

      // Flatten all pages
      const allPages = allContent.flatMap((s) => s.pages).sort((a, b) => a.pageNum - b.pageNum);

      updateJob(jobId, {
        stage: 'pages_designing',
        message: `正在设计 ${allPages.length} 页幻灯片排版...`,
        progress: 42,
        completedSlides: [],
      });

      // ══ Step 3: Page Design Agents (concurrent, capped) ══
      startStep(jobId, 'page_design', { pageCount: allPages.length });
      // Track per-page completion for real progress feedback
      let designedPages = 0;
      log.info(
        `[Pipeline:${jobId}] Starting page design for ${allPages.length} pages with concurrency=12 stagger=100ms`,
      );
      const designResults = await withConcurrencyLimit(
        allPages,
        12,
        async (page) => {
          // Mark current page being designed
          updateJob(jobId, {
            currentPage: {
              pageNum: page.pageNum,
              title: (page.content?.title as string) || `第 ${page.pageNum} 页`,
              type: page.pageType,
            },
          });

          const designStart = Date.now();
          log.info(`[Pipeline:${jobId}] Designing page ${page.pageNum} (${page.pageType})`);
          const result = await designPage(
            page.pageNum,
            page.pageType,
            page.content,
            allPages.length,
            designDNA,
            languageModel,
            educationLevel,
          );
          const designDuration = Date.now() - designStart;
          log.info(
            `[Pipeline:${jobId}] Page ${page.pageNum} design done in ${designDuration}ms, success=${result.success}`,
          );
          // Note: token info not directly available from designPage; would need to pass through
          recordLLMCall(jobId, `page_design_${page.pageNum}`, 'design-page', designDuration);
          designedPages++;

          // Build completed slides up to this point
          const job = getJob(jobId);
          const baseSlides = job?.completedSlides || [];
          const alreadyIn = new Set(baseSlides.map((s) => s.pageNum));
          const newSlides = baseSlides.slice();
          if (!alreadyIn.has(page.pageNum)) {
            newSlides.push({
              pageNum: page.pageNum,
              title: (page.content?.title as string) || `第 ${page.pageNum} 页`,
              type: page.pageType,
            });
            newSlides.sort((a, b) => a.pageNum - b.pageNum);
          }

          updateJob(jobId, {
            message: `页面排版：${designedPages}/${allPages.length} — 第 ${page.pageNum} 页 (${page.pageType}) ${result.success ? '✓' : '✗ 降级'}`,
            progress: 42 + Math.round((designedPages / allPages.length) * 28),
            completedSlides: newSlides,
            currentPage: undefined,
          });
          return { pageNum: page.pageNum, result };
        },
        900_000,
        150,
      );
      log.info(
        `[Pipeline:${jobId}] All page design completed. Failed: ${designResults.filter((dr) => !dr.result.success).length}`,
      );

      // Handle any pages that used fallback layouts (designPage now auto-fallbacks instead of failing)
      const fallbackDesigns = designResults.filter((dr) => dr.result.fallback);
      if (fallbackDesigns.length > 0) {
        const fallbackPages = fallbackDesigns.map((dr) => `第${dr.pageNum}页`).join(', ');
        log.warn(`[Pipeline:${jobId}] Pages using fallback layout: ${fallbackPages}`);
      }
      // Safety: designPage should always return pageInstructions, but guard against future changes
      const instructions: PageInstructions[] = designResults
        .filter((dr) => dr.result.pageInstructions)
        .map((dr) => dr.result.pageInstructions!);

      endStep(jobId, 'page_design', { designedPages, totalPages: allPages.length });
      updateJob(jobId, { stage: 'qa_reviewing', message: '正在质检：结构检查...', progress: 72 });

      // ══ Step 4: Full QA (structural + content via LLM) ══
      startStep(jobId, 'qa');
      const qaReport = await runQA(
        topic,
        difficulty,
        outline,
        allContent,
        allPages.length,
        languageModel,
        instructions,
        educationLevel,
      );

      endStep(jobId, 'qa', {
        score: qaReport.totalScore,
        passed: qaReport.pass,
        issueCount: qaReport.issues.length,
      });
      updateJob(jobId, {
        stage: 'qa_reviewing',
        message: `质检完成：评分 ${qaReport.totalScore}，${qaReport.pass ? '通过' : '需修复'} (${qaReport.issues.length} 个问题)`,
        progress: 78,
        qaReport,
      });

      // ══ Step 5: Repair structural issues (no LLM) ══
      const structuralIssues = qaReport.issues.filter((i) => i.layer === 'structural');
      startStep(jobId, 'repair', { structuralIssueCount: structuralIssues.length });
      if (structuralIssues.length > 0) {
        updateJob(jobId, {
          stage: 'repairing',
          message: `正在修复 ${structuralIssues.length} 个结构问题...`,
          progress: 80,
        });

        for (const issue of structuralIssues) {
          const idx = instructions.findIndex((x) => x.pageNum === issue.pageNum);

          if (issue.type === 'missing_cover' || issue.type === 'missing_end') {
            if (idx >= 0) {
              instructions[idx] = {
                pageNum: issue.pageNum,
                instructions: [
                  { op: 'setBackground', params: { color: designDNA.colors.coverBg } },
                  {
                    op: 'addText',
                    params: {
                      text:
                        issue.pageNum === 1
                          ? (allPages[0]?.content?.title as string) || topic || '封面'
                          : '课程结束',
                      x: 1,
                      y: 2,
                      w: 11.3,
                      h: 2,
                      fontSize: 36,
                      fontFace: designDNA.fonts.heading,
                      color: designDNA.colors.textOnDark,
                      bold: true,
                      align: 'center',
                      valign: 'middle',
                    },
                  },
                ],
              };
            }
          } else if (issue.type === 'missing_instructions' && idx < 0) {
            // Inject a minimal instruction set for pages that have none
            instructions.push({
              pageNum: issue.pageNum,
              instructions: [
                { op: 'setBackground', params: { color: designDNA.colors.contentBg } },
                {
                  op: 'addText',
                  params: {
                    text:
                      (allPages.find((p) => p.pageNum === issue.pageNum)?.content
                        ?.title as string) || `第 ${issue.pageNum} 页`,
                    x: 1,
                    y: 2,
                    w: 11.3,
                    h: 2,
                    fontSize: 28,
                    fontFace: designDNA.fonts.heading,
                    color: designDNA.colors.textPrimary,
                    bold: true,
                    align: 'center',
                    valign: 'middle',
                  },
                },
              ],
            });
          } else if (issue.type === 'empty_content' && idx >= 0) {
            // Ensure the page has at least a title text
            const hasText = instructions[idx].instructions.some((inst) => inst.op === 'addText');
            if (!hasText) {
              instructions[idx].instructions.push({
                op: 'addText',
                params: {
                  text:
                    (allPages.find((p) => p.pageNum === issue.pageNum)?.content?.title as string) ||
                    `第 ${issue.pageNum} 页`,
                  x: 1,
                  y: 2,
                  w: 11.3,
                  h: 2,
                  fontSize: 28,
                  fontFace: designDNA.fonts.heading,
                  color: designDNA.colors.textPrimary,
                  bold: true,
                  align: 'center',
                  valign: 'middle',
                },
              });
            }
          } else if (issue.type === 'missing_formula') {
            // Only inject formulas for page types that actually support them
            const page = allPages.find((p) => p.pageNum === issue.pageNum);
            const formulaEligibleTypes = ['concept', 'case', 'formula', 'process'];
            if (page && formulaEligibleTypes.includes(page.pageType)) {
              const content = page.content as Record<string, unknown>;
              const fallbackLatex =
                (content.focus as string) || (content.notes as string) || '\\text{待补充公式}';
              if (!content.formulas && page.pageType !== 'formula') {
                content.formulas = [
                  { label: '相关方程式', latex: `\\text{${String(fallbackLatex).slice(0, 60)}}` },
                ];
              }
              if (page.pageType === 'formula' && !content.mainFormula) {
                content.mainFormula = `\\text{${String(fallbackLatex).slice(0, 60)}}`;
              }
              if (idx >= 0) {
                // Inject a placeholder formula rendering into existing instructions
                instructions[idx].instructions.push({
                  op: 'addText',
                  params: {
                    text: '相关方程式',
                    x: 1,
                    y: 4.5,
                    w: 11.3,
                    h: 0.5,
                    fontSize: 14,
                    fontFace: designDNA.fonts.heading,
                    color: designDNA.colors.textMuted,
                    bold: true,
                    align: 'left',
                  },
                });
                instructions[idx].instructions.push({
                  op: 'addFormula',
                  params: {
                    latex: '\\text{待补充公式}',
                    x: 1,
                    y: 5,
                    w: 11.3,
                    h: 1,
                    fontSize: 16,
                    color: designDNA.colors.textBody,
                    align: 'center',
                  },
                });
              }
            }
          } else if (issue.type === 'missing_title') {
            const page = allPages.find((p) => p.pageNum === issue.pageNum);
            const titleText =
              (page?.content?.title as string) ||
              (page?.content?.slogan as string) ||
              `第 ${issue.pageNum} 页`;
            if (idx >= 0) {
              const hasTitle = instructions[idx].instructions.some(
                (inst) =>
                  inst.op === 'addText' && (inst.params as Record<string, unknown>)?.y === 0.5,
              );
              if (!hasTitle) {
                instructions[idx].instructions.unshift({
                  op: 'addText',
                  params: {
                    text: titleText,
                    x: 1,
                    y: 0.5,
                    w: 11.3,
                    h: 0.7,
                    fontSize: 28,
                    fontFace: designDNA.fonts.heading,
                    color: designDNA.colors.textPrimary,
                    bold: true,
                    align: 'left',
                    valign: 'middle',
                  },
                });
              }
            }
          } else if (issue.type === 'orphan_instructions') {
            // Remove instructions for pages that no longer exist in the outline
            const orphanIdx = instructions.findIndex((x) => x.pageNum === issue.pageNum);
            if (orphanIdx >= 0) {
              log.warn(`Removing orphan instructions for page ${issue.pageNum}`);
              instructions.splice(orphanIdx, 1);
            }
          } else if (issue.type === 'duplicate_card_desc') {
            // Deduplicate cards in content (best-effort)
            const page = allPages.find((p) => p.pageNum === issue.pageNum);
            if (page && Array.isArray(page.content.cards)) {
              const seen = new Set<string>();
              page.content.cards = (page.content.cards as Array<{ desc?: string }>).filter((c) => {
                const key = c.desc?.trim() || '';
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
              });
            }
          }
        }
        // Re-sort after possible inserts
        instructions.sort((a, b) => a.pageNum - b.pageNum);
      }

      endStep(jobId, 'repair');
      updateJob(jobId, { stage: 'merging', message: '正在合并课件...', progress: 82 });

      // ══ Step 5: Merge → Render PPTX ══
      startStep(jobId, 'merge_render');
      const pres = new pptxgen();
      pres.layout = 'LAYOUT_WIDE';
      pres.author = '天空课堂';
      pres.title = topic;

      const sortedInstructions = instructions.sort((a, b) => a.pageNum - b.pageNum);
      const allFormulas: Array<Record<string, unknown>> = [];
      for (const page of sortedInstructions) {
        const slide = pres.addSlide();
        const result = await instructionExecutor.execute(
          slide,
          pres,
          page.instructions,
          page.pageNum,
        );
        const resultWithFormulas = result as typeof result & {
          formulas?: Array<Record<string, unknown>>;
        };
        if (resultWithFormulas.formulas && resultWithFormulas.formulas.length > 0) {
          allFormulas.push(...resultWithFormulas.formulas);
        }
      }

      const safeTopic = topic.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_').slice(0, 20);
      const safeStyleName = designDNA.styleName
        .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_')
        .slice(0, 20);
      const fileName = `${safeTopic}_${safeStyleName}_${Date.now()}.pptx`;
      const pptxPath = path.join(outputDir, fileName);
      try {
        await pres.writeFile({ fileName: pptxPath });
      } catch (writeErr) {
        const writeMsg = writeErr instanceof Error ? writeErr.message : String(writeErr);
        throw new Error(`PPTX 文件写入失败: ${writeMsg}`);
      }

      // Write sidecar JSON for formula preview synthesis
      const sidecarPath = pptxPath.replace('.pptx', '.sidecar.json');
      if (allFormulas.length > 0) {
        await fs.writeFile(sidecarPath, JSON.stringify({ formulas: allFormulas }, null, 2));
      }

      const pptxUrl = `/temp/pptx/${fileName}`;

      endStep(jobId, 'merge_render', {
        fileName,
        pageCount: instructions.length,
        formulaCount: allFormulas.length,
      });

      // ══ Step 5: Preview PNGs — per-slide via python-pptx + LibreOffice ══
      startStep(jobId, 'preview_png');
      updateJob(jobId, { stage: 'merging', message: '正在生成预览图...', progress: 85 });

      const previewResult = await generatePreviewFromPptx(pptxUrl, undefined);
      const previewImages: string[] = previewResult.success ? previewResult.slideImages : [];

      endStep(jobId, 'preview_png', { previewCount: previewImages.length });

      // ══ Done ══
      finalizeAudit(jobId, 'success', {
        pageCount: instructions.length,
        qaScore: qaReport.totalScore,
        qaPassed: qaReport.pass,
        designDNA: {
          styleName: designDNA.styleName,
          mood: designDNA.mood,
          density: designDNA.decoration.density,
          layoutType: designDNA.layoutType,
        },
      });

      updateJob(jobId, {
        stage: 'done',
        progress: 100,
        message: '课件生成完毕',
        pptxUrl,
        fileName,
        previewImages: previewImages.length > 0 ? previewImages : undefined,
        qaReport,
        finishedAt: Date.now(),
      });

      log.info(`[Pipeline:${jobId}] complete: ${pptxUrl} (${instructions.length} pages)`);
    } finally {
      if (sectionsHeartbeat) clearInterval(sectionsHeartbeat);
    }
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    // Friendly error message for common failure modes
    const msg =
      rawMsg.includes('Section') && rawMsg.includes('failed')
        ? rawMsg
        : rawMsg.includes('timeout') || rawMsg.includes('超时')
          ? '生成超时，请稍后重试。如果问题持续，请减少页数或选择较简单的主题。'
          : rawMsg.includes('PPTX')
            ? rawMsg
            : `生成失败: ${rawMsg}`;
    errorStep(jobId, 'pipeline', msg);
    finalizeAudit(jobId, 'error', {
      error: msg,
      designDNA: {
        styleName: designDNA.styleName,
        mood: designDNA.mood,
        density: designDNA.decoration.density,
        layoutType: designDNA.layoutType,
      },
    });
    log.error(`[Pipeline:${jobId}] failed: ${msg}`);
    logToFile('ERROR', 'Pipeline', `[${jobId}] failed: ${msg}`);
    updateJob(jobId, { stage: 'done', progress: 0, error: msg });
  } finally {
    releaseGenerationSlot();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Message Queue Interface (预留)
//
// 当引入 BullMQ / Bee-Queue 等消息队列时，Worker 进程将调用以下接口
// 而非直接调用 runPipeline。这样队列层与核心逻辑解耦。
//
// 未来架构规划：
//   1. 粗粒度：runPipelineTask → 整个 pipeline 作为一个队列任务
//   2. 细粒度：每个环节（planning/sections/page-design/qa）作为独立任务
//      → 失败时只重试该环节，不需要从头开始
//   3. 最小粒度：单个 section 或单个 page 作为独立任务
//      → 适用于 Page Design 等"小单元反复重试"场景
//
// 当前阶段：先保持 runPipeline 同步执行，队列接口仅作预留。
// ═══════════════════════════════════════════════════════════════════════

/**
 * Queue Worker 入口 —— 整个 Pipeline 作为一个任务。
 *
 * 当引入消息队列后，Worker 进程调用此函数执行生成任务。
 * 与 runPipeline 行为完全一致，只是接口层面明确标识为"队列任务"。
 */
export interface OpenMaicPipelineResult {
  pptxUrl: string;
  fileName: string;
  previewImages: string[];
  totalPages: number;
  generationTime: number;
}

export async function runOpenMaicSlidesPipeline(
  options: GenerateOptions,
): Promise<OpenMaicPipelineResult> {
  const {
    topic,
    difficulty,
    minPages,
    maxPages,
    designDNA,
    languageModel,
    jobId,
    educationLevel,
    personalization,
  } = options;
  const startedAt = Date.now();
  const publicDir = path.resolve(process.cwd(), 'public');
  const outputDir = path.join(publicDir, 'temp', 'pptx');
  await fs.mkdir(outputDir, { recursive: true });

  const difficultyLevel = normalizeOpenMaicDifficulty(difficulty);
  const slideCount = resolveOpenMaicSlideCount(difficultyLevel, minPages, maxPages);
  const theme = selectOpenMaicExportTheme(designDNA);
  const difficultyLabel = OPENMAIC_DIFFICULTY_LABELS[difficultyLevel];

  updateJob(jobId, {
    stage: 'planning',
    pipelineMode: 'openmaic',
    message: '天空课堂正在启动固定模板课件生成…',
    progress: 8,
    totalPages: slideCount,
  });

  const aiCall: AICallFn = async (system, user) => {
    const result = await callLLM(
      {
        model: languageModel,
        system,
        prompt: user,
        maxOutputTokens: 32768,
      },
      'sky-slides-openmaic-template',
      {
        retries: 2,
        timeoutMs: 180_000,
        validate: (text) => text.trim().length > 100 && text.includes('"pages"'),
      },
    );
    return result.text;
  };

  updateJob(jobId, {
    stage: 'pages_designing',
    message: '天空课堂正在规划课件内容…',
    progress: 20,
  });

  // The LLM produces STRUCTURED CONTENT ONLY; every page is rendered into a
  // fixed layout with the DesignDNA template's palette/typography.
  const contentCount = Math.max(1, slideCount - 2);
  const pages = await generateTemplateDeckContent(
    topic,
    difficultyLabel,
    contentCount,
    buildOpenMaicStyleDirective(designDNA, educationLevel, personalization),
    aiCall,
  );

  const slideSummaries = summarizeTemplatePages(pages);
  updateJob(jobId, {
    stage: 'pages_designing',
    message: `内容已就绪（${pages.length} 页），正在按模板版式绘制 PPTX…`,
    progress: 65,
    totalPages: pages.length + 2,
    outline: slideSummaries,
    completedSlides: slideSummaries,
  });

  const themeToken = buildThemeFromDesignDNA(designDNA, theme);
  const buffer = await buildTemplateDeckBuffer({
    topic,
    difficultyLabel,
    dna: designDNA,
    theme: themeToken,
    pages,
    renderFormulaPng: renderLatexFormulaPng,
  });

  const fileName = buildOpenMaicFileName(topic, theme);
  const pptxPath = path.join(outputDir, fileName);
  await fs.writeFile(pptxPath, buffer);
  const pptxUrl = `/temp/pptx/${fileName}`;

  updateJob(jobId, {
    stage: 'merging',
    message: '天空课堂 PPTX 已导出，正在生成预览图…',
    progress: 85,
    pptxUrl,
    fileName,
  });

  const previewResult = await generatePreviewFromPptx(pptxUrl);
  const previewImages = previewResult.success ? previewResult.slideImages : [];

  updateJob(jobId, {
    stage: 'done',
    progress: 100,
    message: '天空课堂课件生成完成',
    pptxUrl,
    fileName,
    previewImages: previewImages.length > 0 ? previewImages : undefined,
    finishedAt: Date.now(),
  });

  return {
    pptxUrl,
    fileName,
    previewImages,
    totalPages: pages.length + 2,
    generationTime: Date.now() - startedAt,
  };
}

const OPENMAIC_DIFFICULTY_LABELS: Record<'junior' | 'senior' | 'college', string> = {
  junior: '初中',
  senior: '高中',
  college: '大学',
};

/**
 * LaTeX→PNG via MathJax (lazy import — mathjax is an optional dependency).
 * Any failure returns null so formula pages fall back to Unicode text.
 */
async function renderLatexFormulaPng(
  latex: string,
  bgColor: string,
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  try {
    const { renderLatexToPng } = await import('../latex-to-image');
    return await renderLatexToPng(latex, { scale: 2.2, bgColor });
  } catch (err) {
    log.warn(
      `renderLatexToPng unavailable: ${err instanceof Error ? err.message : err} — using text fallback`,
    );
    return null;
  }
}

function normalizeOpenMaicDifficulty(difficulty: string): 'junior' | 'senior' | 'college' {
  const value = difficulty.toLowerCase();
  if (value.includes('junior')) return 'junior';
  if (value.includes('college') || value.includes('university')) return 'college';
  return 'senior';
}

function resolveOpenMaicSlideCount(
  difficulty: 'junior' | 'senior' | 'college',
  minPages: number,
  maxPages: number,
): number {
  const defaults = { junior: 12, senior: 16, college: 20 } as const;
  const min = Number.isFinite(minPages) ? Math.max(2, Math.floor(minPages)) : defaults[difficulty];
  const max = Number.isFinite(maxPages)
    ? Math.max(min, Math.floor(maxPages))
    : defaults[difficulty];
  return Math.max(2, Math.min(60, Math.round((min + max) / 2)));
}

function selectOpenMaicExportTheme(designDNA: DesignDNA): PptxThemeId {
  const motif = designDNA.decoration?.motif;
  if (motif === 'neon-grid') return 'tech-dark';
  if (motif === 'organic-circles') return 'nature-fresh';
  if (motif === 'ink-wash' || motif === 'chinese-seal') return 'academic';
  if (motif === 'geometric-lines') return 'academic-navy';

  const styleText = `${designDNA.styleName} ${designDNA.mood}`.toLowerCase();
  if (/dark|tech|minimal|charcoal/.test(styleText)) return 'tech-dark';
  if (/pink|cream|berry|soft/.test(styleText)) return 'macaron-pink';
  return 'academic-navy';
}

function buildOpenMaicStyleDirective(
  designDNA: DesignDNA,
  educationLevel?: string,
  personalization?: SlidesAdaptivePolicy,
): string {
  const colors = designDNA.colors;
  const fonts = designDNA.fonts;
  const personalizationDirective = buildSlidesPromptDirective(personalization);
  return [
    'Use 天空课堂-style element-level slide design, not template slots.',
    'Create polished visual hierarchy with explicit TextElement, ShapeElement, LineElement, TableElement, ChartElement, and LatexElement objects when useful.',
    'Use layered backgrounds, generous spacing, asymmetric balance, and varied compositions. Do not repeat the same title-body layout on every slide.',
    'Hard ban: do not use the old Sky card-panel template. Avoid two equal rounded pastel cards, large colored content boxes, and formula blocks trapped inside cards.',
    'Use at most one large pale panel on a slide. Prefer whitespace, thin accent geometry, callout labels, arrows, diagrams, timelines, tables, and one strong visual anchor.',
    'Every content slide should include at least two non-text visual elements beyond the background, such as lines, shapes, chart/table structure, callout markers, or LatexElement formulas.',
    'For math and science decks, make formulas large visual anchors with surrounding labels and worked-example steps; never put LaTeX inside TextElement HTML.',
    `Visual mood: ${designDNA.styleName} / ${designDNA.mood}.`,
    `Preferred palette: cover #${colors.coverBg}, content #${colors.contentBg}, accent #${colors.accent}, secondary #${colors.accentSecondary}, accent light #${colors.accentLight}.`,
    `Typography: headings use "${fonts.heading}", body text uses "${fonts.body}", English/numerals use "${fonts.en}". Content-page titles around ${fonts.pageTitleSize}pt, body around ${fonts.bodySize}pt.`,
    'The cover slide is rendered by the system from the user-selected template — keep the cover to a title TextElement and a subtitle TextElement only; the system replaces its visual design with the template layout.',
    `The end slide should reuse the cover palette (background #${colors.coverBg}) so the deck feels like one design.`,
    educationLevel ? `Audience education level: ${educationLevel}.` : '',
    personalizationDirective,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildOpenMaicFileName(topic: string, theme: PptxThemeId): string {
  const safeTopic =
    topic
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'openmaic_slides';
  return `${safeTopic}_${theme}_${Date.now()}.pptx`;
}

export async function runPipelineTask(options: GenerateOptions): Promise<void> {
  return runPipeline(options);
}

/**
 * 生成阶段结果类型 —— 供细粒度队列序列化/反序列化使用。
 *
 * 未来若将各环节拆分为独立队列任务，阶段间通过此类型传递数据。
 */
export interface PipelinePhaseResult {
  phase: 'planning' | 'sections' | 'page_design' | 'qa' | 'merge';
  success: boolean;
  data?: unknown;
  error?: string;
}
