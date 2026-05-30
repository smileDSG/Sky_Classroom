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
import type { PipelineStage } from './slides-job-store';

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
  onProgress?: (progress: { stage: PipelineStage; progress: number; message: string; totalPages?: number }) => Promise<void>;
  onComplete?: (result: { pptxUrl: string; fileName: string; previewImages?: string[]; qaReport?: unknown }) => Promise<void>;
}

// ── Pipeline ─────────────────────────────────────────────────────────

export async function runPipeline(options: GenerateOptions): Promise<void> {
  const { topic, difficulty, minPages, maxPages, designDNA, languageModel, jobId, onProgress, onComplete } = options;

  try {
    const publicDir = path.resolve(process.cwd(), 'public');
    const outputDir = path.join(publicDir, 'temp', 'pptx');
    await fs.mkdir(outputDir, { recursive: true });

    // Helper to report progress
    const reportProgress = async (stage: PipelineStage, progress: number, message: string, totalPages?: number) => {
      if (onProgress) {
        await onProgress({ stage, progress, message, totalPages });
      }
    };

    // ══ Step 1: Planning ══
    await reportProgress('planning', 5, '正在规划课程大纲...');
    const planResult = await planOutline(topic, difficulty, minPages, maxPages, designDNA, languageModel);

    if (!planResult.success || !planResult.outline) {
      throw new Error(planResult.error || '大纲规划失败');
    }

    const outline = planResult.outline;
    await reportProgress('planning', 15, `大纲规划完成，共 ${outline.sections.length} 章节 ${planResult.totalPages} 页`, planResult.totalPages);

    // ══ Step 2+3: Section Content → Page Design (streaming pipeline) ══
    await reportProgress('sections_generating', 20, '正在生成章节内容...');

    const totalPages = outline.sections.reduce((sum, s) => sum + s.pages.length, 0);
    let completedSections = 0;

    // Process sections: as each completes, immediately start its page design
    const sectionDesignPromises = outline.sections.map(async (section, idx) => {
      const result = await generateSectionContent(section, topic, difficulty, designDNA, languageModel);
      completedSections++;
      await reportProgress('sections_generating', 20 + Math.round(completedSections / outline.sections.length * 20), `第 ${completedSections}/${outline.sections.length} 章内容生成${result.success ? '完毕' : '失败'}...`);

      // Use fallback if section content generation failed
      const sectionOutput = result.success && result.output
        ? result.output
        : {
            sectionId: section.sectionId,
            pages: section.pages.map((p) => ({
              pageNum: p.pageNum,
              pageType: p.type,
              content: { title: p.title, fallback: true, notes: p.contentOutline.focus },
            })),
          };

      if (!result.success) {
        log.warn(`Section ${section.sectionId} used fallback content`);
      }

      // Immediately start page design for this section's pages
      const pages = sectionOutput.pages;
      const BATCH = 8;
      const sectionInstructions: PageInstructions[] = [];

      for (let i = 0; i < pages.length; i += BATCH) {
        const batch = pages.slice(i, i + BATCH);
        const batchResults = await Promise.all(
          batch.map(async (page) => {
            return designPage(page.pageNum, page.pageType, page.content, totalPages, designDNA, languageModel);
          }),
        );
        for (const dr of batchResults) {
          if (dr.success && dr.pageInstructions) {
            sectionInstructions.push(dr.pageInstructions);
          } else {
            sectionInstructions.push({
              pageNum: dr.pageNum,
              instructions: [
                { op: 'setBackground', params: { color: dr.pageNum === 1 || dr.pageNum === totalPages ? designDNA.colors.coverBg : designDNA.colors.contentBg } },
                { op: 'addText', params: { text: `第 ${dr.pageNum} 页`, x: 1, y: 2, w: 11.3, h: 1, fontSize: 24, fontFace: designDNA.fonts.heading, color: designDNA.colors.textPrimary, align: 'center' } },
              ],
            });
          }
        }
      }

      return { sectionOutput, sectionInstructions };
    });

    // Wait for all sections (content + page design) to complete
    const allSectionResults = await Promise.all(sectionDesignPromises);
    const allContent = allSectionResults.map((r) => r.sectionOutput);
    const allPages = allContent.flatMap((s) => s.pages).sort((a, b) => a.pageNum - b.pageNum);
    const instructions = allSectionResults
      .flatMap((r) => r.sectionInstructions)
      .sort((a, b) => a.pageNum - b.pageNum);

    await reportProgress('merging', 75, '正在合并课件...');

    // ══ Step 4: QA + Repair Loop ══
    await reportProgress('qa_reviewing', 80, '正在质检课件质量...');

    const { runQA } = await import('./qa-agent');
    const qaReport = await runQA(topic, difficulty, outline, allContent, allPages.length, languageModel);

    let finalQAReport = qaReport;

    if (!qaReport.pass) {
      await reportProgress('repairing', 82, `发现 ${qaReport.issues.length} 个问题，正在自动修复...`);

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

      await reportProgress('repairing', 90, '修复完成，重新质检中...');

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
          await reportProgress('repairing', 95, '部分页面问题已降级处理');
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
    await reportProgress('merging', 85, '正在生成预览图...');

    const previewResult = await generatePreviewFromPptx(pptxUrl);
    const previewImages: string[] = previewResult.success ? previewResult.slideImages : [];

    // ══ Done ══
    if (onComplete) {
      await onComplete({
        pptxUrl,
        fileName,
        previewImages: previewImages.length > 0 ? previewImages : undefined,
        qaReport: finalQAReport || qaReport,
      });
    }

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
    throw err;
  }
}
