/**
 * Solve Job Store — in-memory job state for background solve tasks.
 *
 * Solves are short-lived (~30s), so in-memory storage is sufficient.
 * Jobs auto-expire after 5 minutes.
 */

export type SolveJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface SolveJob {
  id: string;
  status: SolveJobStatus;
  phase: string;
  progress: number; // 0-100
  createdAt: number;
  updatedAt: number;
  problemPreview: string;
  result?: {
    answer: string;
    solution: string;
    steps: { label: string; content: string; keyPoints?: string[] }[];
    knowledgePoints: { name: string; description: string; difficulty: string }[];
    similarQuestions: { problem: string; difficulty: number; knowledgePoint: string }[];
    fromQuestionBank: boolean;
    fromSolveCache: boolean;
    solvingTime: number;
  };
  error?: string;
}

const globalForJobs = globalThis as unknown as {
  _solveJobs: Map<string, SolveJob> | undefined;
};
const jobs: Map<string, SolveJob> =
  globalForJobs._solveJobs ?? (globalForJobs._solveJobs = new Map());
const JOB_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cleanExpired() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export function createSolveJob(id: string, problemText: string): SolveJob {
  cleanExpired();
  const now = Date.now();
  const job: SolveJob = {
    id,
    status: 'queued',
    phase: 'queued',
    progress: 0,
    createdAt: now,
    updatedAt: now,
    problemPreview: problemText.length > 100 ? problemText.slice(0, 97) + '...' : problemText,
  };
  jobs.set(id, job);
  return job;
}

export function getSolveJob(id: string): SolveJob | null {
  const job = jobs.get(id);
  if (!job) return null;
  if (Date.now() - job.createdAt > JOB_TTL_MS) {
    jobs.delete(id);
    return null;
  }
  return job;
}

export function updateSolveJob(id: string, patch: Partial<SolveJob>): SolveJob | null {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: Date.now() });
  return job;
}
