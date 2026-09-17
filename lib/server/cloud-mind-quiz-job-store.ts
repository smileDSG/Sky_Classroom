/**
 * Cloud Mind Quiz Job Store - in-memory background job state for quiz generation.
 */

import type { QuizOutput, QuizQuestionType } from '@/lib/agents/cloud-mind/quiz-agent';
import type { QuizBackfillStats } from '@/lib/agents/cloud-mind/quiz-backfill';

export type CloudMindQuizJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface CloudMindQuizJob {
  id: string;
  userId: string;
  status: CloudMindQuizJobStatus;
  phase: string;
  progress: number;
  createdAt: number;
  updatedAt: number;
  subject: string;
  difficulty: string;
  topic: string;
  count: number;
  questionType: QuizQuestionType;
  profileInjected: boolean;
  derived?: { subject: string; difficulty: string; topic: string; count: number };
  result?: QuizOutput;
  backfill?: QuizBackfillStats;
  error?: string;
}

const globalForQuizJobs = globalThis as unknown as {
  _cloudMindQuizJobs: Map<string, CloudMindQuizJob> | undefined;
};

const jobs: Map<string, CloudMindQuizJob> =
  globalForQuizJobs._cloudMindQuizJobs ?? (globalForQuizJobs._cloudMindQuizJobs = new Map());

const JOB_TTL_MS = 5 * 60 * 1000;

function cleanExpired() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export async function createCloudMindQuizJob(
  id: string,
  input: Pick<
    CloudMindQuizJob,
    'userId' | 'subject' | 'difficulty' | 'topic' | 'count' | 'questionType' | 'profileInjected'
  > & {
    derived?: CloudMindQuizJob['derived'];
  },
): Promise<CloudMindQuizJob> {
  cleanExpired();
  const now = Date.now();
  const job: CloudMindQuizJob = {
    id,
    userId: input.userId,
    status: 'queued',
    phase: 'queued',
    progress: 0,
    createdAt: now,
    updatedAt: now,
    subject: input.subject,
    difficulty: input.difficulty,
    topic: input.topic,
    count: input.count,
    questionType: input.questionType,
    profileInjected: input.profileInjected,
    derived: input.derived,
  };
  jobs.set(id, job);
  return job;
}

export function getCloudMindQuizJob(id: string): CloudMindQuizJob | null {
  const job = jobs.get(id);
  if (!job) return null;
  if (Date.now() - job.createdAt > JOB_TTL_MS) {
    jobs.delete(id);
    return null;
  }
  return job;
}

export function updateCloudMindQuizJob(
  id: string,
  patch: Partial<CloudMindQuizJob>,
): CloudMindQuizJob | null {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, patch, { updatedAt: Date.now() });
  return job;
}
