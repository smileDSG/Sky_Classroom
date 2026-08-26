/**
 * POST /api/sky/cloud-mind/memory-cards
 *
 * 记忆卡片 Agent API
 * 接收知识点/学习内容，或基于学情自动推导，调用 DeepSeek 生成记忆卡片。
 */

import { NextRequest } from 'next/server';
import { generateMemoryCards } from '@/lib/agents/cloud-mind/memory-cards-agent';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { deriveMemoryParamsFromProfile } from '@/lib/student/memory-param-deriver';
import { createLogger } from '@/lib/logger';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
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

    let profile: Awaited<ReturnType<typeof buildStudentProfile>> | undefined;
    if (auto || !content) profile = await buildStudentProfile(auth.user.id);

    // Auto-derive parameters from the student profile
    let derived: ReturnType<typeof deriveMemoryParamsFromProfile> | undefined;
    if (auto || !content) {
      if (!profile) return new Response(JSON.stringify({ error: '学情数据不可用' }), { status: 400 });
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
      teachingProjectionText,
    );

    await recordUsage(quota.userId, quota.planType, 'llmCalls');

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
        meta: {
          profileInjected: true,
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
