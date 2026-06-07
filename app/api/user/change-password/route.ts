/**
 * POST /api/user/change-password
 * Change password for the authenticated user.
 */

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { createUserDAO } from '@/lib/storage/dao/users';
import { hashPassword, verifyPassword } from '@/lib/server/auth';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const parsed = ChangePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('INVALID_REQUEST', 400, 'Validation failed', parsed.error.issues[0].message);
  }

  const { currentPassword, newPassword } = parsed.data;
  const { user } = auth;

  if (!user.passwordHash) {
    return apiError('INVALID_REQUEST', 400, 'Account has no password set');
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return apiError('INVALID_CREDENTIALS', 401, 'Current password is incorrect');
  }

  const dao = await createUserDAO();
  const newHash = await hashPassword(newPassword);
  await dao.update(user.id, { passwordHash: newHash });

  return apiSuccess({ message: 'Password changed successfully' });
}
