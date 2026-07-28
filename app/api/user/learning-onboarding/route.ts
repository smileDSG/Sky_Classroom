import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { createUserDAO } from '@/lib/storage/dao/users';
import { SUBJECT_CONFIG } from '@/lib/student/profile-config';
import {
  CURRENT_ONBOARDING_VERSION,
  completeLearningOnboardingSchema,
  getLearningOnboardingStatus,
  type LearningOnboardingProfile,
} from '@/lib/onboarding/types';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { user } = auth;
  return apiSuccess({
    status: getLearningOnboardingStatus(user.learningOnboarding),
    onboarding: user.learningOnboarding,
    educationLevel: user.educationLevel,
    grade: user.grade,
    favoriteSubjects: (user.favoriteSubjects ?? [])
      .filter((subject) => subject.enabled)
      .map((subject) => subject.id),
  });
}

export async function PUT(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const parsed = completeLearningOnboardingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError('INVALID_REQUEST', 400, 'Validation failed', parsed.error.issues[0]?.message);
  }

  const input = parsed.data;
  const completed: LearningOnboardingProfile = {
    version: CURRENT_ONBOARDING_VERSION,
    status: 'completed',
    weakSubjects: input.weakSubjects,
    learningGoal: input.learningGoal,
    goalDetail: input.goalDetail,
    teachingPreference: input.teachingPreference,
    completedAt: Date.now(),
  };
  const selectedSubjects = new Set<string>(input.favoriteSubjects);
  const favoriteSubjects = SUBJECT_CONFIG.map((subject) => ({
    id: subject.id,
    name: subject.label,
    enabled: selectedSubjects.has(subject.id),
  }));

  const dao = await createUserDAO();
  const updated = await dao.update(auth.user.id, {
    educationLevel: input.educationLevel,
    grade: input.grade,
    favoriteSubjects,
    learningOnboarding: completed,
  });
  if (!updated) return apiError('NOT_FOUND', 404, 'User not found');

  return apiSuccess({
    onboarding: updated.learningOnboarding,
    status: getLearningOnboardingStatus(updated.learningOnboarding),
  });
}
