import { NextRequest } from 'next/server';

import { buildSoftwareCupProfile } from '@/lib/software-cup/demo-service';
import { getCurrentUser } from '@/lib/server/auth/helpers';
import { getServerStorage } from '@/lib/server/server-storage';
import {
  extractConversationProfile,
  type ConversationProfileStage,
} from '@/lib/student/conversation-profile';
import {
  buildConversationProfileFromSignals,
  conversationPatchToSignals,
  createProfileSignalDAO,
} from '@/lib/student/profile-signals';

const DEFAULT_PROFILE_USER_ID = 'default-user';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    input?: string;
    message?: string;
    sessionId?: string;
    stage?: ConversationProfileStage;
  };
  const input = body.input || body.message || '';
  const currentUser = await getCurrentUser();
  const userId = currentUser?.id ?? DEFAULT_PROFILE_USER_ID;
  const [profile, extraction] = await Promise.all([
    buildSoftwareCupProfile(input),
    Promise.resolve(
      extractConversationProfile({
        message: input,
        stage: body.stage ?? 'onboarding',
      }),
    ),
  ]);

  profile.userId = userId;

  const profileSignals = currentUser && input.trim()
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
