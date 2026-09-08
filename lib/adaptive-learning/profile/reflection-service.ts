import { z } from 'zod';

import type { LearningEvent } from '@/lib/adaptive-learning/contracts';
import {
  createLearnerReflectionDAO,
  learnerReflectionHypothesisSchema,
  type LearnerReflection,
} from '@/lib/adaptive-learning/data/learner-reflections';
import { resolveApiKey } from '@/lib/server/provider-config';
import type { ProviderId } from '@/lib/types/provider';
import type { StorageProvider } from '@/lib/storage/storage-types';

const REFLECTION_EVENT_THRESHOLD = 10;
const REFLECTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

const llmOutputSchema = z
  .object({
    hypotheses: z.array(learnerReflectionHypothesisSchema).max(8),
  })
  .strict();

export interface ReflectionTriggerStatus {
  shouldRun: boolean;
  reason: 'event-threshold' | 'time-threshold' | 'no-reflection' | 'up-to-date';
  pendingEventCount: number;
  latestReflection: LearnerReflection | null;
}

function eventText(event: LearningEvent): string {
  return `${event.occurredAt} ${event.type} nodes=${event.nodeIds.join(',') || '-'} payload=${JSON.stringify(event.payload)}`;
}

function ruleHypotheses(events: LearningEvent[], now: Date) {
  const sourceEventIds = events.map((event) => event.eventId);
  const expiresAt = new Date(now.getTime() + 30 * REFLECTION_INTERVAL_MS).toISOString();
  const hypotheses: Array<z.infer<typeof learnerReflectionHypothesisSchema>> = [];
  const answers = events.filter((event) => event.type === 'answer-submitted');
  const sessions = events.filter((event) => event.type === 'session-completed');
  const exits = events.filter((event) => event.type === 'session-exited');
  const reviewEvents = events.filter((event) => event.type === 'review-completed');
  const incorrect = answers.filter((event) => event.payload.correct === false);

  if (answers.length > 0) {
    const rate = incorrect.length / answers.length;
    hypotheses.push({
      dimension: 'knowledge',
      statement: `近期开题记录中错误比例约 ${Math.round(rate * 100)}%，需结合知识点证据安排练习。`,
      confidence: Math.min(0.85, 0.35 + answers.length / 30),
      evidenceEventIds: answers.slice(-8).map((event) => event.eventId),
      expiresAt,
    });
  }
  if (incorrect.length >= 2) {
    hypotheses.push({
      dimension: 'error-pattern',
      statement: '近期出现重复错误，下一步应优先拆解错因，再提高题目难度。',
      confidence: Math.min(0.9, 0.45 + incorrect.length / 20),
      evidenceEventIds: incorrect.slice(-8).map((event) => event.eventId),
      expiresAt,
    });
  }
  if (exits.length > 0) {
    hypotheses.push({
      dimension: 'persistence',
      statement: '学习 session 存在中途退出记录，长任务应拆成更短步骤并设置阶段反馈。',
      confidence: Math.min(0.8, 0.45 + exits.length / 10),
      evidenceEventIds: exits.slice(-8).map((event) => event.eventId),
      expiresAt,
    });
  }
  if (sessions.length > 0 && sessions.length >= reviewEvents.length) {
    hypotheses.push({
      dimension: 'intervention-response',
      statement: '近期完成学习 session，可继续记录不同干预动作与结果的对应关系。',
      confidence: 0.5,
      evidenceEventIds: sessions.slice(-8).map((event) => event.eventId),
      expiresAt,
    });
  }
  return { hypotheses, sourceEventIds };
}

function parseModelRef(ref: string): { providerId: ProviderId; modelId: string } {
  const [providerId, ...modelParts] = ref.split(':');
  if (!providerId || modelParts.length === 0) throw new Error('Invalid reflection model reference');
  return { providerId: providerId as ProviderId, modelId: modelParts.join(':') };
}

