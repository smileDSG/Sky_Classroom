/**
 * POST /api/sky/assistant
 * AI assistant chat endpoint — real LLM-powered with SSE streaming.
 * Injects authenticated learner context for personalised responses.
 */
import { NextRequest } from 'next/server';
import { streamLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import { resolveModel } from '@/lib/server/resolve-model';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { buildGraphFromMistakes } from '@/lib/graph/builder';
import { buildSystemPrompt } from '@/lib/assistant/context-injector';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import { buildTeachingProjection } from '@/lib/adaptive-learning/profile/projection-builder';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import { adaptiveLearningApiError } from '@/lib/adaptive-learning/api-error';

const log = createLogger('API:SkyAssistant');

export const maxDuration = 30;

let _daoPromise: ReturnType<typeof initDAO> | null = null;

async function initDAO() {
  const storage = await getRequiredServerStorage();
  return createMistakeBookDAO(storage);
}

async function getDAO() {
  if (!_daoPromise) {
    _daoPromise = initDAO().catch((error) => {
      _daoPromise = null;
      throw error;
    });
  }
  return _daoPromise;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const { messages, subject, difficulty, style } = body as {
      messages: { role: string; content: string }[];
      subject?: string;
      difficulty?: string;
      style?: string;
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { model, modelInfo, thinkingConfig } = await resolveModel({
      modelString: body.model || 'openrouter:deepseek-v4-pro',
      apiKey: body.apiKey || process.env.OPENROUTER_API_KEY || '',
      baseUrl: body.baseUrl || process.env.OPENROUTER_BASE_URL || '',
      providerType: body.providerType,
    });

    // Load authoritative learner profile for personalised responses
    const storage = await getRequiredServerStorage();
    const profileRepository = new LearnerProfileRepository(storage);
    const preferences = await profileRepository.getLatestPreferences(auth.user.id);
    if (!preferences) {
      const error = new AdaptiveLearningError({
        code: 'PROFILE_NOT_FOUND',
        message: 'Learner profile is required before using the assistant',
        retryable: false,
        stage: 'assistant-profile-load',
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

    // Load student context for personalised responses
    const dao = await getDAO();
    const mistakePage = await dao.list(auth.user.id, { pageSize: 9999 });
    const mistakes = mistakePage.items;
    const graphNodes = mistakes.length > 0 ? buildGraphFromMistakes(mistakes).nodes : null;

    const subj = subject || '数学';

    const systemPrompt = buildSystemPrompt(subj, difficulty || 'junior', style || 'detailed', {
      mistakes,
      graphNodes: graphNodes ?? undefined,
      teachingProjection,
    });

    // Convert messages — exclude system messages since we pass via system param
    const aiMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const generation = streamLLM(
      {
        model,
        system: systemPrompt,
        messages: aiMessages,
        maxOutputTokens: modelInfo?.outputWindow,
      },
      'sky-assistant',
      thinkingConfig,
    );

    // Pipe the AI SDK stream as SSE
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        for await (const chunk of generation.textStream) {
          const event = `data: ${JSON.stringify({ type: 'text_delta', content: chunk })}\n\n`;
          await writer.write(encoder.encode(event));
        }
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        await writer.close();
      } catch (error) {
        log.error('SkyAssistant stream error:', error);
        try {
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : String(error) })}\n\n`,
            ),
          );
          await writer.close();
        } catch {
          /* already closed */
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
  } catch (err) {
    log.error('Assistant API error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'AI 助手响应失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
