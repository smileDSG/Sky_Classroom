import { NextRequest } from 'next/server';

import { getServerStorage } from '@/lib/server/server-storage';
import {
  buildConversationProfileFromSignals,
  createProfileSignalDAO,
  type ProfileSignalDimension,
  type ProfileSignalValue,
} from '@/lib/student/profile-signals';
import { requireAuth } from '@/lib/server/auth/helpers';

const PROFILE_DIMENSIONS = new Set<ProfileSignalDimension>([
  'majorBackground',
  'learningGoal',
  'knowledgeBase',
  'cognitiveStyle',
  'errorPatternPreference',
  'resourcePreference',
  'interactionPreference',
  'learningPace',
  'currentLearningState',
]);

function evidenceList(evidence: string | string[] | undefined): string[] {
  if (Array.isArray(evidence)) return evidence.filter(Boolean);
  if (evidence) return [evidence];
  return ['student manually corrected the profile'];
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = (await req.json().catch(() => ({}))) as {
    dimension?: ProfileSignalDimension;
    value?: ProfileSignalValue;
    evidence?: string | string[];
  };

  if (!body.dimension || body.value === undefined) {
    return Response.json(
      {
        success: false,
        error: 'dimension and value are required',
      },
      { status: 400 },
    );
  }

  if (!PROFILE_DIMENSIONS.has(body.dimension)) {
    return Response.json(
      {
        success: false,
        error: 'unsupported profile dimension',
      },
      { status: 400 },
    );
  }

  const storage = await getServerStorage();
  const dao = createProfileSignalDAO(storage);
  const profileSignal = await dao.add({
    userId: auth.user.id,
    dimension: body.dimension,
    value: body.value,
    source: 'manual_correction',
    confidence: 0.98,
    evidence: evidenceList(body.evidence),
  });
  const signals = await dao.listByUser(auth.user.id);

  return Response.json({
    success: true,
    data: {
      profileSignal,
      conversationProfile: buildConversationProfileFromSignals(signals),
    },
  });
}
