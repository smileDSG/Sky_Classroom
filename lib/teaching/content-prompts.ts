/**
 * D-003 Content Generator — Prompt Templates
 */

import type { PrecedingSection } from './content-types';
import type { StudentProfile } from '@/lib/student/profile-types';
import { buildProfileContextPrompt } from '@/lib/student/profile-prompts';

export const CONTENT_SYSTEM_PROMPT = `You are an expert teacher generating lesson content. Output must be valid JSON with Markdown and LaTeX formatting.

IMPORTANT: For mathematical formulas, you MUST use standard LaTeX delimiters:
- Inline math: $...$ (e.g., $x^2 + y^2 = z^2$)
- Display math: $$...$$ (e.g., $$\int_0^1 f(x) dx$$)

Do NOT use \\( ... \\) or \\[ ... \\] delimiters. Always use $ and $$ for math expressions.

For text explanations, use paragraphs separated by blank lines and Markdown lists for key steps or points. Avoid walls of text without breaks.

<!-- prompt-version: v2-profile-driven -->`;

export const STRUCTURED_CONTENT_SYSTEM_PROMPT = `You are an expert teacher generating structured slide content. Output must be a single valid JSON object matching the requested content type.

IMPORTANT: For mathematical formulas, use standard LaTeX delimiters:
- Inline math: $...$ (e.g., $x^2 + y^2 = z^2$)
- Display math: $$...$$ (e.g., $$\int_0^1 f(x) dx$$)
- Do NOT use \\( ... \\) or \\[ ... \\] delimiters.

Rules:
- Output ONLY the JSON object, no markdown fences, no extra text
- All text fields should be concise and suitable for slide display
- Use Chinese for all content unless otherwise specified
- Each card/item should be self-contained and meaningful on its own

<!-- prompt-version: v2-profile-driven -->`;

// ── Content type → StructuredContent type mapping ──

type TeachingContentType = 'explanation' | 'example' | 'diagram' | 'quiz';

function mapContentTypeToStructured(
  contentType: TeachingContentType,
  knowledgePoints: string[],
): string {
  switch (contentType) {
    case 'explanation':
      return 'concept';
    case 'example':
      return 'case';
    case 'diagram':
      return 'process';
    case 'quiz':
      return 'quiz'; // quiz stays as chunks
    default:
      return 'concept';
  }
}

// ── StructuredContent prompt templates per type ──

const STRUCTURED_SCHEMA_GUIDES: Record<string, string> = {
  concept: `{
  "type": "concept",
  "title": "标题（简洁有力）",
  "cards": [
    { "title": "概念名称", "desc": "概念的详细解释，30-300字，要具体、易懂" }
  ],
  "summary": "本节核心总结，10-200字",
  "formulas": [{ "label": "公式名称", "latex": "LaTeX公式" }]
}
说明：
- cards 至少 2 个，最多 6 个，每个卡片是一个独立的知识点
- desc 字段要详细（至少30字），不要只写标题
- formulas 可选，仅在涉及公式时添加
- summary 可选，用于概括本页要点`,

  case: `{
  "type": "case",
  "title": "标题",
  "scenarios": [
    { "problem": "题目/问题描述，20-400字", "solution": "解答/分析过程，20-400字" }
  ],
  "highlight": "关键点提示，不超过100字",
  "formulas": [{ "label": "公式名称", "latex": "LaTeX公式" }]
}
说明：
- scenarios 至少 1 个，最多 3 个
- problem 和 solution 都要详细完整
- highlight 可选，突出易错点或关键思路`,

  process: `{
  "type": "process",
  "title": "标题",
  "steps": [
    { "num": "1", "title": "步骤名称", "desc": "步骤详细说明，20-300字" }
  ],
  "formulas": [{ "label": "公式名称", "latex": "LaTeX公式" }]
}
说明：
- steps 至少 2 个，最多 6 个
- 每步要有清晰的编号、标题和描述
- 按逻辑顺序排列`,

  formula: `{
  "type": "formula",
  "title": "标题",
  "mainFormula": "核心公式的 LaTeX 表达式",
  "derivation": "公式推导过程或含义解释，20-500字",
  "application": "公式的应用场景或例题说明，10-300字"
}
说明：
- mainFormula 使用标准 LaTeX 格式
- derivation 要详细解释公式的来源或推导
- application 可选，举例说明如何使用`,

  summary: `{
  "type": "summary",
  "title": "标题",
  "keyPoints": ["要点1（10-200字）", "要点2", "要点3"],
  "preview": "下一节预告，不超过150字",
  "formulas": [{ "label": "公式名称", "latex": "LaTeX公式" }]
}
说明：
- keyPoints 至少 3 个，最多 6 个，每个是完整的一句话
- 适合用于章节总结或复习回顾`,
};

// ── Existing prompt (kept as fallback for quiz type) ──

