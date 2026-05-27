/**
 * POST /api/auth/verify-email
 * Verify email address using token from verification email.
 */

import { z } from 'zod';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createUserDAO } from '@/lib/storage/dao/users';

const VerifySchema = z.object({
  token: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = VerifySchema.safeParse(body);
    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 400, 'Token is required');
    }

    const { token } = parsed.data;
    const dao = await createUserDAO();

    // Find user by verify token
    const users = await dao.list();
    const user = users.find((u) => u.emailVerifyToken === token);

    if (!user) {
      return apiError('VERIFY_TOKEN_INVALID', 400, 'Invalid or expired verification token');
    }

    if (user.emailVerified) {
      return apiSuccess({ message: 'Email already verified' });
    }

    await dao.update(user.id, {
      emailVerified: true,
      emailVerifyToken: null,
    });

    return apiSuccess({ message: 'Email verified successfully' });
  } catch {
    return apiError('INTERNAL_ERROR', 500, 'Verification failed');
  }
}
