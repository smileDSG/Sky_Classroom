/**
 * 云端智囊 - 智能翻译 Agent
 */

import { createLogger } from '@/lib/logger';
import { callLLM, streamLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { resolveApiKey, resolveBaseUrl } from '@/lib/server/provider-config';

const log = createLogger('TranslateAgent');

export interface TranslateOutput {
  translation: string;
  sourceLang: string;
  targetLang: string;
  alternatives?: string[];
  notes?: string;
}

const TRANSLATE_AGENT_SYSTEM_PROMPT = `你是一位专业的多语言翻译专家，精通中文、英语、日语、韩语、法语、德语等多种语言的互译。

## 翻译原则
1. 准确忠实：准确传达原文含义，不遗漏、不添加。
2. 自然流畅：译文符合目标语言的表达习惯。
3. 语境理解：根据上下文选择最恰当的词汇和表达。
4. 术语一致：专业术语保持前后一致。

## 输出格式要求
请严格按照以下 JSON 格式输出：
{
  "translation": "翻译结果",
  "sourceLang": "源语言代码",
  "targetLang": "目标语言代码",
  "alternatives": ["备选翻译"],
  "notes": "翻译说明"
}

只输出 JSON，不要输出 Markdown 代码块或额外说明。`;

const STREAM_TRANSLATE_SYSTEM_PROMPT =
  '你是一位专业的多语言翻译专家。请直接输出翻译结果，不要输出任何解释、标注或额外内容。';

const LANG_LABELS: Record<string, string> = {
  zh: '中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  de: 'Deutsch',
};

function getDeepSeekModel() {
  const apiKey = resolveApiKey('deepseek');
  const baseUrl = resolveBaseUrl('deepseek') || 'https://api.deepseek.com/v1';

  if (!apiKey) {
    throw new Error('DeepSeek API key is not configured. Set DEEPSEEK_API_KEY in .env.local.');
  }

  return getModel({
    providerId: 'deepseek',
    modelId: 'deepseek-chat',
    apiKey,
    baseUrl,
  }).model;
}

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<TranslateOutput> {
  const model = getDeepSeekModel();
  const sourceLabel = LANG_LABELS[sourceLang] || sourceLang;
  const targetLabel = LANG_LABELS[targetLang] || targetLang;
  const userPrompt = `请将以下${sourceLabel}文本翻译为${targetLabel}：\n\n${text}`;

  log.info(`Translating: ${sourceLabel} -> ${targetLabel}, length: ${text.length}`);

  const result = await callLLM(
    {
      model,
      system: TRANSLATE_AGENT_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
    'cloud-mind-translate',
    { retries: 1, timeoutMs: 60_000 },
  );

  const responseText = result.text || '';
  log.info(`Translation complete, response length: ${responseText.length}`);

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

export function streamTranslation(
  text: string,
  sourceLang: string,
  targetLang: string,
): ReadableStream {
  const model = getDeepSeekModel();
  const sourceLabel = LANG_LABELS[sourceLang] || sourceLang;
  const targetLabel = LANG_LABELS[targetLang] || targetLang;
  const userPrompt = `请将以下${sourceLabel}文本翻译为${targetLabel}，只输出翻译结果，不要输出其他内容：\n\n${text}`;

  log.info(`Streaming translation: ${sourceLabel} -> ${targetLabel}`);

  const result = streamLLM(
    {
      model,
      system: STREAM_TRANSLATE_SYSTEM_PROMPT,
      prompt: userPrompt,
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
    'cloud-mind-translate-stream',
  );

  return result.toTextStreamResponse().body!;
}
