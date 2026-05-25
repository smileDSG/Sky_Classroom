/**
 * Solve Job Runner — executes the LangGraph solve pipeline in background.
 */
import { createSolveGraph, buildSolveInitialState } from '@/lib/solve/solve-graph';
import type { SolveJob } from './solve-job-store';
import { updateSolveJob } from './solve-job-store';
import { createLogger } from '@/lib/logger';

const log = createLogger('SolveJobRunner');
const runningJobs = new Map<string, Promise<void>>();

export function runSolveJob(jobId: string, problemText: string, problemImage: string | null, userAnswer: string | null): Promise<void> {
  const existing = runningJobs.get(jobId);
  if (existing) return existing;

  const jobPromise = (async () => {
    try {
      updateSolveJob(jobId, { status: 'running', phase: 'checking', progress: 5 });

      const graph = createSolveGraph();
      const initialState = buildSolveInitialState(problemText, problemImage, userAnswer);

      // Phase: routing
      updateSolveJob(jobId, { phase: 'routing', progress: 15 });

      const startTime = performance.now();
      const finalState = await graph.invoke(initialState);
      const solvingTime = Math.round(performance.now() - startTime);

      if (finalState.error) {
        updateSolveJob(jobId, {
          status: 'failed',
          phase: 'failed',
          progress: 0,
          error: finalState.error,
        });
        return;
      }

      // Phase: generating output
      updateSolveJob(jobId, { phase: 'output', progress: 90 });

      const output = finalState.fourPartOutput ?? {
        answer: finalState.solution ?? '',
        steps: [],
        knowledgePoints: [],
        similarQuestions: [],
      };

      updateSolveJob(jobId, {
        status: 'completed',
        phase: 'done',
        progress: 100,
        result: {
          answer: output.answer,
          steps: output.steps,
          knowledgePoints: output.knowledgePoints,
          similarQuestions: output.similarQuestions,
          fromQuestionBank: finalState.fromQuestionBank ?? false,
          solvingTime,
        },
      });

      log.info(`Solve job ${jobId} completed in ${solvingTime}ms`);

      // Auto-save to question bank
      if (!finalState.fromQuestionBank && output.answer) {
        try {
          const { saveToQuestionBank, isProblemInBank } = await import('@/lib/solve/question-bank');
          const alreadyInBank = await isProblemInBank(problemText);
          if (!alreadyInBank) {
            await saveToQuestionBank({
              problemText,
              problemImage: problemImage ?? undefined,
              answer: output.answer,
              steps: (output.steps ?? []).map(s => `${s.label}: ${s.content}`),
              knowledgePoints: (output.knowledgePoints ?? []).map(kp => kp.name),
              agentId: finalState.agentRoute ?? 'universal',
              solvedAt: Date.now(),
              verified: false,
            });
          }
        } catch {
          // ignore save errors
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Solve job ${jobId} failed:`, error);
      updateSolveJob(jobId, {
        status: 'failed',
        phase: 'failed',
        progress: 0,
        error: message,
      });
    } finally {
      runningJobs.delete(jobId);
    }
  })();

  runningJobs.set(jobId, jobPromise);
  return jobPromise;
}
