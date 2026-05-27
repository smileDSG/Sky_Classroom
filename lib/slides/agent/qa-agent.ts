/**
 * QA Agent — three-layer quality assurance for generated PPTs.
 *
 * Layer 1 (structural, 0 LLM): boundary check, page type consistency
 * Layer 2 (content, 1 LLM): off-topic, duplicate, logic gaps, difficulty
 * Layer 3 (visual): done by SubAgent via LibreOffice PNG inspection (Phase 4)
 */
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import type { LanguageModel } from 'ai';
import type { SectionOutput } from './section-agent';
import type { Outline } from './planning-agent';
import { z } from 'zod';

const log = createLogger('QAAgent');

// ── Types ────────────────────────────────────────────────────────────

export interface QAIssue {
  pageNum: number;
  severity: 'high' | 'medium' | 'low';
  type: string;
  layer: 'structural' | 'content' | 'visual';
  detail: string;
}

export interface QAReport {
  totalScore: number;
  pass: boolean;
  issues: QAIssue[];
}

// ── Layer 1: Structural QA (code-level) ──────────────────────────────

function structuralQA(
  outline: Outline,
  allContent: SectionOutput[],
  totalPages: number,
): QAIssue[] {
  const issues: QAIssue[] = [];
  const allPageContent = allContent.flatMap((s) => s.pages);

  // Check cover is page 1
  const cover = outline.sections[0]?.pages[0];
  if (!cover || cover.type !== 'cover') {
    issues.push({ pageNum: 1, severity: 'high', type: 'missing_cover', layer: 'structural', detail: '第 1 页必须是封面页' });
  }

  // Check end is last page
  const lastSection = outline.sections[outline.sections.length - 1];
  const end = lastSection?.pages[lastSection.pages.length - 1];
  if (!end || end.type !== 'end') {
    issues.push({ pageNum: totalPages, severity: 'high', type: 'missing_end', layer: 'structural', detail: '最后一页必须是结束页' });
  }

  // Check page continuity
  const pageNums = allPageContent.map((p) => p.pageNum).sort((a, b) => a - b);
  for (let i = 0; i < pageNums.length - 1; i++) {
    if (pageNums[i + 1] !== pageNums[i] + 1) {
      issues.push({ pageNum: pageNums[i], severity: 'medium', type: 'page_gap', layer: 'structural', detail: `页码不连续: ${pageNums[i]} → ${pageNums[i + 1]}` });
    }
  }

  // Check every page has content and is non-empty
  for (const { pageNum, pageType, content } of allPageContent) {
    const keys = Object.keys(content || {});
    if (keys.length === 0) {
      issues.push({ pageNum, severity: 'high', type: 'empty_content', layer: 'structural', detail: `第 ${pageNum} 页 (${pageType}) 内容为空` });
    }
    if (!content.title && !(content as { slogan?: string }).slogan) {
      issues.push({ pageNum, severity: 'medium', type: 'missing_title', layer: 'structural', detail: `第 ${pageNum} 页缺少标题` });
    }
  }

  // Check chapter has content pages after it
  for (const section of outline.sections) {
    for (let i = 0; i < section.pages.length; i++) {
      if (section.pages[i].type === 'chapter') {
        const remaining = section.pages.slice(i + 1);
        const contentPages = remaining.filter((p) => !['chapter', 'end'].includes(p.type));
        if (contentPages.length === 0) {
          issues.push({ pageNum: section.pages[i].pageNum, severity: 'high', type: 'empty_chapter', layer: 'structural', detail: `章节过渡页后没有内容页` });
        }
      }
    }
  }

  return issues;
}

// ── Layer 2: Content QA (1 LLM call) ─────────────────────────────────

function buildContentQASystemPrompt(): string {
  return `## 角色
你是教学课件质检专家。审查以下 PPT 内容并找出问题。

## 检查维度
1. 跑题：任何页面的内容是否偏离了主题？
2. 重复：不同页面是否讲了相同或高度重复的内容？
3. 递进：页面之间逻辑顺序是否合理？概念是否在案例之前讲解？是否存在跳跃？
4. 目录对应：toc 页的条目和后续 chapter 页标题是否一一对应？
5. 难度匹配：内容深度是否符合学段要求？

## 输出格式
只输出纯JSON：
{
  "contentScore": 0-100,
  "issues": [
    { "pageNum": 4, "severity": "high|medium|low", "type": "off_topic|duplicate|logic_gap|toc_mismatch|difficulty", "detail": "具体描述" }
  ]
}

## 判定规则
- 任何 high 级问题 → 不合格
- 3 个及以上 medium 级问题 → 不合格
- contentScore < 75 → 不合格`;
}

function buildContentQAUserPrompt(
  topic: string,
  difficulty: string,
  allContent: SectionOutput[],
): string {
  const pages = allContent.flatMap((s) => s.pages);
  const summaries = pages.map((p) => {
    const c = p.content as Record<string, unknown>;
    const title = (c.title || c.slogan || '') as string;
    const cardTitles = Array.isArray(c.cards) ? (c.cards as Array<{ title?: string }>).map((x) => x.title).join(', ') : '';
    const keys = Object.keys(c).filter((k) => k !== 'title').join(', ');
    return `Page ${p.pageNum} [${p.pageType}]: "${title}" | fields: ${keys} | cards: ${cardTitles || 'none'}`;
  });

  return `主题：${topic}
学段：${difficulty}
总页数：${pages.length}

## 页面内容摘要
${summaries.join('\n')}

请进行内容质量审查。`;
}

function cleanJsonText(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1').replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  return cleaned;
}

// ── Public API ──────────────────────────────────────────────────────

export async function runQA(
  topic: string,
  difficulty: string,
  outline: Outline,
  allContent: SectionOutput[],
  totalPages: number,
  languageModel: LanguageModel,
): Promise<QAReport> {
  // Layer 1: Structural (always runs, 0 LLM)
  const structuralIssues = structuralQA(outline, allContent, totalPages);
  log.info(`Layer 1 (structural): ${structuralIssues.length} issues found`);

  // If structural has high-severity issues, skip content QA
  if (structuralIssues.some((i) => i.severity === 'high')) {
    log.warn(`Structural high-severity issues found, skipping content QA`);
    return {
      totalScore: Math.max(0, 100 - structuralIssues.length * 10),
      pass: false,
      issues: structuralIssues,
    };
  }

  // Layer 2: Content QA (1 LLM call)
  let contentIssues: QAIssue[] = [];
  let contentScore = 100;

  try {
    const result = await callLLM(
      {
        model: languageModel,
        system: buildContentQASystemPrompt(),
        prompt: buildContentQAUserPrompt(topic, difficulty, allContent),
        maxOutputTokens: 2048,
        temperature: 0.3,
      },
      'qa-agent',
      { retries: 1, validate: (text) => text.trim().length > 50 && text.includes('score') },
    );

    const parsed = JSON.parse(cleanJsonText(result.text));
    contentScore = parsed.contentScore ?? 80;
    contentIssues = (parsed.issues || []).map((i: { pageNum: number; severity: string; type: string; detail: string }) => ({
      ...i,
      layer: 'content' as const,
    }));
  } catch (err) {
    log.warn(`Content QA failed, using structural only: ${err}`);
  }

  const allIssues = [...structuralIssues, ...contentIssues];
  const pass = contentScore >= 75
    && !allIssues.some((i) => i.severity === 'high')
    && allIssues.filter((i) => i.severity === 'medium').length < 3;

  log.info(`QA complete: score=${contentScore}, issues=${allIssues.length}, pass=${pass}`);

  return { totalScore: contentScore, pass, issues: allIssues };
}
