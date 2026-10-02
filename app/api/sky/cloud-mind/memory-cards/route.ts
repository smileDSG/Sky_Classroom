/**
 * POST /api/sky/cloud-mind/memory-cards
 *
 * 记忆卡片 Agent API
 * 接收知识点/学习内容，或基于学情自动推导，调用 DeepSeek 生成记忆卡片。
 */

import { NextRequest } from 'next/server';
import { generateMemoryCards } from '@/lib/agents/cloud-mind/memory-cards-agent';
import { buildMemoryCardsGenerationContext } from '@/lib/agents/cloud-mind/memory-cards-context';
import { createLogger } from '@/lib/logger';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
import { requireAuth } from '@/lib/server/auth/helpers';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { adaptiveLearningApiError } from '@/lib/adaptive-learning/api-error';

const log = createLogger('API:CloudMindMemoryCards');

export const maxDuration = 60;

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
      return new Response(JSON.stringify({ error: '学习内容不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
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
      return new Response(JSON.stringify({ error: '学习内容不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await generateMemoryCards(
      context.content,
      context.topic,
      context.cardCount,
      context.teachingProjectionText,
    );

    await recordUsage(quota.userId, quota.planType, 'llmCalls');

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        meta: {
          profileInjected: true,
          derived: context.derived
            ? {
                topic: context.derived.topic,
                cardCount: context.derived.cardCount,
                difficulty: context.derived.difficulty,
                reviewIntervals: context.derived.reviewIntervals,
              }
            : undefined,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Memory cards generation failed:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