export function buildContentPrompt(
  section: {
    id: string;
    title: string;
    contentType: string;
    depth: string;
    knowledgePoints: string[];
    hasQuiz?: boolean;
  },
  profile?: StudentProfile,
  precedingSections?: PrecedingSection[],
): string {
  const depthGuide: Record<string, string> = {
    basic: '基础概念讲解，使用类比和举例，步骤详细，公式推导完整',
    intermediate: '重点强化，指出易错点，提供变式训练',
    advanced: '拓展提升，综合应用，提供竞赛级难度的题目',
  };

  const typeGuide: Record<string, string> = {
    explanation: '生成讲解文本，包含概念解释和示例',
    example: '生成例题，包含题目、解题步骤和答案',
    diagram: '生成图表描述，用文字描述图形结构',
    quiz: '生成随堂测验题，包含题目和参考答案',
  };

  const kpStr = section.knowledgePoints.join('、');
  const depthDesc = depthGuide[section.depth] || depthGuide.intermediate;
  const typeDesc = typeGuide[section.contentType] || typeGuide.explanation;

  // 构建前序上下文
  let precedingContext = '';
  if (precedingSections && precedingSections.length > 0) {
    const summaries = precedingSections
      .map((s, i) => `第 ${i + 1} 节「${s.title}」（${s.depth}）：${s.contentSummary}`)
      .join('\n');
    precedingContext = `\n## 前序内容摘要\n${summaries}\n\n请确保本节内容与前序内容衔接自然，避免重复。\n`;
  }

  // 学情上下文
  const profileContext = profile
    ? `\n${buildProfileContextPrompt(profile, {
        maxWeakPoints: 3,
        maxErrorPatterns: 2,
        includeRecent: false,
        highlightKnowledgePoints: section.knowledgePoints,
      })}\n`
    : '';

  // 测验要求
  const quizRequirement = section.hasQuiz
    ? '\n5. 如果此环节不是 quiz 类型，请在内容末尾额外生成 1-2 个 quiz 类型的随堂测验题，包含题目、选项和参考答案'
    : '';

  const quizFormatGuide =
    section.contentType === 'quiz' || section.hasQuiz
      ? `
## Quiz 输出格式
对于 quiz 类型的内容块，请使用以下结构化格式：
{
  "type": "quiz",
  "question": "题目文本",
  "options": ["选项A", "选项B", "选项C", "选项D"],
  "correctAnswer": 0,
  "content": "参考答案和解析",
  "order": N
}
注意：
- options 数组包含所有选项
- correctAnswer 为正确选项的索引（0=A, 1=B, 2=C, 3=D）
- content 字段包含答案和详细解析`
      : '';

  return `请为以下教学环节生成内容。

## 环节信息
- 标题：${section.title}
- 类型：${typeDesc}
- 深度：${depthDesc}
- 知识点：${kpStr}
${precedingContext}${profileContext}
## 输出要求
返回 JSON 格式，包含多个内容块：
{
  "chunks": [
    {
      "type": "text|formula|example|quiz|diagram",
      "content": "内容文本（支持 Markdown + LaTeX）",
      "order": 1
    }
  ]
}

要求：
1. 至少 2 个内容块
2. 公式使用 $...$（行内）或 $$...$$（独立行），不要使用 \\( \\) 或 \\[ \\]
3. type 为 formula 的内容块必须使用 $$...$$ 独立居中显示，不要混用普通说明文字
4. 讲解文本必须分段：不同观点/步骤之间用空行分隔，每段控制在 2-4 行；关键步骤或要点请使用 Markdown 列表（- 或 1.）
5. 例题需包含完整的解题步骤
6. 随堂测需提供参考答案${quizRequirement}${quizFormatGuide}`;
}

// ── New: StructuredContent prompt for rich slides ──

export function buildStructuredContentPrompt(
  section: {
    id: string;
    title: string;
    contentType: string;
    depth: string;
    knowledgePoints: string[];
    hasQuiz?: boolean;
  },
  profile?: StudentProfile,
  precedingSections?: PrecedingSection[],
): string {
  const kpStr = section.knowledgePoints.join('、');
  const structuredType = mapContentTypeToStructured(
    section.contentType as TeachingContentType,
    section.knowledgePoints,
  );

  // quiz type doesn't use StructuredContent — caller should skip
  if (structuredType === 'quiz') return '';

  const schemaGuide = STRUCTURED_SCHEMA_GUIDES[structuredType] ?? STRUCTURED_SCHEMA_GUIDES.concept;

  // 前序上下文
  let precedingContext = '';
  if (precedingSections && precedingSections.length > 0) {
    const summaries = precedingSections
      .map((s, i) => `第 ${i + 1} 节「${s.title}」：${s.contentSummary}`)
      .join('\n');
    precedingContext = `\n## 前序内容摘要\n${summaries}\n\n请确保本节内容与前序衔接自然，避免重复。\n`;
  }

  // 学情上下文
  const profileContext = profile
    ? `\n${buildProfileContextPrompt(profile, {
        maxWeakPoints: 3,
        maxErrorPatterns: 2,
        includeRecent: false,
        highlightKnowledgePoints: section.knowledgePoints,
      })}\n`
    : '';

  return `请为以下教学环节生成结构化幻灯片内容。

## 环节信息
- 标题：${section.title}
- 知识点：${kpStr}
- 深度：${section.depth}
${precedingContext}${profileContext}
## 输出格式
严格输出以下 JSON 结构（${structuredType} 类型）：
${schemaGuide}

## 要求
1. 输出一个完整的 JSON 对象，不要包含数组包裹或额外字段
2. 所有文本使用中文
3. 公式使用 $...$（行内）或 $$...$$（独立行）LaTeX 格式
4. 内容要具体、有深度，不要空泛的概述
5. cards/steps/scenarios 中的每个条目都要有实质内容
6. 只输出 JSON，不要输出任何其他文字`;
}
