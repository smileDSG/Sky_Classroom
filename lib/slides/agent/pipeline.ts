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
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { DesignDNA } from './design-dna';

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

const jobs = new Map<string, JobState>();

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

// Add completed timestamp tracking
const _doneTimestamps = new Map<string, number>();

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

// ── Pipeline ─────────────────────────────────────────────────────────

export async function runPipeline(options: GenerateOptions): Promise<void> {
  const { topic, difficulty, minPages, maxPages, designDNA, languageModel, jobId } = options;

  try {
    const publicDir = path.resolve(process.cwd(), 'public');
    const outputDir = path.join(publicDir, 'temp', 'pptx');
    await fs.mkdir(outputDir, { recursive: true });

    // ══ Step 1: Planning ══
    updateJob(jobId, { stage: 'planning', message: '正在规划课程大纲...', progress: 5 });
    // Heartbeat: slowly increment progress while LLM runs
    const planningHeartbeat = setInterval(() => {
      const job = getJob(jobId);
      if (job && job.stage === 'planning' && job.progress < 13) {
        updateJob(jobId, { progress: job.progress + 1 });
      }
    }, 15000); // +1% every 15s
    const planResult = await planOutline(topic, difficulty, minPages, maxPages, designDNA, languageModel);
    clearInterval(planningHeartbeat);

    if (!planResult.success || !planResult.outline) {
      updateJob(jobId, { stage: 'done', progress: 0, error: planResult.error || '大纲规划失败' });
      return;
    }

    const outline = planResult.outline;
    updateJob(jobId, { stage: 'planning', message: `大纲规划完成，共 ${outline.sections.length} 章节 ${planResult.totalPages} 页`, progress: 15, totalPages: planResult.totalPages });

    // ══ Step 2: Section Agents (concurrent) ══
    updateJob(jobId, { stage: 'sections_generating', message: '正在生成章节内容...', progress: 20 });
    const sectionsHeartbeat = setInterval(() => {
      const job = getJob(jobId);
      if (job && job.stage === 'sections_generating' && job.progress < 35) {
        updateJob(jobId, { progress: job.progress + 1 });
      }
    }, 8000);

    const sectionResults = await Promise.all(
      outline.sections.map(async (section, idx) => {
        const result = await generateSectionContent(section, topic, difficulty, designDNA, languageModel);
        updateJob(jobId, {
          message: `第 ${idx + 1}/${outline.sections.length} 章内容生成${result.success ? '完毕' : '失败'}...`,
          progress: 20 + Math.round((idx + 1) / outline.sections.length * 20),
        });
        return result;
      }),
    );

    clearInterval(sectionsHeartbeat);

    // Handle failed sections — use contentOutline as fallback
    const allContent: SectionOutput[] = [];
    for (let i = 0; i < outline.sections.length; i++) {
      if (sectionResults[i].success && sectionResults[i].output) {
        allContent.push(sectionResults[i].output!);
      } else {
        // Fallback: build basic content from contentOutline
        const section = outline.sections[i];
        const fallback: SectionOutput = {
          sectionId: section.sectionId,
          pages: section.pages.map((p) => ({
            pageNum: p.pageNum,
            pageType: p.type,
            content: { title: p.title, fallback: true, notes: p.contentOutline.focus },
          })),
        };
        allContent.push(fallback);
        log.warn(`Section ${section.sectionId} used fallback content`);
      }
    }

    // Flatten all pages
    const allPages = allContent.flatMap((s) => s.pages).sort((a, b) => a.pageNum - b.pageNum);

    updateJob(jobId, { stage: 'pages_designing', message: `正在渲染 ${allPages.length} 页幻灯片...`, progress: 40 });

    // Heartbeat during page design
    const designHeartbeat = setInterval(() => {
      const job = getJob(jobId);
      if (job && job.stage === 'pages_designing' && job.progress < 70) {
        updateJob(jobId, { progress: job.progress + 1 });
      }
    }, 6000);

    // ══ Step 3: Page Design Agents (batched, max 8 concurrent) ══
    const BATCH = 8;
    const designResults: Array<{ pageNum: number; result: Awaited<ReturnType<typeof designPage>> }> = [];
    for (let i = 0; i < allPages.length; i += BATCH) {
      const batch = allPages.slice(i, i + BATCH);
      const batchResults = await Promise.all(
        batch.map(async (page) => {
          const result = await designPage(page.pageNum, page.pageType, page.content, allPages.length, designDNA, languageModel);
          return { pageNum: page.pageNum, result };
        }),
      );
      designResults.push(...batchResults);
    }

    const instructions: PageInstructions[] = [];
    for (const dr of designResults) {
      if (dr.result.success && dr.result.pageInstructions) {
        instructions.push(dr.result.pageInstructions);
      } else {
        instructions.push({
          pageNum: dr.pageNum,
          instructions: [
            { op: 'setBackground', params: { color: dr.pageNum === 1 || dr.pageNum === allPages.length ? designDNA.colors.coverBg : designDNA.colors.contentBg } },
            { op: 'addText', params: { text: `第 ${dr.pageNum} 页`, x: 1, y: 2, w: 11.3, h: 1, fontSize: 24, fontFace: designDNA.fonts.heading, color: designDNA.colors.textPrimary, align: 'center' } },
          ],
        });
      }
    }

    clearInterval(designHeartbeat);
    updateJob(jobId, { stage: 'merging', message: '正在合并课件...', progress: 75 });

    // ══ Step 4: QA + Repair Loop ══
    updateJob(jobId, { stage: 'qa_reviewing', message: '正在质检课件质量...', progress: 80 });

    const { runQA } = await import('./qa-agent');
    const qaReport = await runQA(topic, difficulty, outline, allContent, allPages.length, languageModel);

    let finalQAReport = qaReport;

    if (!qaReport.pass) {
      updateJob(jobId, { stage: 'repairing', message: `发现 ${qaReport.issues.length} 个问题，正在自动修复...`, progress: 82 });

      // Repair Round 1: fix all issues concurrently
      const repairPages = new Set(qaReport.issues.map((i) => i.pageNum));
      const repairResults = await Promise.all(
        Array.from(repairPages).map(async (pageNum) => {
          const page = allPages.find((p) => p.pageNum === pageNum);
          if (!page) return { pageNum, result: null };
          const issue = qaReport.issues.find((i) => i.pageNum === pageNum);
          // Re-run section content generation with fix context
          const section = outline.sections.find((s) => s.pages.some((p) => p.pageNum === pageNum));
          if (section && issue?.layer === 'content') {
            // Content fix: re-generate section content
            const fixed = await generateSectionContent(section, topic, difficulty, designDNA, languageModel);
            return { pageNum, result: fixed.success ? fixed.output?.pages.find((p) => p.pageNum === pageNum)?.content : null };
          }
          // Layout fix: re-design the page
          if (issue?.layer === 'structural' || issue?.layer === 'visual') {
            const fixed = await designPage(pageNum, page.pageType, page.content, allPages.length, designDNA, languageModel);
            return { pageNum, result: fixed.success ? fixed.pageInstructions : null };
          }
          return { pageNum, result: null };
        }),
      );

      // Apply repairs
      for (const repair of repairResults) {
        if (!repair.result) continue;
        if ('instructions' in (repair.result as { instructions?: unknown })) {
          const pi = repair.result as PageInstructions;
          const idx = instructions.findIndex((x) => x.pageNum === repair.pageNum);
          if (idx >= 0) instructions[idx] = pi;
        } else {
          // It's content data — re-design the page
          const page = allPages.find((p) => p.pageNum === repair.pageNum);
          if (page) {
            const redesign = await designPage(repair.pageNum, page.pageType, repair.result as Record<string, unknown>, allPages.length, designDNA, languageModel);
            if (redesign.success && redesign.pageInstructions) {
              const idx = instructions.findIndex((x) => x.pageNum === repair.pageNum);
              if (idx >= 0) instructions[idx] = redesign.pageInstructions;
            }
          }
        }
      }

      updateJob(jobId, { message: '修复完成，重新质检中...', progress: 90 });

      // Re-run QA after round 1
      const qaAfterR1 = await runQA(topic, difficulty, outline, allContent, allPages.length, languageModel);
      finalQAReport = qaAfterR1;
      if (!qaAfterR1.pass) {
        // Round 2: last chance
        const r2Pages = new Set(qaAfterR1.issues.map((i) => i.pageNum));
        await Promise.all(Array.from(r2Pages).map(async (pageNum) => {
          const page = allPages.find((p) => p.pageNum === pageNum);
          if (!page) return;
          const redesign = await designPage(pageNum, page.pageType, page.content, allPages.length, designDNA, languageModel);
          if (redesign.success && redesign.pageInstructions) {
            const idx = instructions.findIndex((x) => x.pageNum === pageNum);
            if (idx >= 0) instructions[idx] = redesign.pageInstructions;
          }
        }));

        // Final QA
        const finalQA = await runQA(topic, difficulty, outline, allContent, allPages.length, languageModel);
        finalQAReport = finalQA;
        if (!finalQA.pass) {
          updateJob(jobId, { message: '部分页面问题已降级处理', progress: 95 });
        }
      }
    }

    // ══ Step 5: Merge → Render PPTX ══
    const pres = new pptxgen();
    pres.layout = 'LAYOUT_WIDE';
    pres.author = 'OpenMAIC';
    pres.title = topic;

    const sortedInstructions = instructions.sort((a, b) => a.pageNum - b.pageNum);
    for (const page of sortedInstructions) {
      const slide = pres.addSlide();
      instructionExecutor.execute(slide, pres, page.instructions, page.pageNum);
    }

    const safeTopic = topic.replace(/[^一-龥a-zA-Z0-9]/g, '_').slice(0, 20);
    const fileName = `${safeTopic}_${designDNA.styleName}_${Date.now()}.pptx`;
    const pptxPath = path.join(outputDir, fileName);
    await pres.writeFile({ fileName: pptxPath });

    const pptxUrl = `/temp/pptx/${fileName}`;

    // ══ Step 5: Preview PNGs — per-slide via python-pptx + LibreOffice ══
    updateJob(jobId, { stage: 'merging', message: '正在生成预览图...', progress: 85 });

    const previewResult = await generatePreviewFromPptx(pptxUrl);
    const previewImages: string[] = previewResult.success ? previewResult.slideImages : [];

    // ══ Done ══
    updateJob(jobId, {
      stage: 'done',
      progress: 100,
      message: '课件生成完毕',
      pptxUrl,
      fileName,
      previewImages: previewImages.length > 0 ? previewImages : undefined,
      qaReport: finalQAReport || qaReport,
    });

    log.info(`Pipeline complete: ${pptxUrl} (${instructions.length} pages)`);

    // Save to slides knowledge base (fire and forget)
    try {
      const { write } = await import('@/lib/knowledge-base/kb-manager');
      const kbContent = JSON.stringify({
        topic,
        difficulty,
        sections: outline.sections.map((s) => ({
          title: s.title,
          pageCount: s.pages.length,
        })),
        totalPages: instructions.length,
        fileName,
      });
      write({
        kbType: 'slides',
        title: `课件: ${topic}`,
        content: kbContent,
        tags: [difficulty, designDNA.styleName],
        sourceId: jobId,
        verified: true,
      }).catch((e) => log.warn('KB save failed:', e));
    } catch {
      // ignore KB save errors
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Pipeline failed for job ${jobId}: ${msg}`);
    updateJob(jobId, { stage: 'done', progress: 0, error: msg });
  }
}
