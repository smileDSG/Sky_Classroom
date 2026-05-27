/**
 * Auto-seed the default admin account.
 * Called before login to ensure admin always exists.
 */

import { createUserDAO } from '@/lib/storage/dao/users';
import { hashPassword } from '@/lib/server/auth';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '123';

let seeded = false;

export async function ensureAdminUser(): Promise<void> {
  if (seeded) return;

  try {
    const dao = await createUserDAO();
    const existing = await dao.getByUsername(ADMIN_USERNAME);
    if (existing) {
      seeded = true;
      return;
    }

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
      nickname: '管理员',
      bio: null,
      emailVerified: true,
      emailVerifyToken: null,
      resetToken: null,
      resetTokenExpiry: null,
    });

    seeded = true;
  } catch {
    // Silent fail — don't block login
  }
}
