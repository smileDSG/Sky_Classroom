/**
 * Pipeline — orchestrates the full PPT generation flow.
 *
 * Planning → Section Agents (concurrent) → Page Design Agents (concurrent)
 * → Merge → LibreOffice preview PNGs.
 */
import path from 'path';
import fs from 'fs/promises';
import pptxgen from 'pptxgenjs';
import { planOutline, type Outline } from './planning-agent';
import { generateSectionContent, type SectionOutput } from './section-agent';
import { designPage } from './page-design-agent';
import { instructionExecutor, type PageInstructions } from './instruction-executor';
import { generatePreviewFromPptx } from '../pptx-preview';
import { runQA, type QAReport } from './qa-agent';
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { DesignDNA } from './design-dna';
import { withConcurrencyLimit } from './concurrency';
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
}

export type PipelineStage =
  | 'planning'
  | 'sections_generating'
  | 'pages_designing'
  | 'merging'
  | 'qa_reviewing'
  | 'repairing'
  | 'done';

export interface JobState {
  jobId: string;
  stage: PipelineStage;
  message: string;
  progress: number;
  totalPages: number;
  pptxUrl?: string;
  fileName?: string;
  previewImages?: string[];
  qaReport?: { totalScore: number; pass: boolean; issues: Array<{ pageNum: number; severity: string; type: string; layer: string; detail: string }> };
  error?: string;
}

// ── Job Manager ──────────────────────────────────────────────────────
// Use globalThis to survive Turbopack HMR module reloads in dev mode.
// In production each request shares the same process, so this is safe too.
const _global = globalThis as Record<string, unknown>;
if (!_global.__pptJobs) _global.__pptJobs = new Map<string, JobState>();
if (!_global.__pptDoneTs) _global.__pptDoneTs = new Map<string, number>();
const jobs = _global.__pptJobs as Map<string, JobState>;
const _doneTimestamps = _global.__pptDoneTs as Map<string, number>;

export function createJob(jobId: string, totalPages?: number): JobState {
  const state: JobState = {
    jobId,
    stage: 'planning',
    message: '正在规划课程大纲...',
    progress: 0,
    totalPages: totalPages || 0,
  };
  jobs.set(jobId, state);
  return state;
}

export function getJob(jobId: string): JobState | undefined {
  return jobs.get(jobId);
}

export function updateJob(jobId: string, update: Partial<JobState>) {
  const job = jobs.get(jobId);
  if (job) Object.assign(job, update);
}

// Background cleanup: remove jobs that have been done for > 10 min
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
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

// ── Fallback content builder ────────────────────────────────────────

export function buildFallbackContent(
  pageType: string,
  title: string,
  outline: { focus: string; keyConcepts?: string[]; notes?: string },
): Record<string, unknown> {
  const concepts = outline?.keyConcepts ?? [];
  switch (pageType) {
    case 'cover':
      return { title, subtitle: outline?.focus ?? '', tagline: '' };
    case 'toc':
      return { title: '目录', items: concepts.map((c, i) => ({ num: String(i + 1).padStart(2, '0'), title: c.slice(0, 8), desc: c.slice(0, 20) })) };
    case 'end':
      return { slogan: outline?.focus?.slice(0, 15) ?? '谢谢', subtitle: outline?.notes?.slice(0, 30) ?? '' };
    case 'chapter':
      return { num: title.slice(0, 2) || '01', title, subtitle: outline?.focus ?? '' };
    case 'concept':
      return {
        title,
        cards: concepts.map((c) => ({ title: c.slice(0, 8), desc: outline?.notes?.slice(0, 100) ?? '详见教材相关章节' })),
        summary: outline?.focus?.slice(0, 120) ?? '本节介绍了核心概念，更多细节请参考教材。',
      };
    case 'case':
      return {
        title,
        scenarios: [{ problem: outline?.focus ?? '请参考教材例题', solution: outline?.notes?.slice(0, 250) ?? '解题思路详见教材' }],
        highlight: concepts[0]?.slice(0, 40) ?? '',
      };
    case 'compare':
      return {
        title,
        left: { title: concepts[0]?.slice(0, 10) ?? '特性A', items: concepts.slice(0, 3) },
        right: { title: concepts[1]?.slice(0, 10) ?? '特性B', items: concepts.slice(3, 6) },
        conclusion: outline?.focus?.slice(0, 120) ?? '两者各有特点，需根据具体场景选择。',
      };
    case 'process':
      return {
        title,
        steps: concepts.map((c, i) => ({ num: String(i + 1), title: c.slice(0, 10), desc: outline?.notes?.slice(0, 120) ?? `步骤 ${i + 1} 的详细说明` })),
      };
    case 'table':
      return {
        title,
        headers: concepts.slice(0, 4),
        rows: [[outline?.focus?.slice(0, 40) ?? '数据', ...concepts.slice(0, 3)]],
        summary: outline?.notes?.slice(0, 100) ?? '表格数据来源详见教材。',
      };
    case 'formula':
      return {
        title,
        mainFormula: outline?.focus ?? '',
        derivation: outline?.notes?.slice(0, 300) ?? '推导过程详见教材',
        application: '',
      };
    case 'timeline':
      return {
        title,
        events: concepts.map((c, i) => ({ date: String(i + 1), content: c.slice(0, 80) })),
      };
    case 'summary':
      return {
        title: title || '本章总结',
        keyPoints: concepts.length > 0 ? concepts : [outline?.focus ?? '回顾本章核心内容'],
        preview: outline?.notes?.slice(0, 60) ?? '',
      };
    case 'quiz':
      return {
        title,
        questions: [{ q: outline?.focus?.slice(0, 150) ?? '请回答以下问题', options: concepts.slice(0, 4), answer: 'A' }],
      };
    default:
      return { title, fallback: true, notes: outline?.focus ?? '' };
  }
}

