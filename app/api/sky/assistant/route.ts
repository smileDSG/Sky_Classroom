/**
 * POST /api/sky/assistant
 * AI assistant chat endpoint — real LLM-powered with SSE streaming.
 */
import { NextRequest } from 'next/server';
import { streamLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import { resolveModel } from '@/lib/server/resolve-model';

const log = createLogger('API:SkyAssistant');

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, subject, difficulty, style } = body as {
      messages: { role: string; content: string }[];
      subject?: string;
      difficulty?: string;
      style?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { model, modelInfo, thinkingConfig } = await resolveModel({
      modelString: body.model,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      providerType: body.providerType,
    });

    const subj = subject || '数学';
    const diffLabel =
      difficulty === 'junior' ? '初中' : difficulty === 'senior' ? '高中' : '大学';
    const styleHint =
      style === 'concise'
        ? '回答要简洁明了，抓住重点。'
        : style === 'heuristic'
          ? '用启发式的方式引导学生思考，不要直接给出完整答案，多用提问和提示。'
          : '回答要详细清楚，包含步骤和解释。';

    const systemPrompt = `你是一位专业的${subj}学习助手，面向${diffLabel}水平的学生。
${styleHint}
要求：
1. 用中文回答，语气亲切自然，像一个耐心的老师。
2. 如果学生发了具体题目，请逐步分析、解答，并给出检验方法。
3. 如果学生问概念，先用通俗语言解释，再举一个简单例子。
4. 回答要针对学生的具体问题，不要泛泛而谈。
5. 适当使用 Markdown 格式（如加粗重点、公式、列表）让回答更清晰。`;

    // Convert messages to the format expected by the AI SDK
    const aiMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const result = streamLLM(
      {
        model,
        system: systemPrompt,
        messages: aiMessages,
        maxOutputTokens: modelInfo?.outputWindow,
      },
      'sky-assistant',
      thinkingConfig,
    );

    // Pipe the AI SDK stream as SSE
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        for await (const chunk of result.textStream) {
          const event = `data: ${JSON.stringify({ type: 'text_delta', content: chunk })}\n\n`;
          await writer.write(encoder.encode(event));
        }
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        await writer.close();
      } catch (error) {
        log.error('SkyAssistant stream error:', error);
        try {
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : String(error) })}\n\n`,
            ),
          );
          await writer.close();
        } catch {
          /* already closed */
        }
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    log.error('Assistant API error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'AI 助手响应失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
