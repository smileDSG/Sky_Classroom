/**
 * Auto-seed the default admin account.
 * Called before login to ensure admin always exists.
 */

import { createUserDAO } from '@/lib/storage/dao/users';
import { hashPassword, verifyPassword } from '@/lib/server/auth';
import { createLogger } from '@/lib/logger';

const log = createLogger('AdminSeed');

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = '123';

let seeded = false;

export async function ensureAdminUser(): Promise<void> {
  if (seeded) return;

  try {
    const dao = await createUserDAO();
    const existing = await dao.getByUsername(ADMIN_USERNAME);
    if (existing) {
      // Verify password hash is valid — reset if corrupted
      if (existing.passwordHash) {
        const valid = await verifyPassword(ADMIN_PASSWORD, existing.passwordHash);
        if (valid) {
          seeded = true;
          return;
        }
        log.warn('Admin password hash invalid — resetting');
      }
      // Hash missing or invalid — reset password
      const passwordHash = await hashPassword(ADMIN_PASSWORD);
      await dao.update(existing.id, { passwordHash });
      log.info('Admin password reset to default');
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
      nickname: '管理员',
      bio: null,
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
