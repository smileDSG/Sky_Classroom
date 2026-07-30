/**
 * POST /api/sky/assistant
 * AI assistant chat endpoint — real LLM-powered with SSE streaming.
 * Injects mistake-book, knowledge-graph, and GAM-style memory context
 * for personalised responses.
 */
import { NextRequest } from 'next/server';
import { streamLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import { resolveModel } from '@/lib/server/resolve-model';
import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { buildGraphFromMistakes } from '@/lib/graph/builder';
import { buildSystemPrompt } from '@/lib/assistant/context-injector';
import {
  buildAssistantActionPlan,
  buildAssistantPersonalizationPrompt,
  buildAssistantRagEvidence,
  buildAssistantStrategy,
  pickPersonalizationFromUser,
} from '@/lib/assistant/personalization';
import { apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getCurrentUser } from '@/lib/server/auth/helpers';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import type { GraphNode } from '@/lib/graph/types';
import type { StudentProfile } from '@/lib/student/profile-types';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import type { UserEntry } from '@/lib/storage/dao/users';
import type { QuestionBankEntry } from '@/lib/solve/types';

const log = createLogger('API:SkyAssistant');

export const maxDuration = 30;

let _daoPromise: ReturnType<typeof initDAO> | null = null;

async function initDAO() {
  const storage = await getServerStorage();
  return createMistakeBookDAO(storage);
}

async function getDAO() {
  if (!_daoPromise) _daoPromise = initDAO();
  return _daoPromise;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, subject, difficulty, style, memoryContext } = body as {
      messages: { role: string; content: string }[];
      subject?: string;
      difficulty?: string;
      style?: string;
      memoryContext?: string; // GAM-style memory context from client
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, 'messages is required');
    }

    // Convert messages — exclude system messages since we pass via system param
    const aiMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    const latestUserMessage =
      [...aiMessages].reverse().find((m) => m.role === 'user')?.content ?? '';

    const { model, modelInfo, thinkingConfig } = await resolveModel({
      modelString: body.model || 'openrouter:deepseek-v4-pro',
      apiKey: body.apiKey || process.env.OPENROUTER_API_KEY || '',
      baseUrl: body.baseUrl || process.env.OPENROUTER_BASE_URL || '',
      providerType: body.providerType,
    });

    // Load student context for personalised responses
    let currentUser: UserEntry | null = null;
    let profile: StudentProfile | null = null;
    try {
      currentUser = await getCurrentUser();
      const personalization = pickPersonalizationFromUser(currentUser);
      if (currentUser && personalization.enableMemory !== false) {
        profile = await buildStudentProfile(currentUser.id);
      }
    } catch (err) {
      log.warn('Failed to load user profile context, continuing without it:', err);
    }

    const personalization = pickPersonalizationFromUser(currentUser);
    const allowMemory = personalization.enableMemory !== false;
    const allowRag = personalization.enableRAG !== false;

    let mistakes: MistakeBookEntry[] | null = null;
    let graphNodes: GraphNode[] | null = null;
    let solveHistory: QuestionBankEntry[] | null = null;
    try {
      if (!currentUser) throw new Error('No authenticated user');
      const dao = await getDAO();
      const result = await dao.list(currentUser.id, { pageSize: 9999 });
      mistakes = result.items;
      if (mistakes.length > 0) {
        const graph = buildGraphFromMistakes(mistakes);
        graphNodes = graph.nodes;
      }
    } catch (err) {
      log.warn('Failed to load mistake context, continuing without it:', err);
    }
    try {
      const { listQuestionBankEntries } = await import('@/lib/solve/question-bank');
      solveHistory = await listQuestionBankEntries(10);
    } catch (err) {
      log.warn('Failed to load question bank, continuing without it:', err);
    }

    const subj = subject || '数学';

    // Check if client already sent a system message (e.g. Kagami persona)
    const clientSystemMsg = messages.find((m) => m.role === 'system');

    let systemPrompt: string;
    if (clientSystemMsg) {
      // Use client's system message as base, append learning context
      systemPrompt = clientSystemMsg.content;
      if (allowMemory && mistakes && mistakes.length > 0) {
        const ctx = buildSystemPrompt(subj, difficulty || 'junior', style || 'detailed', {
          mistakes: mistakes,
          graphNodes: graphNodes ?? undefined,
          solveHistory: allowRag ? (solveHistory ?? undefined) : undefined,
        });
        systemPrompt += '\n\n' + ctx.split('\n').slice(1).join('\n'); // append context without duplicating base
      }
    } else {
      systemPrompt = buildSystemPrompt(subj, difficulty || 'junior', style || 'detailed', {
        mistakes: allowMemory ? (mistakes ?? undefined) : undefined,
        graphNodes: allowMemory ? (graphNodes ?? undefined) : undefined,
        solveHistory: allowRag ? (solveHistory ?? undefined) : undefined,
      });
    }

    // Inject GAM-style memory context if provided by client
    if (memoryContext) {
      systemPrompt += '\n\n' + memoryContext;
    }

    const strategy = buildAssistantStrategy({
      userMessage: latestUserMessage,
      style: style || 'detailed',
      profile: allowMemory ? profile : null,
      personalization,
    });
    const evidence = allowRag
      ? buildAssistantRagEvidence({
          userMessage: latestUserMessage,
          mistakes: allowMemory ? mistakes : null,
          graphNodes: allowMemory ? graphNodes : null,
          solveHistory,
        })
      : null;
    const actionPlan = buildAssistantActionPlan(latestUserMessage);
    systemPrompt += buildAssistantPersonalizationPrompt({
      userMessage: latestUserMessage,
      strategy,
      evidence,
      actionPlan,
      personalization,
    });

    const result = streamLLM(
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
        for await (const chunk of result.textStream) {
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
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      err instanceof Error ? err.message : 'AI 助手响应失败',
    );
  }
}
