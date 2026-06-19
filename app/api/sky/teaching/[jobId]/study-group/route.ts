/**
 * POST /api/sky/teaching/[jobId]/study-group
 *
 * Initialize an AI study group discussion based on a completed teaching job.
 * Returns the discussion context, agent configs, and topic/prompt for the
 * client to start a multi-agent discussion via /api/chat.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { readTeachingJob } from '@/lib/server/teaching-job-store';
import { buildStudyGroupSetup } from '@/lib/teaching/study-group';
import { buildStudentProfile } from '@/lib/student/profile-builder';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:StudyGroup');

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;
    const job = await readTeachingJob(jobId);

    if (!job) {
      return apiError('NOT_FOUND', 404, '教案不存在');
    }

    if (job.status !== 'succeeded') {
      return apiError('INVALID_REQUEST', 400, '教案尚未生成完成，无法开启学习小组');
    }

    const profile = job.userId ? await buildStudentProfile(job.userId) : undefined;
    const setup = buildStudyGroupSetup(job, profile);

    log.info(
      `Created study group ${setup.sessionId} for job ${jobId}, profile injected: ${Boolean(profile)}`,
    );

    return apiSuccess(
      {
        sessionId: setup.sessionId,
        context: setup.context,
        agents: setup.agents,
        discussionTopic: setup.discussionTopic,
        discussionPrompt: setup.discussionPrompt,
      },
      200,
    );
  } catch (err) {
    log.error('Failed to create study group:', err);
    return apiError('INTERNAL_ERROR', 500, 'Failed to create study group');
  }
}
