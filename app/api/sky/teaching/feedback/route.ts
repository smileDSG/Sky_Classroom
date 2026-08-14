import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/server/auth';
import { getServerStorage } from '@/lib/server/server-storage';
import { readTeachingJob, updateTeachingJob } from '@/lib/server/teaching-job-store';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import { createKnowledgeStateDAO } from '@/lib/storage/dao/knowledge-state';
import { recordLearningEvent } from '@/lib/adaptive-learning/profile/event-recorder';
import { getLearnerDecision } from '@/lib/adaptive-learning/decision/learner-decision';
import {
  buildTeachingKnowledgeImpacts,
  type TeachingProfileUpdate,
} from '@/lib/teaching/profile-impact';
import { promises as fs } from 'fs';
import path from 'path';

const log = createLogger('TeachingFeedbackAPI');

const FEEDBACK_DIR = path.join(process.cwd(), 'data', 'teaching-feedback');

interface TeachingFeedback {
  id: string;
  userId: string;
  jobId: string;
  sectionId: string;
  feedbackType: 'mastered' | 'needs_review';
  createdAt: number;
}

async function ensureDir() {
  await fs.mkdir(FEEDBACK_DIR, { recursive: true });
}

function getFeedbackPath(jobId: string): string {
  return path.join(FEEDBACK_DIR, `${jobId}.json`);
}

/**
 * POST /api/sky/teaching/feedback
 *
 * Record learning feedback for a teaching section.
 * Body: { jobId, sectionId, feedbackType: 'mastered' | 'needs_review' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, sectionId, feedbackType } = body;

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }
    if (!sectionId || typeof sectionId !== 'string') {
      return NextResponse.json({ error: 'Missing sectionId' }, { status: 400 });
    }
    if (!feedbackType || !['mastered', 'needs_review'].includes(feedbackType)) {
      return NextResponse.json({ error: 'Invalid feedbackType' }, { status: 400 });
    }

    // Verify authentication
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token');
    let userId: string | null = null;

    if (accessToken) {
      const payload = await verifyAccessToken(accessToken.value);
      if (payload) {
        userId = payload.sub;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const feedback: TeachingFeedback = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      jobId,
      sectionId,
      feedbackType,
      createdAt: Date.now(),
    };

    await ensureDir();

    // Append feedback to the job's feedback file
    const filePath = getFeedbackPath(jobId);
    let feedbacks: TeachingFeedback[] = [];
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      feedbacks = JSON.parse(content);
      if (!Array.isArray(feedbacks)) feedbacks = [];
    } catch {
      // File doesn't exist yet
    }

    feedbacks.push(feedback);
    await fs.writeFile(filePath, JSON.stringify(feedbacks, null, 2), 'utf-8');

    // Also update teaching job store for adaptive engine
    try {
      const job = await readTeachingJob(jobId);
      if (job && job.plan) {
        const section = job.plan.sections.find((s) => s.id === sectionId);
        const existingFeedbacks = job.sectionFeedbacks ?? [];
        existingFeedbacks.push({
          sectionId,
          feedbackType,
          knowledgePoints: section?.knowledgePoints ?? [],
          timestamp: Date.now(),
        });
        await updateTeachingJob(jobId, { sectionFeedbacks: existingFeedbacks });
      }
    } catch (jobErr) {
      log.warn('Failed to update job feedback:', jobErr);
    }

    let profileUpdate: TeachingProfileUpdate | null = null;

    // Update unified knowledge states. Section feedback is self-reported,
    // therefore it receives less weight than a verified quiz answer.
    try {
      const storage = await getServerStorage();
      const job = await readTeachingJob(jobId);
      const section = job?.plan?.sections.find((s) => s.id === sectionId);
      const knowledgePoints = section?.knowledgePoints ?? [];
      const stateDAO = createKnowledgeStateDAO(storage);
      const before = await stateDAO.list(userId);
      const event =
        knowledgePoints.length > 0
          ? await recordLearningEvent(
              {
                userId,
                type: 'review-completed',
                source: 'teaching-section-feedback',
                evidenceQuality: 'self-reported',
                payload: {
                  rating: feedbackType === 'mastered' ? 'good' : 'hard',
                  knowledgePoints,
                },
                correlationId: `${jobId}:${sectionId}`,
              },
              { storage },
            )
          : null;

      if (feedbackType === 'needs_review' && knowledgePoints.length > 0) {
        // Add knowledge points to mistake book for prioritized review
        const mistakeDAO = createMistakeBookDAO(storage);
        for (const kp of knowledgePoints) {
          await mistakeDAO.add(userId, {
            id: `review_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            problemText: `需复习知识点: ${kp}`,
            userAnswer: '',
            correctAnswer: '',
            errorType: 'concept',
            knowledgePoints: [kp],
            source: 'review',
          });
        }
      }

      const after = await stateDAO.list(userId);
      profileUpdate = {
        recorded: Boolean(event),
        evidenceType: 'self-reported-feedback',
        changes: buildTeachingKnowledgeImpacts({ knowledgePoints, before, after }),
        learnerDecision: getLearnerDecision({
          knowledgeStates: after,
          explicitTopic: knowledgePoints[0],
        }),
      };
    } catch (signalErr) {
      log.warn('Failed to update learning signals from feedback:', signalErr);
    }

    log.info(`Feedback recorded: ${feedbackType} for section ${sectionId} by user ${userId}`);

    return NextResponse.json({
      success: true,
      data: { feedback, profileUpdate },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Record feedback failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
