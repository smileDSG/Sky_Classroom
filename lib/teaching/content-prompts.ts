/**
 * D-003 Content Generator — Prompt Templates
 */

import type { PrecedingSection } from './content-types';

export const CONTENT_SYSTEM_PROMPT = `You are an expert teacher generating lesson content. Output must be valid JSON with Markdown and LaTeX formatting.

IMPORTANT: For mathematical formulas, you MUST use standard LaTeX delimiters:
- Inline math: $...$ (e.g., $x^2 + y^2 = z^2$)
- Display math: $$...$$ (e.g., $$\int_0^1 f(x) dx$$)

Do NOT use \\( ... \\) or \\[ ... \\] delimiters. Always use $ and $$ for math expressions.`;

export function buildContentPrompt(section: {
  id: string;
  title: string;
  contentType: string;
  depth: string;
  knowledgePoints: string[];
  hasQuiz?: boolean;
}, precedingSections?: PrecedingSection[]): string {
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
    const summaries = precedingSections.map((s, i) =>
      `第 ${i + 1} 节「${s.title}」（${s.depth}）：${s.contentSummary}`
    ).join('\n');
    precedingContext = `\n## 前序内容摘要\n${summaries}\n\n请确保本节内容与前序内容衔接自然，避免重复。\n`;
  }

  // 测验要求
  const quizRequirement = section.hasQuiz
    ? '\n5. 如果此环节不是 quiz 类型，请在内容末尾额外生成 1-2 个 quiz 类型的随堂测验题，包含题目、选项和参考答案'
    : '';

  const quizFormatGuide = section.contentType === 'quiz' || section.hasQuiz
    ? `
## Quiz 输出格式
对于 quiz 类型的内容块，请使用以下结构化格式：
{
  "type": "quiz",
  "question": "题目文本",
  "options": ["选项A", "选项B", "选项C", "选项D"],
  "content": "参考答案和解析",
  "order": N
}
注意：options 数组包含所有选项，content 字段包含答案和详细解析。`
    : '';

  return `请为以下教学环节生成内容。

## 环节信息
- 标题：${section.title}
- 类型：${typeDesc}
- 深度：${depthDesc}
- 知识点：${kpStr}
${precedingContext}
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
3. 例题需包含完整的解题步骤
4. 随堂测需提供参考答案${quizRequirement}${quizFormatGuide}`;
}
