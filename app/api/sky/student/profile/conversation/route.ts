import { NextRequest } from 'next/server';

import { getClientIp, rateLimiters, rateLimitResponse } from '@/lib/api/middleware/rate-limiter';
import { buildSoftwareCupProfile } from '@/lib/software-cup/demo-service';
import { createLogger } from '@/lib/logger';
import { getCurrentUser } from '@/lib/server/auth/helpers';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import { getServerStorage } from '@/lib/server/server-storage';
import {
  extractConversationProfile,
  type ConversationProfileExtractionResult,
  type ConversationProfileStage,
} from '@/lib/student/conversation-profile';
import { extractConversationProfileWithLLM } from '@/lib/student/conversation-profile-llm';
import {
  buildConversationProfileFromSignals,
  conversationPatchToSignals,
  createProfileSignalDAO,
} from '@/lib/student/profile-signals';

const log = createLogger('API:StudentProfileConversation');
const DEFAULT_PROFILE_USER_ID = 'default-user';

async function extractWithFallback(
  req: NextRequest,
  body: { stage?: ConversationProfileStage },
  input: string,
): Promise<{ extraction: ConversationProfileExtractionResult; extractionSource: 'llm' | 'rules' }> {
  const hasStage = body.stage !== undefined;
  const stage: ConversationProfileStage =
    body.stage === 'learning' || body.stage === 'review' ? body.stage : 'onboarding';
  const rulesExtraction = extractConversationProfile({ message: input, stage });

  if (!hasStage || !input.trim()) {
    return { extraction: rulesExtraction, extractionSource: 'rules' };
  }

  try {
    const resolved = await resolveModelFromRequest(req, body);
    const extraction = await extractConversationProfileWithLLM({
      message: input,
      stage,
      model: resolved,
    });
    return { extraction, extractionSource: 'llm' };
  } catch (err) {
    log.info('LLM profile extraction unavailable, falling back to rules:', err);
    return { extraction: rulesExtraction, extractionSource: 'rules' };
  }
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    const rateLimitResult = rateLimiters.chat.consume(getClientIp(req));
    if (!rateLimitResult.allowed) return rateLimitResponse(rateLimitResult);
  }

  const body = (await req.json().catch(() => ({}))) as {
    input?: string;
    message?: string;
    sessionId?: string;
    stage?: ConversationProfileStage;
  };
  const input = body.input || body.message || '';
  const userId = currentUser?.id ?? DEFAULT_PROFILE_USER_ID;
  const [{ extraction, extractionSource }, profile] = await Promise.all([
    extractWithFallback(req, body, input),
    buildSoftwareCupProfile(input),
  ]);

  profile.userId = userId;

  const profileSignals = input.trim()
    ? conversationPatchToSignals({
        userId,
        patch: extraction.profilePatch,
        stage: extraction.stage,
      })
    : [];

  let conversationProfile = {};

  if (profileSignals.length > 0) {
    const storage = await getServerStorage();
    const profileSignalDAO = createProfileSignalDAO(storage);
    await profileSignalDAO.addMany(profileSignals);
    const signals = await profileSignalDAO.listByUser(userId);
    conversationProfile = buildConversationProfileFromSignals(signals);
  }

  return Response.json({
    success: true,
    data: {
      sessionId: body.sessionId,
      stage: extraction.stage,
      nextQuestion: extraction.nextQuestion,
      profilePatch: extraction.profilePatch,
      profileSignals,
      conversationProfile,
      needsConfirmation: extraction.needsConfirmation,
      extractionSource,
      profile,
      patch: profile.dimensions,
      evidence: [
        ...extraction.evidence,
        ...profile.dimensions.majorBackground.evidence,
        ...profile.dimensions.learningGoal.evidence,
        ...profile.dimensions.knowledgeBase.evidence,
        ...profile.dimensions.cognitiveStyle.evidence,
        ...profile.dimensions.errorPatternPreference.evidence,
        ...profile.dimensions.resourcePreference.evidence,
        ...profile.dimensions.learningPace.evidence,
        ...profile.dimensions.currentLearningState.evidence,
      ],
    },
  });
}
