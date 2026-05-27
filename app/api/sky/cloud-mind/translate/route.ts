/**
 * POST /api/sky/cloud-mind/translate
 *
 * 智能翻译 Agent API
 * 接收文本和语言对，调用 DeepSeek 进行高质量翻译。
 */

import { NextRequest } from 'next/server';
import { translateText, streamTranslation } from '@/lib/agents/cloud-mind/translate-agent';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:CloudMindTranslate');

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, sourceLang, targetLang, stream } = body as {
      text: string;
      sourceLang: string;
      targetLang: string;
      stream?: boolean;
    };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return Response.json({ success: false, error: '请输入要翻译的文本' }, { status: 400 });
    }

    if (!sourceLang || !targetLang) {
      return Response.json({ success: false, error: '请选择源语言和目标语言' }, { status: 400 });
    }

    if (sourceLang === targetLang) {
      return Response.json({ success: false, error: '源语言和目标语言不能相同' }, { status: 400 });
    }

    // 限制文本长度
    const trimmedText = text.slice(0, 10000);

    if (stream) {
      log.info(`Streaming translation: ${sourceLang} → ${targetLang}`);
      const readableStream = streamTranslation(trimmedText, sourceLang, targetLang);
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    const result = await translateText(trimmedText, sourceLang, targetLang);

    log.info(`Translation complete: ${sourceLang} → ${targetLang}`);

    return Response.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Translation failed:', message);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
