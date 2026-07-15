/**
 * POST /api/sky/cloud-mind/memory-cards
 *
 * 记忆卡片 Agent API
 * 接收知识点/学习内容，或基于学情自动推导，调用 DeepSeek 生成记忆卡片。
 */

import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { generateMemoryCards } from '@/lib/agents/cloud-mind/memory-cards-agent';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { deriveMemoryParamsFromProfile } from '@/lib/student/memory-param-deriver';
import { verifyAccessToken } from '@/lib/server/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:CloudMindMemoryCards');

export const maxDuration = 60;

async function resolveUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    if (!accessToken) return null;
    const payload = await verifyAccessToken(accessToken.value);
    return payload?.sub ?? null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, topic, cardCount, auto } = body as {
      content?: string;
      topic?: string;
      cardCount?: number;
      auto?: boolean;
    };

    const userId = await resolveUserId();
    let profile = userId ? await buildStudentProfile(userId) : undefined;

    // Auto-derive parameters from the student profile
    let derived: ReturnType<typeof deriveMemoryParamsFromProfile> | undefined;
    if (auto || !content) {
      if (!profile) {
        return new Response(
          JSON.stringify({ error: '需要登录且存在学情数据才能自动生成卡片' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      derived = deriveMemoryParamsFromProfile(profile);
    }

    const finalContent = content || derived?.content || '';
    const finalTopic = topic || derived?.topic;
    const finalCardCount = cardCount || derived?.cardCount;

    if (!finalContent || finalContent.trim().length === 0) {
      return new Response(JSON.stringify({ error: '学习内容不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 限制内容长度
    const trimmedContent = finalContent.slice(0, 30000);

    const result = await generateMemoryCards(
      trimmedContent,
      finalTopic,
      finalCardCount,
      profile,
    );

    // Save to cards knowledge base (fire and forget)
    try {
      const { write } = await import('@/lib/knowledge-base/kb-manager');
      const kbContent = JSON.stringify({
        topic: result.topic,
        description: result.description,
        cardCount: result.cards.length,
        cards: result.cards.map((c) => ({
          front: c.front,
          back: c.back,
          difficulty: c.difficulty,
          tags: c.tags,
        })),
        studyTips: result.studyTips,
      });
      write({
        kbType: 'cards',
        title: `卡片: ${result.topic}`,
        content: kbContent,
        tags: result.cards[0]?.tags || [],
        sourceId: `cards-${Date.now()}`,
        verified: true,
      }).catch((e) => log.warn('KB save failed:', e));
    } catch {
      // ignore KB save errors
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        meta: {
          profileInjected: Boolean(profile),
          derived: derived
            ? {
                topic: derived.topic,
                cardCount: derived.cardCount,
                difficulty: derived.difficulty,
                reviewIntervals: derived.reviewIntervals,
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
