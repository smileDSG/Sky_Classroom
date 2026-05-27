/**
 * POST /api/auth/reset-password
 * Reset password using token from email.
 */

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createUserDAO } from '@/lib/storage/dao/users';
import { hashPassword } from '@/lib/server/auth';
import { isResetTokenExpired } from '@/lib/server/auth/tokens';

const ResetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ResetSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 400, 'Token and new password are required');
    }

    const { token, newPassword } = parsed.data;
    const dao = await createUserDAO();

    // Find user by reset token
    const users = await dao.list();
    const user = users.find((u) => u.resetToken === token);

    if (!user) {
      return apiError('RESET_TOKEN_INVALID', 400, 'Invalid or expired reset token');
    }

    if (isResetTokenExpired(user.resetTokenExpiry)) {
      // Clear expired token
      await dao.update(user.id, { resetToken: null, resetTokenExpiry: null });
      return apiError('RESET_TOKEN_INVALID', 400, 'Reset token has expired');
    }

    // Update password and clear reset token
    const passwordHash = await hashPassword(newPassword);
    await dao.update(user.id, {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
    });

    return apiSuccess({ message: 'Password reset successfully' });
  } catch {
    return apiError('INTERNAL_ERROR', 500, 'Password reset failed');
  }
}
