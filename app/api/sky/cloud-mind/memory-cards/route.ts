/**
 * POST /api/sky/cloud-mind/memory-cards
 *
 * 记忆卡片 Agent API
 * 接收知识点/学习内容，调用 DeepSeek 生成记忆卡片。
 */

import { NextRequest } from 'next/server';
import { generateMemoryCards } from '@/lib/agents/cloud-mind/memory-cards-agent';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:CloudMindMemoryCards');

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, topic, cardCount } = body as {
      content: string;
      topic?: string;
      cardCount?: number;
    };

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: '学习内容不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 限制内容长度
    const trimmedContent = content.slice(0, 30000);

    const result = await generateMemoryCards(trimmedContent, topic, cardCount);

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

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Memory cards generation failed:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}