async function enrichWithLLM(
  events: LearningEvent[],
  fallback: ReturnType<typeof ruleHypotheses>,
): Promise<{ hypotheses: ReturnType<typeof ruleHypotheses>['hypotheses']; modelId: string }> {
  const modelRef = process.env.LEARNER_REFLECTION_MODEL ?? process.env.DEFAULT_MODEL;
  if (!modelRef) return { hypotheses: fallback.hypotheses, modelId: 'rules-v1' };
  const { providerId, modelId } = parseModelRef(modelRef);
  const apiKey = resolveApiKey(providerId);
  if (!apiKey) return { hypotheses: fallback.hypotheses, modelId: 'rules-v1' };
  // Lazy-load model code: rule-only reflection must work without provider config
  // and must not initialize the full LLM registry on every profile read.
  const [{ callLLM }, { getModel }] = await Promise.all([
    import('@/lib/ai/llm'),
    import('@/lib/ai/providers'),
  ]);
  const { model } = getModel({ providerId, modelId, apiKey });
  const result = await callLLM(
    {
      model,
      system:
        '你是学习行为反思器。只提炼可被事件证据支持的行为假设，不改变已验证知识掌握度。只输出 JSON：{"hypotheses":[{"dimension":"...","statement":"...","confidence":0到1,"evidenceEventIds":[...],"expiresAt":"ISO时间"}]}。',
      prompt: events.slice(-40).map(eventText).join('\n'),
      temperature: 0.2,
      maxOutputTokens: 1800,
    },
    'learner-reflection',
    { retries: 1, timeoutMs: 20_000, validate: (text) => text.includes('hypotheses') },
  );
  const parsed = llmOutputSchema.safeParse(JSON.parse(result.text));
  if (!parsed.success) throw new Error('Reflection LLM output failed schema validation');
  const sourceIds = new Set(fallback.sourceEventIds);
  const hypotheses = parsed.data.hypotheses.filter((hypothesis) =>
    hypothesis.evidenceEventIds.every((eventId) => sourceIds.has(eventId)),
  );
  return { hypotheses: hypotheses.length > 0 ? hypotheses : fallback.hypotheses, modelId };
}

export async function getReflectionTriggerStatus(
  storage: StorageProvider,
  userId: string,
  events: LearningEvent[],
  now = new Date(),
): Promise<ReflectionTriggerStatus> {
  const latestReflection = await createLearnerReflectionDAO(storage).getLatest(userId);
  const pendingEventCount = latestReflection
    ? events.filter((event) => event.occurredAt > latestReflection.windowEnd).length
    : events.length;
  if (!latestReflection) {
    return {
      shouldRun: events.length > 0,
      reason: 'no-reflection',
      pendingEventCount,
      latestReflection,
    };
  }
  if (pendingEventCount >= REFLECTION_EVENT_THRESHOLD) {
    return { shouldRun: true, reason: 'event-threshold', pendingEventCount, latestReflection };
  }
  if (
    pendingEventCount > 0 &&
    now.getTime() - new Date(latestReflection.generatedAt).getTime() >= REFLECTION_INTERVAL_MS
  ) {
    return { shouldRun: true, reason: 'time-threshold', pendingEventCount, latestReflection };
  }
  return { shouldRun: false, reason: 'up-to-date', pendingEventCount, latestReflection };
}

export async function runLearnerReflection(input: {
  storage: StorageProvider;
  userId: string;
  events: LearningEvent[];
  now?: Date;
}): Promise<LearnerReflection | null> {
  const now = input.now ?? new Date();
  const status = await getReflectionTriggerStatus(input.storage, input.userId, input.events, now);
  if (!status.shouldRun) return status.latestReflection;
  const sourceEvents = input.events.filter((event) =>
    status.latestReflection ? event.occurredAt > status.latestReflection.windowEnd : true,
  );
  if (sourceEvents.length === 0) return status.latestReflection;
  const fallback = ruleHypotheses(sourceEvents, now);
  let enriched = { hypotheses: fallback.hypotheses, modelId: 'rules-v1' };
  try {
    enriched = await enrichWithLLM(sourceEvents, fallback);
  } catch {
    // Rules remain valid fallback when provider/key/output is unavailable.
  }
  return createLearnerReflectionDAO(input.storage).add({
    reflectionId: `reflection:${input.userId}:${now.getTime()}`,
    userId: input.userId,
    windowStart: sourceEvents[0].occurredAt,
    windowEnd: sourceEvents[sourceEvents.length - 1].occurredAt,
    hypotheses: enriched.hypotheses,
    sourceEventIds: fallback.sourceEventIds,
    modelId: enriched.modelId,
    generatedAt: now.toISOString(),
    inputEventWatermark: input.events.length,
  });
}
