/**
 * POST /api/sky/cloud-mind/memory-cards
 *
 * 记忆卡片 Agent API
 * 接收知识点/学习内容，调用 DeepSeek 生成记忆卡片。
 */

import { NextRequest } from 'next/server';
import { generateMemoryCards } from '@/lib/agents/cloud-mind/memory-cards-agent';
import { createLogger } from '@/lib/logger';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { buildTeachingProjection } from '@/lib/adaptive-learning/profile/projection-builder';
import { injectTeachingProjection } from '@/lib/assistant/context-injector';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { adaptiveLearningApiError } from '@/lib/adaptive-learning/api-error';

const log = createLogger('API:CloudMindMemoryCards');

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

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

    // Load authoritative learner profile for personalised card generation
    const storage = await getRequiredServerStorage();
    const profileRepository = new LearnerProfileRepository(storage);
    const preferences = await profileRepository.getLatestPreferences(auth.user.id);
    if (!preferences) {
      const error = new AdaptiveLearningError({
        code: 'PROFILE_NOT_FOUND',
        message: 'Learner profile is required before generating memory cards',
        retryable: false,
        stage: 'memory-cards-profile-load',
      });
      return adaptiveLearningApiError(error, crypto.randomUUID());
    }

    const teachingProjection = buildTeachingProjection({
      userId: auth.user.id,
      snapshotId: `snapshot:${preferences.userId}:v${preferences.version}:w0`,
      profileVersion: preferences.version,
      eventWatermark: 0,
      preferences,
      knowledgeStatus: 'no-evidence',
    });
    const teachingProjectionText = injectTeachingProjection('', teachingProjection).trim();

    // 限制内容长度
    const trimmedContent = content.slice(0, 30000);

    const result = await generateMemoryCards(trimmedContent, topic, cardCount, teachingProjectionText);

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