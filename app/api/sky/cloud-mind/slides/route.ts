/**
 * POST /api/sky/cloud-mind/slides
 *
 * 幻灯片讲解 Agent API
 * 接收课件文本内容，调用 DeepSeek 分析并生成教学讲解。
 */

import { NextRequest } from 'next/server';
import { analyzeSlides, streamSlidesAnalysis } from '@/lib/agents/cloud-mind/slides-agent';
import { createLogger } from '@/lib/logger';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
import { createUserDAO } from '@/lib/storage/dao/users';
import { resolveLearnerDecisionForUser } from '@/lib/server/teaching-personalization';

const log = createLogger('API:CloudMindSlides');

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content, topic, stream } = body as {
      content: string;
      topic?: string;
      stream?: boolean;
    };

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return new Response(JSON.stringify({ error: '课件内容不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const quota = await requireQuota('llmCalls');
    if ('error' in quota) return quota.error;

    // 限制内容长度
    const trimmedContent = content.slice(0, 50000);

    // 获取用户个性化设置
    let personalization: Record<string, unknown> | undefined;
    try {
      const dao = await createUserDAO();
      const user = await dao.getById(quota.userId);
      if (user) {
        const decision = await resolveLearnerDecisionForUser(quota.userId, topic);
        personalization = {
          educationLevel: user.educationLevel || undefined,
          grade: user.grade || undefined,
          favoriteSubjects: user.favoriteSubjects || undefined,
          learningStyle: user.learningStyle || undefined,
          detailLevel: user.detailLevel || undefined,
          preferredLanguage: user.preferredLanguage || undefined,
          aiPersonality: user.aiPersonality || undefined,
          aiName: user.aiName || undefined,
          customInstructions: user.customInstructions || undefined,
          enableRAG: user.enableRAG ?? true,
          adaptiveDifficulty: decision?.difficulty,
          adaptiveFormat: decision?.format,
          adaptiveTopic: decision?.topic ?? topic,
          adaptiveExplanationMode: decision?.explanationMode,
          adaptiveReasonCodes: decision?.reasonCodes,
        };
      }
    } catch {
      // 未登录或获取失败，使用默认设置
    }

    if (stream) {
      // 流式响应
      const readableStream = await streamSlidesAnalysis(trimmedContent, topic);
      await recordUsage(quota.userId, quota.planType, 'llmCalls');
      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // 非流式响应
    const result = await analyzeSlides(trimmedContent, topic, personalization);
    await recordUsage(quota.userId, quota.planType, 'llmCalls');
    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Slides analysis failed:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
