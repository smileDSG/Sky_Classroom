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

// ── Fallback content builder ────────────────────────────────────────

function buildFallbackContent(
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
      return { num: title.slice(0, 2) || '01', title, subtitle: outline?.focus ?? '', preview: outline?.notes?.slice(0, 60) ?? '' };
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
    updateJob(jobId, { stage: 'sections_generating', message: `正在生成 ${outline.sections.length} 个章节内容...`, progress: 20 });
    const sectionsHeartbeat = setInterval(() => {
      const job = getJob(jobId);
      if (job && job.stage === 'sections_generating' && job.progress < 35) {
        updateJob(jobId, { progress: job.progress + 1 });
      }
    }, 8000);

    let completedSections = 0;
    const sectionResults = await Promise.all(
      outline.sections.map(async (section, idx) => {
        const result = await generateSectionContent(section, topic, difficulty, designDNA, languageModel);
        completedSections++;
        updateJob(jobId, {
          message: `章节内容：${completedSections}/${outline.sections.length} — 第 ${idx + 1} 章「${section.title}」${result.success ? '✓' : '✗ 降级'} `,
          progress: 20 + Math.round(completedSections / outline.sections.length * 20),
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
        // Fallback: build meaningful content from contentOutline
        const section = outline.sections[i];
        const fallback: SectionOutput = {
          sectionId: section.sectionId,
          pages: section.pages.map((p) => {
            const outline = p.contentOutline;
            return {
              pageNum: p.pageNum,
              pageType: p.type,
              content: buildFallbackContent(p.type, p.title, outline),
            };
          }),
        };
        allContent.push(fallback);
        log.warn(`Section ${section.sectionId} used fallback content`);
      }
    }

    // Flatten all pages
    const allPages = allContent.flatMap((s) => s.pages).sort((a, b) => a.pageNum - b.pageNum);

    updateJob(jobId, { stage: 'pages_designing', message: `正在设计 ${allPages.length} 页幻灯片排版...`, progress: 42 });

    // ══ Step 3: Page Design Agents (full concurrent) ══
    // Track per-page completion for real progress feedback
    let designedPages = 0;
    const designResults = await Promise.all(
      allPages.map(async (page) => {
        const result = await designPage(page.pageNum, page.pageType, page.content, allPages.length, designDNA, languageModel);
        designedPages++;
        updateJob(jobId, {
          message: `页面排版：${designedPages}/${allPages.length} — 第 ${page.pageNum} 页 (${page.pageType}) ${result.success ? '✓' : '✗ 降级'}`,
          progress: 42 + Math.round(designedPages / allPages.length * 28),
        });
        return { pageNum: page.pageNum, result };
      }),
    );

    const instructions: PageInstructions[] = [];
    for (const dr of designResults) {
      if (dr.result.success && dr.result.pageInstructions) {
        instructions.push(dr.result.pageInstructions);
      } else {
        instructions.push({
          pageNum: dr.pageNum,
          instructions: [
            { op: 'setBackground', params: { color: dr.pageNum === 1 || dr.pageNum === allPages.length ? designDNA.colors.coverBg : designDNA.colors.contentBg } },
            { op: 'addText', params: { text: `第 ${dr.pageNum} 页`, x: 1, y: 2, w: 11.3, h: 1, fontSize: 24, fontFace: designDNA.fonts.heading, color: designDNA.colors.textPrimary, align: 'center', valign: 'middle' } },
          ],
        });
      }
    }

    updateJob(jobId, { stage: 'qa_reviewing', message: '正在质检：结构检查...', progress: 72 });

    // ══ Step 4: Full QA (structural + content via LLM) ══
    const qaReport = await runQA(
      topic,
      difficulty,
      outline,
      allContent,
      allPages.length,
      languageModel,
    );

    updateJob(jobId, { stage: 'qa_reviewing', message: `质检完成：评分 ${qaReport.totalScore}，${qaReport.pass ? '通过' : '需修复'} (${qaReport.issues.length} 个问题)`, progress: 78, qaReport });

    // ══ Step 5: Repair structural issues (no LLM) ══
    // Fix cover/end page issues by patching instructions directly
    const structuralIssues = qaReport.issues.filter((i) => i.layer === 'structural');
    if (structuralIssues.length > 0) {
      updateJob(jobId, { stage: 'repairing', message: `正在修复 ${structuralIssues.length} 个结构问题...`, progress: 80 });

      for (const issue of structuralIssues) {
        if (issue.type === 'missing_cover' || issue.type === 'missing_end') {
          const idx = instructions.findIndex((x) => x.pageNum === issue.pageNum);
          if (idx >= 0) {
            instructions[idx] = {
              pageNum: issue.pageNum,
              instructions: [
                { op: 'setBackground', params: { color: designDNA.colors.coverBg } },
                { op: 'addText', params: { text: issue.pageNum === 1 ? (allPages[0]?.content?.title as string || topic || '封面') : '谢谢', x: 1, y: 2, w: 11.3, h: 2, fontSize: 36, fontFace: designDNA.fonts.heading, color: designDNA.colors.textOnDark, bold: true, align: 'center', valign: 'middle' } },
              ],
            };
          }
        }
      }
    }

    updateJob(jobId, { stage: 'merging', message: '正在合并课件...', progress: 82 });

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
      qaReport,
    });

    log.info(`Pipeline complete: ${pptxUrl} (${instructions.length} pages)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Pipeline failed for job ${jobId}: ${msg}`);
    updateJob(jobId, { stage: 'done', progress: 0, error: msg });
  }
}
