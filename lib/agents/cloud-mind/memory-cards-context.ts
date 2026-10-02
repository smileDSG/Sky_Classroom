/**
 * 记忆卡片生成前的共享上下文构建（普通路由与流式路由复用）。
 * 加载学情偏好、构建教学投影，并按需推导生成参数。
 */

import { buildStudentProfile } from '@/lib/student/profile-builder';
import { deriveMemoryParamsFromProfile } from '@/lib/student/memory-param-deriver';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { buildTeachingProjection } from '@/lib/adaptive-learning/profile/projection-builder';
import { injectTeachingProjection } from '@/lib/assistant/context-injector';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

export interface MemoryCardsGenerationContext {
  /** 截断后的学习内容 */
  content: string;
  topic?: string;
  cardCount?: number;
  teachingProjectionText: string;
  derived?: ReturnType<typeof deriveMemoryParamsFromProfile>;
}

export async function buildMemoryCardsGenerationContext(
  userId: string,
  input: { content?: string; topic?: string; cardCount?: number; auto?: boolean },
): Promise<MemoryCardsGenerationContext> {
  const { content, topic, cardCount, auto } = input;

  const storage = await getRequiredServerStorage();
  const profileRepository = new LearnerProfileRepository(storage);
  const preferences = await profileRepository.getLatestPreferences(userId);
  if (!preferences) {
    throw new AdaptiveLearningError({
      code: 'PROFILE_NOT_FOUND',
      message: 'Learner profile is required before generating memory cards',
      retryable: false,
      stage: 'memory-cards-profile-load',
    });
  }

  const teachingProjection = buildTeachingProjection({
    userId,
    snapshotId: `snapshot:${preferences.userId}:v${preferences.version}:w0`,
    profileVersion: preferences.version,
    eventWatermark: 0,
    preferences,
    knowledgeStatus: 'no-evidence',
  });
  const teachingProjectionText = injectTeachingProjection('', teachingProjection).trim();

  let profile: Awaited<ReturnType<typeof buildStudentProfile>> | undefined;
  if (auto || !content) profile = await buildStudentProfile(userId);

  let derived: ReturnType<typeof deriveMemoryParamsFromProfile> | undefined;
  if (auto || !content) {
    if (!profile) {
      throw new AdaptiveLearningError({
        code: 'PROFILE_NOT_FOUND',
        message: 'Learner profile is required before generating memory cards',
        retryable: false,
        stage: 'memory-cards-profile-load',
      });
    }
    derived = deriveMemoryParamsFromProfile(profile);
  }

  const finalContent = content || derived?.content || '';
  const finalTopic = topic || derived?.topic;
  const finalCardCount = cardCount || derived?.cardCount;

  return {
    content: finalContent.slice(0, 30000),
    topic: finalTopic,
    cardCount: finalCardCount,
    teachingProjectionText,
    derived,
  };
}
