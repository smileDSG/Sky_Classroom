/**
 * Stateless Chat API Endpoint
 *
 * POST /api/chat - Send message, receive SSE stream
 *
 * This endpoint:
 * 1. Receives full state from client (messages + storeState)
 * 2. Runs single-pass generation
 * 3. Streams events as SSE (text deltas + tool calls)
 *
 * Fully stateless: interruption is handled by the client aborting
 * the fetch request, which triggers req.signal on the server side.
 */

import { NextRequest } from 'next/server';
import { statelessGenerate } from '@/lib/orchestration/stateless-generate';
import { isProviderKeyRequired } from '@/lib/ai/providers';
import type { StatelessChatRequest, StatelessEvent } from '@/lib/types/chat';
import { apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { resolveModel } from '@/lib/server/resolve-model';
import type { ThinkingConfig } from '@/lib/types/provider';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { buildTeachingProjection } from '@/lib/adaptive-learning/profile/projection-builder';
import { buildTeachingEvidence } from '@/lib/adaptive-learning/profile/teaching-evidence';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { injectTeachingProjection } from '@/lib/assistant/context-injector';
import { getLearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { adaptiveLearningApiError } from '@/lib/adaptive-learning/api-error';
import { createInterventionDecisionDAO } from '@/lib/adaptive-learning/data/intervention-decisions';
import { createLearnerReflectionDAO } from '@/lib/adaptive-learning/data/learner-reflections';
import { runLearnerReflection } from '@/lib/adaptive-learning/profile/reflection-service';
import { generateCounterfactualDecision } from '@/lib/adaptive-learning/decision/counterfactual-decision';
import {
  recordInterventionPlanned,
  recordInterventionSelected,
} from '@/lib/adaptive-learning/profile/event-recorder';
const log = createLogger('Chat API');

// Limit message history to prevent large request bodies
const MAX_CHAT_MESSAGES = 50;

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

/**
 * POST /api/chat
 * Send a message and receive SSE stream of generation events
 *
 * Request body: StatelessChatRequest
 * {
 *   messages: UIMessage[],
 *   storeState: { stage, scenes, currentSceneId, mode },
 *   config: { agentIds, sessionType? },
 *   apiKey: string,
 *   baseUrl?: string,
 *   model?: string
 * }
 *
 * Response: SSE stream of StatelessEvent
 */
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  let chatModel: string | undefined;
  let chatMessageCount: number | undefined;

  try {
    const body: StatelessChatRequest = await req.json();
    chatModel = body.model;
    chatMessageCount = body.messages?.length;

    // Validate required fields
    if (!body.messages || !Array.isArray(body.messages)) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: messages');
    }

    // Limit message history to prevent huge request bodies
    const messages =
      body.messages.length > MAX_CHAT_MESSAGES
        ? body.messages.slice(-MAX_CHAT_MESSAGES)
        : body.messages;

    if (!body.storeState) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: storeState');
    }

    if (!body.config || !body.config.agentIds || body.config.agentIds.length === 0) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: config.agentIds');
    }

    const {
      model: languageModel,
      apiKey: resolvedApiKey,
      providerId,
    } = await resolveModel({
      modelString: body.model,
      apiKey: body.apiKey,
      baseUrl: body.baseUrl,
      providerType: body.providerType,
    });

    if (isProviderKeyRequired(providerId) && !resolvedApiKey) {
      return apiError('MISSING_API_KEY', 401, 'API Key is required');
    }

    // Check billing quota before starting LLM call
    const quota = await requireQuota('llmCalls');
    if ('error' in quota) return quota.error;

    // Load authoritative learner profile for personalised responses
    const storage = await getRequiredServerStorage();
    const profileRepository = new LearnerProfileRepository(storage);
    const preferences = await profileRepository.getLatestPreferences(quota.userId);
    if (!preferences) {
      const error = new AdaptiveLearningError({
        code: 'PROFILE_NOT_FOUND',
        message: 'Learner profile is required before using chat',
        retryable: false,
        stage: 'chat-profile-load',
      });
      return adaptiveLearningApiError(error, crypto.randomUUID());
    }

    const [knowledgeStates, learningEvents, storedReflection] = await Promise.all([
      createKnowledgeStateDAO(storage).list(quota.userId),
      profileRepository.listLearningEvents(quota.userId),
      createLearnerReflectionDAO(storage).getLatest(quota.userId),
    ]);
    let latestReflection = storedReflection;
    if (preferences.privacy.optionalBehaviorSignals) {
      latestReflection = await runLearnerReflection({
        storage,
        userId: quota.userId,
        events: learningEvents,
      }).catch(() => storedReflection);
    }
    const teachingEvidence = buildTeachingEvidence({
      states: knowledgeStates,
      eventWatermark: learningEvents.length,
    });

    const teachingProjection = buildTeachingProjection({
      userId: quota.userId,
      snapshotId: `snapshot:${preferences.userId}:v${preferences.version}:w${teachingEvidence.eventWatermark}`,
      profileVersion: preferences.version,
      eventWatermark: teachingEvidence.eventWatermark,
      preferences,
      knowledgeStatus: teachingEvidence.knowledgeStatus,
      strengths: teachingEvidence.strengths,
      growthAreas: teachingEvidence.growthAreas,
    });
    const learnerDecision = getLearnerDecision({ knowledgeStates });
    const decisionId = crypto.randomUUID();
    const sessionId = body.sessionId ?? `chat:${quota.userId}`;
    const correlationId = decisionId;
    const decisionTarget = learnerDecision.topic ?? learnerDecision.nodeId ?? '当前知识点';
    const counterfactual = await generateCounterfactualDecision({
      baseline: learnerDecision,
      knowledgeStates,
      reflection: latestReflection,
      explicitTopic: decisionTarget,
      modelRef: process.env.COUNTERFACTUAL_MODEL,
    });
    const selectedPlan =
      counterfactual.plans.find((plan) => plan.id === counterfactual.selectedPlanId) ??
      counterfactual.plans[0];
    if (!selectedPlan) {
      throw new Error('Counterfactual decision produced no selected plan');
    }
    const reflectionText = latestReflection?.hypotheses.length
      ? `\n\n【行为反思提示：非权威】\n${latestReflection.hypotheses
          .filter((hypothesis) => new Date(hypothesis.expiresAt).getTime() > Date.now())
          .map(
            (hypothesis) =>
              `- ${hypothesis.dimension}: ${hypothesis.statement}（置信度 ${Math.round(hypothesis.confidence * 100)}%，证据 ${hypothesis.evidenceEventIds.join(', ')}）`,
          )
          .join('\n')}`
      : '';
    const teachingProjectionText = `${injectTeachingProjection('', teachingProjection).trim()}${reflectionText}

【当前学习决策】
建议动作：${learnerDecision.action}。
目标：${decisionTarget}。
原因：${learnerDecision.summary}
原因码：${learnerDecision.reasonCodes.join('、')}。
此建议只调整讲解方式与节奏；用户明确提出的问题和主题优先。`;

    await createInterventionDecisionDAO(storage)
      .add({
        decisionId,
        userId: quota.userId,
        sessionId,
        stateSnapshot: {
          topic: decisionTarget,
          action: learnerDecision.action,
          difficulty: learnerDecision.difficulty,
          profileVersion: learnerDecision.profileVersion,
          eventWatermark: learnerDecision.eventWatermark,
          counterfactualStateSummary: counterfactual.stateSummary,
        },
        reflectionSnapshot: latestReflection
          ? { reflectionId: latestReflection.reflectionId, hypotheses: latestReflection.hypotheses }
          : undefined,
        candidatePlans: counterfactual.plans,
        selectedPlan,
        fallbackUsed: counterfactual.fallbackUsed,
        modelId: counterfactual.modelId,
        correlationId,
        createdAt: new Date().toISOString(),
      })
      .catch((error) => log.warn('Failed to record intervention decision:', error));
    await recordInterventionPlanned({
      storage,
      userId: quota.userId,
      source: 'chat-director',
      decisionId,
      sessionId,
      candidatePlanIds: counterfactual.plans.map((plan) => plan.id),
      fallbackUsed: counterfactual.fallbackUsed,
      correlationId,
    });
    await recordInterventionSelected({
      storage,
      userId: quota.userId,
      source: 'chat-director',
      decisionId,
      planId: selectedPlan.id,
      action: selectedPlan.action,
      topic: selectedPlan.topic ?? learnerDecision.topic,
      correlationId,
    });

    log.info('Processing request');
    log.info(
      `Agents: ${body.config.agentIds.join(', ')}, Messages: ${messages.length}, Turn: ${body.directorState?.turnCount ?? 0}`,
    );

    // Use the native request signal for abort propagation
    const signal = req.signal;

    // Create SSE stream
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Stream generation in background with heartbeat to prevent connection timeout
    const HEARTBEAT_INTERVAL_MS = 15_000;
    const MAX_QUEUE_SIZE = 50; // Backpressure: max events to queue
    (async () => {
      // Heartbeat: periodically send SSE comments to keep the connection alive.
      // Proxies / browsers may close idle SSE connections after 30-120s of silence.
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let pendingWrites = 0;
      let droppedCount = 0;

      const startHeartbeat = () => {
        stopHeartbeat();
        heartbeatTimer = setInterval(() => {
          try {
            writer.write(encoder.encode(`:heartbeat\n\n`)).catch(() => stopHeartbeat());
          } catch {
            stopHeartbeat();
          }
        }, HEARTBEAT_INTERVAL_MS);
      };
      const stopHeartbeat = () => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
      };

      try {
        startHeartbeat();

        const decisionContext: StatelessEvent = {
          type: 'decision_context',
          data: { decisionId, sessionId, correlationId },
        };
        writer.write(encoder.encode(`data: ${JSON.stringify(decisionContext)}\n\n`)).catch(() => {});

        // Default: thinking disabled for low-latency chat. UI requests send
        // `thinkingConfig`; eval harnesses can still opt in via `thinking`.
        const thinkingConfig: ThinkingConfig = body.thinkingConfig ??
          body.thinking ?? { mode: 'disabled', enabled: false };

        const generator = statelessGenerate(
          {
            ...body,
            messages,
            apiKey: resolvedApiKey,
            teachingProjection: teachingProjectionText,
          },
          signal,
          languageModel,
          thinkingConfig,
        );

        for await (const event of generator) {
          if (signal.aborted) {
            log.info('Request was aborted');
            break;
          }

          // Backpressure: skip non-critical events if client is slow
          if (pendingWrites > MAX_QUEUE_SIZE) {
            if (event.type !== 'text_delta') {
              droppedCount++;
              continue;
            }
          }

          pendingWrites++;
          const data = `data: ${JSON.stringify(event)}\n\n`;
          writer.write(encoder.encode(data)).finally(() => {
            pendingWrites--;
          });
        }

        if (droppedCount > 0) {
          log.info(`Dropped ${droppedCount} events due to backpressure`);
        }

        // Record LLM usage after successful completion
        await recordUsage(quota.userId, quota.planType, 'llmCalls');

        stopHeartbeat();
        await writer.close();
      } catch (error) {
        stopHeartbeat();

        // If aborted, just close the writer silently
        if (signal.aborted) {
          log.info('Request aborted during streaming');
          try {
            await writer.close();
          } catch {
            /* already closed */
          }
          return;
        }

        log.error(
          `Chat stream error [model=${body.model ?? 'unknown'}, agents=${body.config?.agentIds?.length ?? 0}, messages=${messages?.length ?? 0}]:`,
          error,
        );

        // Try to send error event
        try {
          const errorEvent: StatelessEvent = {
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : String(error),
            },
          };
          await writer.write(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
          await writer.close();
        } catch {
          // Writer may already be closed
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
  } catch (error) {
    log.error(
      `Chat request failed [model=${chatModel ?? 'unknown'}, messages=${chatMessageCount ?? 0}]:`,
      error,
    );
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to process request',
    );
  }
}
