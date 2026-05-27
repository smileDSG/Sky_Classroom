/**
 * Client-side admin seed.
 * Ensures the admin account exists in IndexedDB/localStorage.
 */

import { createUserDAO, type UserEntry } from '@/lib/storage/dao/users';

const ADMIN_USERNAME = 'admin';
const ADMIN_ID = 'admin-default';

export async function ensureAdminUserClient(): Promise<void> {
  try {
    const dao = await createUserDAO();
    const existing = await dao.getByUsername(ADMIN_USERNAME);
    if (existing) return;

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
          nickname: '管理员',
          bio: null,
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
