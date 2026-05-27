/**
 * 云端智囊 — 智能翻译 Agent
 *
 * 使用 AI 进行高质量多语言翻译，支持上下文理解和术语一致性。
 */

import { generateText, streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createLogger } from '@/lib/logger';
import { resolveApiKey, resolveBaseUrl } from '@/lib/server/provider-config';

const log = createLogger('TranslateAgent');

// ── 输出结构 ───────────────────────────────────────────────────────

export interface TranslateOutput {
  translation: string;
  sourceLang: string;
  targetLang: string;
  alternatives?: string[];
  notes?: string;
}

// ── System Prompt ──────────────────────────────────────────────────

const TRANSLATE_AGENT_SYSTEM_PROMPT = `你是一位专业的多语言翻译专家，精通中英日韩法德等多种语言的互译。

## 翻译原则
1. **准确忠实**：准确传达原文含义，不遗漏、不添加
2. **自然流畅**：译文符合目标语言的表达习惯
3. **语境理解**：根据上下文选择最恰当的词汇和表达
4. **术语一致**：专业术语保持前后一致

## 翻译风格
- 文学翻译：注重文采和意境传达
- 学术翻译：注重准确性和专业性
- 日常翻译：注重口语化和自然度
- 商务翻译：注重正式和得体

## 输出格式要求
请严格按照以下 JSON 格式输出：

{
  "translation": "翻译结果",
  "sourceLang": "源语言代码",
  "targetLang": "目标语言代码",
  "alternatives": ["备选翻译1（如果有）", "备选翻译2（如果有）"],
  "notes": "翻译说明（如有特殊处理、多义词选择理由等）"
}

## 注意事项
- 如果原文包含专业术语，在 notes 中简要说明
- 对于有多重含义的词，根据上下文选择最合适的翻译
- 保持原文的语气和风格
- 确保 JSON 格式正确`;

// ── Agent 核心函数 ─────────────────────────────────────────────────

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<TranslateOutput> {
  const apiKey = resolveApiKey('deepseek');
  const baseUrl = resolveBaseUrl('deepseek') || 'https://api.deepseek.com/v1';

  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured. Set DEEPSEEK_API_KEY in .env.local.');
  }

  const deepseek = createOpenAI({ apiKey, baseURL: baseUrl });

  const langLabels: Record<string, string> = {
    zh: '中文',
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    fr: 'Français',
    de: 'Deutsch',
  };

  const sourceLabel = langLabels[sourceLang] || sourceLang;
  const targetLabel = langLabels[targetLang] || targetLang;

  const userPrompt = `请将以下${sourceLabel}文本翻译为${targetLabel}：\n\n${text}`;

  log.info(`Translating: ${sourceLabel} → ${targetLabel}, length: ${text.length}`);

  const result = await generateText({
    model: deepseek('deepseek-chat'),
    system: TRANSLATE_AGENT_SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.3,
    maxOutputTokens: 4096,
  });

  const responseText = result.text || '';
  log.info(`Translation complete, response length: ${responseText.length}`);

  // 解析 JSON 响应
  try {
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
    const jsonStr = jsonMatch[1] || responseText;
    const parsed = JSON.parse(jsonStr.trim()) as TranslateOutput;

    if (!parsed.translation) {
      throw new Error('Invalid response structure');
    }

    return parsed;
  } catch (parseError) {
    log.error('Failed to parse translation response:', parseError);
    throw new Error(`Failed to parse AI response: ${(parseError as Error).message}`);
  }
}

/**
 * 流式翻译 — 返回 ReadableStream
 */
export function streamTranslation(
  text: string,
  sourceLang: string,
  targetLang: string,
): ReadableStream {
  const apiKey = resolveApiKey('deepseek');
  const baseUrl = resolveBaseUrl('deepseek') || 'https://api.deepseek.com/v1';

  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured.');
  }

  const deepseek = createOpenAI({ apiKey, baseURL: baseUrl });

  const langLabels: Record<string, string> = {
    zh: '中文',
    en: 'English',
    ja: '日本語',
    ko: '한국어',
    fr: 'Français',
    de: 'Deutsch',
  };

  const sourceLabel = langLabels[sourceLang] || sourceLang;
  const targetLabel = langLabels[targetLang] || targetLang;

  const userPrompt = `请将以下${sourceLabel}文本翻译为${targetLabel}，只输出翻译结果，不要输出其他内容：\n\n${text}`;

  log.info(`Streaming translation: ${sourceLabel} → ${targetLabel}`);

  const result = streamText({
    model: deepseek('deepseek-chat'),
    system: '你是一位专业的多语言翻译专家。请直接输出翻译结果，不要输出任何解释、标注或额外内容。',
    prompt: userPrompt,
    temperature: 0.3,
    maxOutputTokens: 4096,
  });

  return result.toTextStreamResponse().body!;
}
