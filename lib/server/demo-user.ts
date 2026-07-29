import { DEMO_PASSWORD, DEMO_USERNAME } from '@/lib/auth/demo-account';
import { createLogger } from '@/lib/logger';
import { hashPassword } from '@/lib/server/auth';
import { createUserDAO } from '@/lib/storage/dao/users';

const log = createLogger('DemoUserSeed');

type DemoAccountEnvironment = Readonly<{
  NODE_ENV?: string;
  ENABLE_DEMO_ACCOUNT?: string;
}>;

export function isDemoAccountEnabled(env: DemoAccountEnvironment = process.env): boolean {
  return env.NODE_ENV !== 'production' || env.ENABLE_DEMO_ACCOUNT === 'true';
}

export async function ensureDemoUser(): Promise<void> {
  if (!isDemoAccountEnabled()) return;

  try {
    const dao = await createUserDAO();
    const existing = await dao.getByUsername(DEMO_USERNAME);
    if (existing) return;

    const passwordHash = await hashPassword(DEMO_PASSWORD);
    await dao.create({
      id: 'demo-default',
      email: null,
      username: DEMO_USERNAME,
      passwordHash,
      role: 'user',
      status: 'active',
      guestId: null,
      planType: 'free',
      avatar: null,
      nickname: '演示用户',
      bio: null,
      educationLevel: null,
      grade: null,
      favoriteSubjects: null,
      learningOnboarding: null,
      learningStyle: null,
      detailLevel: null,
      preferredLanguage: null,
      aiPersonality: null,
      aiName: null,
      customInstructions: null,
      autoGenerateQuiz: null,
      showStepByStep: null,
      enableMemory: null,
      enableRAG: null,
      emailVerified: true,
      emailVerifyToken: null,
      resetToken: null,
      resetTokenExpiry: null,
    });
  } catch (error) {
    log.error('ensureDemoUser failed:', error instanceof Error ? error.message : error);
  }
}
