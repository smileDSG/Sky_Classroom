/**
 * Planning Agent — generates a page-level outline with content outlines.
 *
 * Called once per PPT generation. Outputs a Section[] plan that drives
 * Section Agents and Page Design Agents.
 */
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { DesignDNA } from './design-dna';
import { z } from 'zod';

const log = createLogger('PlanningAgent');

// ── Output Schema ────────────────────────────────────────────────────

const contentOutlineSchema = z.object({
  focus: z.string(),
  keyConcepts: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const pagePlanSchema = z.object({
  pageNum: z.number(),
  type: z.enum([
    'cover', 'toc', 'end', 'chapter',
    'concept', 'case', 'compare', 'process', 'table', 'formula', 'timeline',
    'summary', 'quiz',
  ]),
  title: z.string().max(20),
  contentOutline: contentOutlineSchema,
});

const sectionPlanSchema = z.object({
  sectionId: z.number(),
  title: z.string(),
  pages: z.array(pagePlanSchema).min(1).max(10),
});

export const outlineSchema = z.object({
  sections: z.array(sectionPlanSchema).min(1).max(8),
});

export type Outline = z.infer<typeof outlineSchema>;
export type SectionPlan = z.infer<typeof sectionPlanSchema>;
export type PagePlan = z.infer<typeof pagePlanSchema>;

// ── Prompt Building ──────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `## 角色
你是一位教学设计师，为课程规划 PPT 的页级大纲和内容要点。

## 可用页面类型
- cover: 封面（第1页）| toc: 目录（第2页）| end: 结束页（最后1页）
- chapter: 章节过渡页 | summary: 章末总结 | quiz: 课堂练习
- concept: 概念讲解（多卡片） | case: 案例/例题
- compare: 对比分析 | process: 步骤流程
- table: 数据对比表 | formula: 公式推导
- timeline: 时间线

## 硬规则
- cover 永远是第1页，end 永远是最后1页，toc 紧跟 cover
- chapter 之后必须跟2-5页相关内容页
- concept 必须在 case 之前
- 同一章节内避免连续3页以上相同页型
- summary 放在每个章节末尾

## 页型选择偏好
- 数学/物理: 多用 formula > case > concept
- 语文/历史/文学: 多用 concept > timeline > compare
- 生物/地理/生态: 多用 concept > compare > process
- 信息技术/编程: 多用 process > case > table
- 初中: 少推导多生活实例
- 高中: 公式+例题均衡
- 大学: 理论深度优先

## 输出格式（纯JSON数组）`;
}

function buildUserPrompt(
  topic: string,
  difficulty: string,
  minPages: number,
  maxPages: number,
  designDNA: DesignDNA,
): string {
  return `主题：${topic}
学段：${difficulty}
页数范围：${minPages}-${maxPages} 页
风格：${designDNA.styleName}（${designDNA.mood}）

请规划页级大纲。每页必须包含 contentOutline（focus、keyConcepts、notes），供后续章节 Agent 使用。

输出格式：
{
  "sections": [
    {
      "sectionId": 1,
      "title": "章节标题",
      "pages": [
        {
          "pageNum": 4,
          "type": "concept",
          "title": "页面标题（≤10字）",
          "contentOutline": {
            "focus": "这页核心讲什么",
            "keyConcepts": ["关键概念1", "关键概念2"],
            "notes": "章节Agent的创作指引"
          }
        }
      ]
    }
  ]
}`;
}

// ── JSON Cleanup ────────────────────────────────────────────────────

function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1').replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  return cleaned;
}

// ── Public API ──────────────────────────────────────────────────────

export interface PlanningResult {
  success: boolean;
  outline?: Outline;
  totalPages?: number;
  error?: string;
}

export async function planOutline(
  topic: string,
  difficulty: string,
  minPages: number,
  maxPages: number,
  designDNA: DesignDNA,
  languageModel: LanguageModel,
): Promise<PlanningResult> {
  try {
    const system = buildSystemPrompt();
    const user = buildUserPrompt(topic, difficulty, minPages, maxPages, designDNA);

    log.info(`Planning outline for "${topic}" [${minPages}-${maxPages}p]`);

    const result = await callLLM(
      { model: languageModel, system, prompt: user, maxOutputTokens: 8192, temperature: 0.7 },
      'planning-agent',
      { retries: 1, validate: (text) => {
        const t = text.trim();
        return t.length > 500 && t.includes('sections') && t.endsWith('}');
      } },
    );

    const jsonText = cleanJsonText(result.text);
    const parsed = JSON.parse(jsonText);

    // Trim excess pages BEFORE zod validation (zod limits per-section)
    let sections = parsed.sections || [];
    let totalPages = sections.reduce((sum: number, s: { pages: unknown[] }) => sum + (s.pages?.length || 0), 0);

    if (totalPages > maxPages) {
      let toRemove = totalPages - maxPages;
      for (let i = sections.length - 1; i >= 0 && toRemove > 0; i--) {
        const sec = sections[i];
        if (!sec.pages) continue;
        const removable = sec.pages.filter((p: { type: string }) => !['cover', 'toc', 'end', 'chapter', 'summary'].includes(p.type));
        while (toRemove > 0 && removable.length > 0) {
          const idx = sec.pages.indexOf(removable.pop());
          sec.pages.splice(idx, 1);
          toRemove--;
          totalPages--;
        }
      }
    }

    // Also trim per-section to max 10 before validation
    for (const sec of sections) {
      if (sec.pages && sec.pages.length > 10) {
        sec.pages = sec.pages.slice(0, 10);
      }
    }

    const validated = outlineSchema.safeParse({ sections });

    if (!validated.success) {
      log.error(`Outline validation failed: ${validated.error.message}`);
      return { success: false, error: `大纲格式校验失败: ${validated.error.message.slice(0, 200)}` };
    }

    // Enforce minimum page count
    if (totalPages < minPages) {
      return { success: false, error: `大纲页数 ${totalPages} 少于最小要求 ${minPages}` };
    }

    log.info(`Outline planned: ${validated.data.sections.length} sections, ${totalPages} pages`);
    return { success: true, outline: validated.data, totalPages };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`Planning failed: ${msg}`);
    return { success: false, error: msg };
  }
}
