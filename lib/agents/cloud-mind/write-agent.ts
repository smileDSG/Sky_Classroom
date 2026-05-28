/**
 * 云端智囊 — 智能写作 Agent
 *
 * 根据主题、写作类型、字数要求，使用 AI 生成高质量文章。
 */

import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createLogger } from '@/lib/logger';
import { resolveApiKey, resolveBaseUrl } from '@/lib/server/provider-config';

const log = createLogger('WriteAgent');

// ── System Prompt ──────────────────────────────────────────────────

const WRITE_AGENT_SYSTEM_PROMPT = `你是一位资深的写作指导老师和文学创作者，擅长各种体裁的写作。

## 你的能力
1. **作文写作**：记叙文、议论文、说明文、应用文
2. **论文写作**：学术论文、研究报告、文献综述
3. **创意写作**：小说、散文、诗歌、剧本
4. **摘要总结**：读书笔记、读后感、文献摘要

## 写作原则
- 结构清晰，逻辑严密
- 语言优美，表达准确
- 内容充实，论据有力
- 紧扣主题，不偏题跑题
- 适当引用名言、典故增加文采

## 写作风格
- 作文：语言流畅自然，情感真挚，细节生动
- 论文：论证严谨，引用规范，观点明确
- 创意写作：想象力丰富，文笔优美，有个人风格
- 摘要总结：概括精炼，重点突出，有个人见解

## 注意事项
- 使用中文写作（除非特别要求其他语言）
- 数学公式使用 LaTeX 格式
- 保持自然流畅，避免模板化痕迹
- 根据目标字数合理控制篇幅`;

// ── 流式写作函数 ─────────────────────────────────────────────────

export function streamWriting(
  topic: string,
  genre: string,
  requirements: string,
  wordCount: string,
): ReadableStream {
  const apiKey = resolveApiKey('deepseek');
  const baseUrl = resolveBaseUrl('deepseek') || 'https://api.deepseek.com/v1';

  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured. Set DEEPSEEK_API_KEY in .env.local.');
  }

  const deepseek = createOpenAI({ apiKey, baseURL: baseUrl });

  const genreLabels: Record<string, string> = {
    essay: '作文（记叙文/议论文/说明文）',
    paper: '学术论文/研究报告',
    creative: '创意写作（小说/散文/诗歌）',
    summary: '摘要总结（读书笔记/文献综述）',
  };

  const genreLabel = genreLabels[genre] || genre;

  const userPrompt = `请根据以下要求进行写作：

【写作主题】${topic}
【写作类型】${genreLabel}
【目标字数】${wordCount}字
${requirements ? `【补充要求】${requirements}` : ''}

请直接开始写作，不要输出额外的说明或标题标注。`;

  log.info(`Streaming writing: topic="${topic}", genre=${genre}, wordCount=${wordCount}`);

  const result = streamText({
    model: deepseek.chat('deepseek-chat'),
    system: WRITE_AGENT_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.8,
    maxOutputTokens: 8192,
  });

  return result.toTextStreamResponse().body!;
}
