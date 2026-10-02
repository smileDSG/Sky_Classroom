/**
 * POST /api/sky/cloud-mind/memory-cards/stream
 *
 * 记忆卡片流式生成 API（SSE）。
 * 边生成边推送已完成的卡片，最后推送完整卡组：
 *   data: {"type":"cards","cards":[...]}   — 新完成的卡片（增量）
 *   data: {"type":"done","deck":{...}}     — 完整卡组（含 topic/studyTips 等元信息）
 *   data: {"type":"error","message":"..."} — 生成失败（已出卡片不丢，可重试）
 */

import { NextRequest } from 'next/server';
import { streamMemoryCardsDeck } from '@/lib/agents/cloud-mind/memory-cards-agent';
import { buildMemoryCardsGenerationContext } from '@/lib/agents/cloud-mind/memory-cards-context';
import { createLogger } from '@/lib/logger';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
import { requireAuth } from '@/lib/server/auth/helpers';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { adaptiveLearningApiError } from '@/lib/adaptive-learning/api-error';

const log = createLogger('API:CloudMindMemoryCardsStream');

export const maxDuration = 60;

function formatSSEEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const { content, topic, cardCount, auto } = body as {
      content?: string;
      topic?: string;
      cardCount?: number;
      auto?: boolean;
    };

    if (!content && !auto) {
      return new Response(formatSSEEvent({ type: 'error', message: '学习内容不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    const quota = await requireQuota('llmCalls');
    if ('error' in quota) return quota.error;

    let context: Awaited<ReturnType<typeof buildMemoryCardsGenerationContext>>;
    try {
      context = await buildMemoryCardsGenerationContext(auth.user.id, {
        content,
        topic,
        cardCount,
        auto,
      });
    } catch (err) {
      if (err instanceof AdaptiveLearningError) {
        return adaptiveLearningApiError(err, crypto.randomUUID());
      }
      throw err;
    }

    if (!context.content || context.content.trim().length === 0) {
      return new Response(formatSSEEvent({ type: 'error', message: '学习内容不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const write = async (data: string) => {
      await writer.write(encoder.encode(data));
    };

    (async () => {
      let anyCardsEmitted = false;
      try {
        for await (const event of streamMemoryCardsDeck({
          contentText: context.content,
          topic: context.topic,
          cardCount: context.cardCount,
          profileOrProjection: context.teachingProjectionText,
          abortSignal: req.signal,
        })) {
          if (event.type === 'cards') {
            anyCardsEmitted = event.cards.length > 0 || anyCardsEmitted;
            await write(formatSSEEvent(event));
            continue;
          }
          if (event.type === 'done') {
            anyCardsEmitted = anyCardsEmitted || event.deck.cards.length > 0;
            await write(formatSSEEvent(event));
            break;
          }
          await write(formatSSEEvent(event));
          break;
        }
      } catch (err) {
        log.error('Memory cards stream failed:', err);
        if (anyCardsEmitted) {
          // 已出卡不丢：客户端保留已生成卡片
          await write(formatSSEEvent({ type: 'error', message: '生成中断，已保留已生成卡片' }));
        } else {
          await write(
            formatSSEEvent({
              type: 'error',
              message: err instanceof Error ? err.message : '生成失败，请重试',
            }),
          );
        }
      } finally {
        try {
          await recordUsage(quota.userId, quota.planType, 'llmCalls');
        } catch (usageErr) {
          log.warn('Memory cards stream recordUsage failed:', usageErr);
        }
        try {
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
    const message = err instanceof Error ? err.message : String(err);
    log.error('Memory cards stream API error:', message);
    return new Response(formatSSEEvent({ type: 'error', message }), {
      status: 500,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }
}
