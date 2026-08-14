/**
 * Client-side admin seed.
 * Ensures the admin account exists in IndexedDB/localStorage.
 */

const ADMIN_USERNAME = 'admin';
const ADMIN_ID = 'admin-default';

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
};

export async function ensureAdminUserClient(): Promise<void> {
  try {
    const { createUserDAO } = await import('@/lib/storage/dao/users');
    const dao = await createUserDAO();
    const existing = await dao.getByUsername(ADMIN_USERNAME);
    if (existing) {
      const updates = Object.fromEntries(
        Object.entries(ADMIN_PROFILE_DEFAULTS).filter(([key]) => {
          const current = existing[key as keyof typeof existing];
          return current === null || current === '';
        }),
      );
      if (Object.keys(updates).length > 0) await dao.update(existing.id, updates);
      return;
    }

    // Password hash for "123" — matches server-side bcrypt hash
    // We call the API to get a consistent hash, or create the user via register
    const res = await fetch('/api/auth/seed-admin', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      if (data.passwordHash) {
        await dao.create({
          id: ADMIN_ID,
          email: null,
          username: ADMIN_USERNAME,
          passwordHash: data.passwordHash,
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
      }
    }
  } catch {
    // Silent fail
  }
}
