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