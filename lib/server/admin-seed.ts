/**
 * Auto-seed the default admin account.
 * Called before login to ensure admin always exists.
 */

import { createUserDAO, type UserEntry } from '@/lib/storage/dao/users';
import { hashPassword } from '@/lib/server/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('AdminSeed');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '123';

const ADMIN_PROFILE_DEFAULTS = {
  nickname: '高等教育学习管理员',
  bio: '关注高中核心课程、大学数学、计算机科学与人工智能。',
  educationLevel: 'undergraduate',
  grade: '大学二年级',
  favoriteSubjects: [
    { id: 'math', name: '数学', enabled: true },
    { id: 'physics', name: '物理', enabled: true },
    { id: 'computer', name: '计算机', enabled: true },
    { id: 'ai', name: '人工智能', enabled: true },
  ],
  learningStyle: 'balanced',
  detailLevel: 'detailed',
  preferredLanguage: 'zh',
  aiPersonality: 'professional',
  aiName: '知行助教',
  customInstructions: '优先使用高中与大学知识案例，给出公式推导、代码示例和进阶练习。',
  autoGenerateQuiz: true,
  showStepByStep: true,
  enableMemory: true,
  enableRAG: true,
} satisfies Partial<UserEntry>;

function getMissingProfileDefaults(user: UserEntry): Partial<UserEntry> {
  const updates: Partial<UserEntry> = {};
  for (const [key, value] of Object.entries(ADMIN_PROFILE_DEFAULTS)) {
    const field = key as keyof UserEntry;
    if (user[field] === null || user[field] === '') {
      (updates as Record<string, unknown>)[field] = value;
    }
  }
  return updates;
}

let seeded = false;

export async function ensureAdminUser(): Promise<void> {
  if (seeded) return;

  try {
    const dao = await createUserDAO();
    const existing = await dao.getByUsername(ADMIN_USERNAME);
    if (existing) {
      const updates = getMissingProfileDefaults(existing);
      // Only (re)set the password when the hash is missing/corrupt — never
      // overwrite a hash simply because it doesn't match the default, since
      // the admin may have changed their password on purpose.
      if (existing.passwordHash) {
        if (Object.keys(updates).length > 0) await dao.update(existing.id, updates);
        seeded = true;
        return;
      }
      log.warn('Admin password hash missing — resetting to default');
      const passwordHash = await hashPassword(ADMIN_PASSWORD);
      await dao.update(existing.id, { ...updates, passwordHash });
      seeded = true;
      return;
    }

    log.info('Creating default admin user');
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    await dao.create({
      id: 'admin-default',
      email: null,
      username: ADMIN_USERNAME,
      passwordHash,
      role: 'admin',
      status: 'active',
      guestId: null,
      planType: 'enterprise',
      avatar: null,
      ...ADMIN_PROFILE_DEFAULTS,
      learningOnboarding: null,
      emailVerified: true,
      emailVerifyToken: null,
      resetToken: null,
      resetTokenExpiry: null,
    });

    seeded = true;
    log.info('Admin user created successfully');
  } catch (err) {
    log.error('ensureAdminUser failed:', err instanceof Error ? err.message : err);
  }
}