function buildFallbackSection(section: import('./planning-agent').SectionPlan): SectionOutput {
  return {
    sectionId: section.sectionId,
    pages: section.pages.map((page) => ({
      pageNum: page.pageNum,
      pageType: page.type,
      content: buildFallbackContent(page.type, page.title, {
        focus: page.contentOutline?.focus ?? page.title,
        keyConcepts: page.contentOutline?.keyConcepts ?? [],
        notes: page.contentOutline?.notes ?? '',
      }),
    })),
  };
}

// ── Concurrency limiter (imported from ./concurrency) ───────────────

// ── Pipeline ─────────────────────────────────────────────────────────

export async function runPipeline(options: GenerateOptions): Promise<void> {
  const { topic, difficulty, minPages, maxPages, designDNA, languageModel, jobId } = options;

  // Initialize audit
  createAudit(jobId, topic, difficulty);
  startStep(jobId, 'planning');

  try {
    const publicDir = path.resolve(process.cwd(), 'public');
    const outputDir = path.join(publicDir, 'temp', 'pptx');
    await fs.mkdir(outputDir, { recursive: true });

    // ══ Step 1: Planning ══
    updateJob(jobId, { stage: 'planning', message: '正在规划课程大纲...', progress: 5 });
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
      planResult = await planOutline(topic, difficulty, minPages, maxPages, designDNA, languageModel);
      // Record planning LLM call (approximate from no direct access — logged in planning-agent)
      clearInterval(planningHeartbeat);
      planningHeartbeat = null;

      if (!planResult.success || !planResult.outline) {
        errorStep(jobId, 'planning', planResult.error || '大纲规划失败');
        finalizeAudit(jobId, 'error', { error: planResult.error || '大纲规划失败', designDNA: { styleName: designDNA.styleName, mood: designDNA.mood, density: designDNA.decoration.density, layoutType: designDNA.layoutType } });
        updateJob(jobId, { stage: 'done', progress: 0, error: planResult.error || '大纲规划失败' });
        return;
      }
    } finally {
      if (planningHeartbeat) clearInterval(planningHeartbeat);
    }

    endStep(jobId, 'planning', { totalPages: planResult.totalPages, sections: planResult.outline.sections.length });

    const outline = planResult.outline;
    updateJob(jobId, { stage: 'planning', message: `大纲规划完成，共 ${outline.sections.length} 章节 ${planResult.totalPages} 页`, progress: 15, totalPages: planResult.totalPages });

    // ══ Step 2: Section Agents (concurrent, capped) ══
    startStep(jobId, 'sections', { sectionCount: outline.sections.length });
    updateJob(jobId, { stage: 'sections_generating', message: `正在生成 ${outline.sections.length} 个章节内容...`, progress: 20 });
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
        12,
        async (section, idx) => {
          const result = await generateSectionContent(section, topic, difficulty, designDNA, languageModel);
          completedSections++;
          updateJob(jobId, {
            message: `章节内容：${completedSections}/${outline.sections.length} — 第 ${idx + 1} 章「${section.title}」${result.success ? '✓' : '✗ 降级'} `,
            progress: 20 + Math.round(completedSections / outline.sections.length * 20),
          });
          return result;
        },
        600_000,
        150,
      );

      clearInterval(sectionsHeartbeat);
      sectionsHeartbeat = null;
      endStep(jobId, 'sections', { completedSections, totalSections: outline.sections.length });

      // Allow failed sections to fall back to minimal content
      const allContent: SectionOutput[] = [];
      const fallbackSections: Array<{ index: number; title: string }> = [];
      for (let i = 0; i < sectionResults.length; i++) {
        const result = sectionResults[i];
        if (result.success && result.output) {
          allContent.push(result.output);
        } else {
          log.warn(`[Pipeline:${jobId}] Section ${i} "${outline.sections[i].title}" failed, using fallback`);
          fallbackSections.push({ index: i, title: outline.sections[i].title });
          allContent.push(buildFallbackSection(outline.sections[i]));
        }
      }

      // Flatten all pages
      const allPages = allContent.flatMap((s) => s.pages).sort((a, b) => a.pageNum - b.pageNum);

      updateJob(jobId, { stage: 'pages_designing', message: `正在设计 ${allPages.length} 页幻灯片排版...`, progress: 42 });

      // ══ Step 3: Page Design Agents (concurrent, capped) ══
      startStep(jobId, 'page_design', { pageCount: allPages.length });
      // Track per-page completion for real progress feedback
      let designedPages = 0;
      log.info(`[Pipeline:${jobId}] Starting page design for ${allPages.length} pages with concurrency=8 stagger=150ms`);
      const designResults = await withConcurrencyLimit(
        allPages,
        8,
        async (page) => {
          const designStart = Date.now();
          log.info(`[Pipeline:${jobId}] Designing page ${page.pageNum} (${page.pageType})`);
          const result = await designPage(page.pageNum, page.pageType, page.content, allPages.length, designDNA, languageModel);
          const designDuration = Date.now() - designStart;
          log.info(`[Pipeline:${jobId}] Page ${page.pageNum} design done in ${designDuration}ms, success=${result.success}`);
          // Note: token info not directly available from designPage; would need to pass through
          recordLLMCall(jobId, `page_design_${page.pageNum}`, 'design-page', designDuration);
          designedPages++;
          updateJob(jobId, {
            message: `页面排版：${designedPages}/${allPages.length} — 第 ${page.pageNum} 页 (${page.pageType}) ${result.success ? '✓' : '✗ 降级'}`,
            progress: 42 + Math.round(designedPages / allPages.length * 28),
          });
          return { pageNum: page.pageNum, result };
        },
        600_000,
        150,
      );
      log.info(`[Pipeline:${jobId}] All page design completed. Failed: ${designResults.filter((dr) => !dr.result.success).length}`);

      // Handle any pages that used fallback layouts (designPage now auto-fallbacks instead of failing)
      const fallbackDesigns = designResults.filter((dr) => dr.result.fallback);
      if (fallbackDesigns.length > 0) {
        const fallbackPages = fallbackDesigns.map((dr) => `第${dr.pageNum}页`).join(', ');
        log.warn(`[Pipeline:${jobId}] Pages using fallback layout: ${fallbackPages}`);
      }
      const instructions: PageInstructions[] = designResults.map((dr) => dr.result.pageInstructions!);

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
      );

      endStep(jobId, 'qa', { score: qaReport.totalScore, passed: qaReport.pass, issueCount: qaReport.issues.length });
      updateJob(jobId, { stage: 'qa_reviewing', message: `质检完成：评分 ${qaReport.totalScore}，${qaReport.pass ? '通过' : '需修复'} (${qaReport.issues.length} 个问题)`, progress: 78, qaReport });

      // ══ Step 5: Repair structural issues (no LLM) ══
      const structuralIssues = qaReport.issues.filter((i) => i.layer === 'structural');
      startStep(jobId, 'repair', { structuralIssueCount: structuralIssues.length });
      if (structuralIssues.length > 0) {
        updateJob(jobId, { stage: 'repairing', message: `正在修复 ${structuralIssues.length} 个结构问题...`, progress: 80 });

        for (const issue of structuralIssues) {
          const idx = instructions.findIndex((x) => x.pageNum === issue.pageNum);

          if (issue.type === 'missing_cover' || issue.type === 'missing_end') {
            if (idx >= 0) {
              instructions[idx] = {
                pageNum: issue.pageNum,
                instructions: [
                  { op: 'setBackground', params: { color: designDNA.colors.coverBg } },
                  { op: 'addText', params: { text: issue.pageNum === 1 ? (allPages[0]?.content?.title as string || topic || '封面') : '课程结束', x: 1, y: 2, w: 11.3, h: 2, fontSize: 36, fontFace: designDNA.fonts.heading, color: designDNA.colors.textOnDark, bold: true, align: 'center', valign: 'middle' } },
                ],
              };
            }
          } else if (issue.type === 'missing_instructions' && idx < 0) {
            // Inject a minimal instruction set for pages that have none
            instructions.push({
              pageNum: issue.pageNum,
              instructions: [
                { op: 'setBackground', params: { color: designDNA.colors.contentBg } },
                { op: 'addText', params: { text: allPages.find((p) => p.pageNum === issue.pageNum)?.content?.title as string || `第 ${issue.pageNum} 页`, x: 1, y: 2, w: 11.3, h: 2, fontSize: 28, fontFace: designDNA.fonts.heading, color: designDNA.colors.textPrimary, bold: true, align: 'center', valign: 'middle' } },
              ],
            });
          } else if (issue.type === 'empty_content' && idx >= 0) {
            // Ensure the page has at least a title text
            const hasText = instructions[idx].instructions.some((inst) => inst.op === 'addText');
            if (!hasText) {
              instructions[idx].instructions.push({
                op: 'addText',
                params: { text: allPages.find((p) => p.pageNum === issue.pageNum)?.content?.title as string || `第 ${issue.pageNum} 页`, x: 1, y: 2, w: 11.3, h: 2, fontSize: 28, fontFace: designDNA.fonts.heading, color: designDNA.colors.textPrimary, bold: true, align: 'center', valign: 'middle' },
              });
            }
          } else if (issue.type === 'missing_formula') {
            // Inject fallback formula into content and instructions
            const page = allPages.find((p) => p.pageNum === issue.pageNum);
            if (page) {
              const content = page.content as Record<string, unknown>;
              if (!content.formulas && page.pageType !== 'formula') {
                content.formulas = [{ label: '相关方程式', latex: '\\text{详见教材}' }];
              }
              if (page.pageType === 'formula' && !content.mainFormula) {
                content.mainFormula = '\\text{公式内容详见教材}';
              }
            }
            if (idx >= 0) {
              // Inject a placeholder formula rendering into existing instructions
              instructions[idx].instructions.push({
                op: 'addText',
                params: { text: '相关方程式', x: 1, y: 4.5, w: 11.3, h: 0.5, fontSize: 14, fontFace: designDNA.fonts.heading, color: designDNA.colors.textMuted, bold: true, align: 'left' },
              });
              instructions[idx].instructions.push({
                op: 'addFormula',
                params: { latex: '\\text{详见教材}', x: 1, y: 5, w: 11.3, h: 1, fontSize: 16, color: designDNA.colors.textBody, align: 'center' },
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
      pres.author = 'OpenMAIC';
      pres.title = topic;

      const sortedInstructions = instructions.sort((a, b) => a.pageNum - b.pageNum);
      for (const page of sortedInstructions) {
        const slide = pres.addSlide();
        instructionExecutor.execute(slide, pres, page.instructions, page.pageNum);
      }

      const safeTopic = topic.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_').slice(0, 20);
      const safeStyleName = designDNA.styleName.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_').slice(0, 20);
      const fileName = `${safeTopic}_${safeStyleName}_${Date.now()}.pptx`;
      const pptxPath = path.join(outputDir, fileName);
      try {
        await pres.writeFile({ fileName: pptxPath });
      } catch (writeErr) {
        const writeMsg = writeErr instanceof Error ? writeErr.message : String(writeErr);
        throw new Error(`PPTX 文件写入失败: ${writeMsg}`);
      }

      const pptxUrl = `/temp/pptx/${fileName}`;

      endStep(jobId, 'merge_render', { fileName, pageCount: instructions.length });

      // ══ Step 5: Preview PNGs — per-slide via python-pptx + LibreOffice ══
      startStep(jobId, 'preview_png');
      updateJob(jobId, { stage: 'merging', message: '正在生成预览图...', progress: 85 });

      const previewResult = await generatePreviewFromPptx(pptxUrl);
      const previewImages: string[] = previewResult.success ? previewResult.slideImages : [];

      endStep(jobId, 'preview_png', { previewCount: previewImages.length });

      // ══ Done ══
      finalizeAudit(jobId, 'success', {
        pageCount: instructions.length,
        qaScore: qaReport.totalScore,
        qaPassed: qaReport.pass,
        designDNA: { styleName: designDNA.styleName, mood: designDNA.mood, density: designDNA.decoration.density, layoutType: designDNA.layoutType },
      });

      updateJob(jobId, {
        stage: 'done',
        progress: 100,
        message: '课件生成完毕',
        pptxUrl,
        fileName,
        previewImages: previewImages.length > 0 ? previewImages : undefined,
        qaReport,
      });

      log.info(`[Pipeline:${jobId}] complete: ${pptxUrl} (${instructions.length} pages)`);
    } finally {
      if (sectionsHeartbeat) clearInterval(sectionsHeartbeat);
    }


  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errorStep(jobId, 'pipeline', msg);
    finalizeAudit(jobId, 'error', { error: msg, designDNA: { styleName: designDNA.styleName, mood: designDNA.mood, density: designDNA.decoration.density, layoutType: designDNA.layoutType } });
    log.error(`[Pipeline:${jobId}] failed: ${msg}`);
    updateJob(jobId, { stage: 'done', progress: 0, error: msg });
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
