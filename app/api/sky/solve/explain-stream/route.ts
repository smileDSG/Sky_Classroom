/**
 * POST /api/sky/solve/explain-stream
 *
 * Uses the multi-agent solve chain (analyze → solve → verify → correct → knowledge → similar)
 * and streams each step via SSE.
 *
 * SSE event types:
 *   phase         — status transition (checking/analyzing/solving/verifying/knowledge/similar/done)
 *   analysis      —题目分析结果（学科/知识点/难度/题型）
 *   step          — a single solution step
 *   answer        — final answer extracted
 *   verification  — 校验结果（isCorrect/confidence/reasoning）
 *   knowledge     — knowledge points
 *   similar       — similar questions
 *   done          — streaming complete, includes metadata
 *   error         — error occurred
 *
 * Backward compatible: unknown event types are silently ignored by older clients.
 */

import { createLogger } from '@/lib/logger';
import { findSimilarQuestions } from '@/lib/solve/question-bank';
import { findSolveCacheMatches } from '@/lib/solve/solve-cache';
import { type StreamEvent } from '@/lib/solve/streaming-solver';
import { runSolveChain } from '@/lib/solve/solve-chain';
import { analyzeProblem } from '@/lib/solve/agents/analyze-agent';
import { postProcessMathContent } from '@/lib/solve/math-postprocessor';

const log = createLogger('API:ExplainStream');

// ── Map analysis subject to solver agent type ──────────────────────

function subjectToAgentId(
  subject:
    | 'math'
    | 'physics'
    | 'chemistry'
    | 'biology'
    | 'chinese'
    | 'english'
    | 'history'
    | 'geography'
    | 'politics'
    | 'unknown'
    | undefined,
): 'universal' | 'science' | 'humanities' | 'grading' {
  switch (subject) {
    case 'math':
    case 'physics':
    case 'chemistry':
    case 'biology':
      return 'science';
    case 'chinese':
    case 'english':
    case 'history':
    case 'geography':
    case 'politics':
      return 'humanities';
    default:
      return 'universal';
  }
}

// ── SSE formatting ──────────────────────────────────────────────────

