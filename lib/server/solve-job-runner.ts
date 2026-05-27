/**
 * Solve Job Runner — executes the LangGraph solve pipeline in background.
 */
import { createSolveGraph, buildSolveInitialState } from '@/lib/solve/solve-graph';
import type { SolveJob } from './solve-job-store';
import { updateSolveJob } from './solve-job-store';
import { createLogger } from '@/lib/logger';

const log = createLogger('SolveJobRunner');
const globalForRunningJobs = globalThis as unknown as {
  _solveRunningJobs: Map<string, Promise<void>> | undefined;
};
const runningJobs: Map<string, Promise<void>> =
  globalForRunningJobs._solveRunningJobs ?? (globalForRunningJobs._solveRunningJobs = new Map());

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
          fromSolveCache: finalState.fromSolveCache ?? false,
          solvingTime,
        },
      });

      log.info(`Solve job ${jobId} completed in ${solvingTime}ms`);

      // Auto-save to question bank and solve cache
      if (!finalState.fromQuestionBank && !finalState.fromSolveCache && output.answer) {
        try {
          const { hashProblemText } = await import('@/lib/solve/question-bank');
          const { saveToSolveCache } = await import('@/lib/solve/solve-cache');

          await saveToSolveCache({
            problemText,
            problemHash: hashProblemText(problemText),
            solution: output.answer,
            agentId: finalState.agentRoute ?? 'universal',
            solvedAt: Date.now(),
          });
        } catch {
          // ignore save errors
        }
        try {
          const { saveToQuestionBank, isProblemInBank } = await import('@/lib/solve/question-bank');
          const alreadyInBank = await isProblemInBank(problemText);
          if (!alreadyInBank) {
            await saveToQuestionBank({
              problemText,
              problemImage: problemImage ?? undefined,
              answer: output.answer,
              steps: output.steps ?? [],
              knowledgePoints: (output.knowledgePoints ?? []).map(kp => ({
                name: kp.name,
                description: kp.description,
                difficulty: kp.difficulty,
              })),
              similarQuestions: output.similarQuestions ?? [],
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