function formatStreamEvent(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function formatSSEEvent(type: string, data: Record<string, unknown> = {}): string {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`;
}

// ── Knowledge points helper (for bank/cache hit path) ───────────────

async function generateKnowledgePoints(
  problemText: string,
  answer: string,
): Promise<{ name: string; description: string; difficulty: string }[]> {
  try {
    const { callLLM } = await import('@/lib/ai/llm');
    const { getModel } = await import('@/lib/ai/providers');
    const { parseJsonResponse } = await import('@/lib/generation/json-repair');
    const { resolveSolverModel } = await import('@/lib/solve/solver-constants');
    const { buildKnowledgePointsPrompt } = await import('@/lib/solve/solver-prompts');

    const modelConfig = resolveSolverModel('universal');
    const modelWithInfo = getModel(modelConfig);
    const prompt = buildKnowledgePointsPrompt(problemText, answer);

    const result = await callLLM(
      {
        model: modelWithInfo.model,
        messages: [{ role: 'user', content: prompt }] as any,
        temperature: 0.3,
        maxOutputTokens: 1024,
      },
      'knowledge-gen',
      { retries: 1 },
      undefined,
      '你是知识点总结专家。请直接输出 JSON，不要输出其他内容。',
    );

    const parsed = parseJsonResponse<any>(result.text || '');
    if (parsed && Array.isArray(parsed.knowledgePoints)) {
      return parsed.knowledgePoints.map((k: any) => ({
        name: k.name || '',
        description: k.description || '',
        difficulty: k.difficulty || 'medium',
      }));
    }
  } catch (err) {
    log.warn('Failed to generate knowledge points:', err);
  }
  return [];
}

// ── POST handler ────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { problem, problemImage, userAnswer } = body;

    if (!problem) {
      return new Response(formatSSEEvent('error', { message: 'Missing required field: problem' }), {
        status: 400,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    log.info(`[ExplainStream] Solving: ${problem.slice(0, 60)}...`);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const write = async (data: string) => {
      await writer.write(encoder.encode(data));
    };

    // ── Async worker ────────────────────────────────────────────────
    // Bind client disconnect detection to abort chain
    const chainAbort = new AbortController();
    req.signal.addEventListener('abort', () => {
      chainAbort.abort();
      log.info('[ExplainStream] Client disconnected, aborting chain');
    });

    const workerPromise = (async () => {
      try {
        // Phase 1: Check question bank and solve cache in parallel
        await write(formatSSEEvent('phase', { phase: 'checking' }));
        const [bankMatches, cacheMatches] = await Promise.all([
          findSimilarQuestions(problem, 0.85),
          findSolveCacheMatches(problem, 0.8),
        ]);

        // ── Fast path: Question bank hit ─────────────────────────────
        if (bankMatches.length > 0) {
          const hit = bankMatches[0];
          log.info(`[ExplainStream] Question bank hit (${hit._similarity?.toFixed(2)})`);

          const processedAnswer = postProcessMathContent(hit.answer);
          const processedSolution = hit.solution
            ? postProcessMathContent(hit.solution)
            : processedAnswer;
          await write(formatSSEEvent('solution', { solution: processedSolution }));
          // Emit actual steps from the bank entry if available (avoid duplicating solution)
          if (hit.steps && hit.steps.length > 0) {
            for (const step of hit.steps) {
              await write(
                formatSSEEvent('step', {
                  label: step.label,
                  content: postProcessMathContent(step.content),
                  keyPoints: (step.keyPoints ?? []).map(postProcessMathContent),
                }),
              );
            }
          }
          await write(formatSSEEvent('answer', { answer: processedAnswer }));

          const kp =
            hit.knowledgePoints && hit.knowledgePoints.length > 0
              ? hit.knowledgePoints.map((k) => ({
                  name: postProcessMathContent(k.name),
                  description: postProcessMathContent(k.description),
                  difficulty: k.difficulty,
                }))
              : await generateKnowledgePoints(problem, hit.answer);
          await write(formatSSEEvent('knowledge', { points: kp }));
          await write(formatSSEEvent('similar', { questions: [] }));
          await write(
            formatSSEEvent('done', {
              fromQuestionBank: true,
              solvingTime: 0,
            }),
          );
          await writer.close();
          return;
        }

        // ── Fast path: Solve cache hit ───────────────────────────────
        if (cacheMatches.length > 0) {
          const hit = cacheMatches[0];
          log.info(`[ExplainStream] Solve cache hit`);

          const processedSolution = postProcessMathContent(hit.solution);
          const conciseAnswer = postProcessMathContent(hit.answer || hit.solution);

          await write(formatSSEEvent('solution', { solution: processedSolution }));
          // Don't emit a step duplicating the solution — the UI will show
          // the solution block directly; steps come from the actual chain.
          await write(formatSSEEvent('answer', { answer: conciseAnswer }));

          // Use cached knowledge points if available, avoid LLM call
          const kp =
            hit.knowledgePoints && hit.knowledgePoints.length > 0
              ? hit.knowledgePoints.map((k) => ({
                  name: postProcessMathContent(k.name),
                  description: postProcessMathContent(k.description),
                  difficulty: k.difficulty,
                }))
              : await generateKnowledgePoints(problem, hit.solution);
          await write(formatSSEEvent('knowledge', { points: kp }));
          await write(formatSSEEvent('similar', { questions: [] }));
          await write(
            formatSSEEvent('done', {
              fromSolveCache: true,
              solvingTime: 0,
            }),
          );
          await writer.close();
          return;
        }

        // ── Main path: Run the full solve chain ──────────────────────
        // Start analyze in parallel (it only needs problemText, no deps)
        const analyzePromise = analyzeProblem(problem);

        const chainResult = await runSolveChain(
          problem,
          problemImage ?? null,
          // Forward streaming events (step/answer/knowledge/similar/phase) to SSE
          (event) => {
            let processedEvent: StreamEvent = event;
            if (event.type === 'solution') {
              processedEvent = { ...event, solution: postProcessMathContent(event.solution) };
            } else if (event.type === 'step') {
              processedEvent = {
                ...event,
                content: postProcessMathContent(event.content),
                keyPoints: (event.keyPoints ?? []).map(postProcessMathContent),
              };
            } else if (event.type === 'answer') {
              processedEvent = { ...event, answer: postProcessMathContent(event.answer) };
            } else if (event.type === 'knowledge') {
              processedEvent = {
                ...event,
                points: event.points.map((p) => ({
                  ...p,
                  name: postProcessMathContent(p.name),
                  description: postProcessMathContent(p.description),
                })),
              };
            } else if (event.type === 'similar') {
              processedEvent = {
                ...event,
                questions: event.questions.map((q) => ({
                  ...q,
                  problem: postProcessMathContent(q.problem),
                })),
              };
            }
            write(formatStreamEvent(processedEvent));
          },
          chainAbort.signal,
          analyzePromise,
        );

        // ── Emit analysis event (NEW in C-004) ───────────────────────
        if (chainResult.analysis) {
          await write(
            formatSSEEvent('analysis', {
              subject: chainResult.analysis.subject,
              knowledgePoints: chainResult.analysis.knowledgePoints,
              difficulty: chainResult.analysis.difficulty,
              questionType: chainResult.analysis.questionType,
              confidence: chainResult.analysis.confidence,
            }),
          );
        }

        // ── Emit verification event (NEW in C-004) ───────────────────
        if (chainResult.verification) {
          await write(
            formatSSEEvent('verification', {
              isCorrect: chainResult.verification.isCorrect,
              confidence: chainResult.verification.confidence,
              reasoning: chainResult.verification.reasoning,
              suggestedAnswer: chainResult.verification.suggestedAnswer ?? undefined,
            }),
          );
        }

        // ── Fill in missing sections ─────────────────────────────────
        // (The chain already handles this internally, but ensure all events are emitted)
        if (!chainResult.answer) {
          await write(formatSSEEvent('answer', { answer: '' }));
        }
        if (chainResult.knowledgePoints.length === 0 && chainResult.analysis) {
          // Last resort: no knowledge points from any source
          const kp = await generateKnowledgePoints(problem, chainResult.answer);
          chainResult.knowledgePoints = kp;
          await write(formatSSEEvent('knowledge', { points: kp }));
        }
        if (chainResult.similarQuestions.length === 0) {
          await write(formatSSEEvent('similar', { questions: [] }));
        }

        // ── Warnings ─────────────────────────────────────────────────
        for (const warning of chainResult.warnings) {
          await write(formatSSEEvent('error', { step: 'warning', message: warning }));
        }

        // ── Done ─────────────────────────────────────────────────────
        await write(
          formatSSEEvent('done', {
            fromQuestionBank: false,
            fromSolveCache: false,
            metadata: chainResult.metadata,
            hasCorrection: chainResult.metadata.hasCorrection,
          }),
        );

        // ── Auto-save ────────────────────────────────────────────────
        try {
          const { saveToQuestionBank, isProblemInBank, hashProblemText } =
            await import('@/lib/solve/question-bank');
          const { saveToSolveCache } = await import('@/lib/solve/solve-cache');
          const alreadyInBank = await isProblemInBank(problem);
          if (!alreadyInBank && chainResult.answer) {
            await saveToQuestionBank({
              problemText: problem,
              problemImage: problemImage ?? undefined,
              solution: chainResult.solution,
              steps: chainResult.steps ?? [],
              answer: chainResult.answer,
              knowledgePoints: chainResult.knowledgePoints,
              similarQuestions: chainResult.similarQuestions,
              agentId: subjectToAgentId(chainResult.analysis?.subject),
              solvedAt: Date.now(),
              verified: chainResult.verification?.isCorrect ?? false,
            });
          }
          if (chainResult.answer) {
            await saveToSolveCache({
              problemText: problem,
              problemHash: hashProblemText(problem),
              solution: chainResult.solution || chainResult.answer,
              answer: chainResult.answer,
              knowledgePoints:
                chainResult.knowledgePoints.length > 0 ? chainResult.knowledgePoints : undefined,
              agentId: subjectToAgentId(chainResult.analysis?.subject),
              solvedAt: Date.now(),
            });
          }
        } catch {
          // ignore save errors
        }

        await writer.close();
      } catch (err) {
        log.error('ExplainStream error:', err);
        try {
          await write(
            formatSSEEvent('error', {
              message: err instanceof Error ? err.message : '解题失败',
            }),
          );
          await writer.close();
        } catch {
          // already closed
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
    log.error('ExplainStream API error:', err);
    return new Response(formatSSEEvent('error', { message: '解题失败' }), {
      status: 500,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }
}
