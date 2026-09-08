/**
 * POST /api/auth/forgot-password
 * Request a password reset email.
 * Always returns success to prevent user enumeration.
 */

import { z } from 'zod';
import { apiSuccess } from '@/lib/server/api-response';
import { createUserDAO } from '@/lib/storage/dao/users';
import { generateResetToken } from '@/lib/server/auth/tokens';
import { sendPasswordResetEmail } from '@/lib/server/email';

const ForgotSchema = z.object({
  emailOrUsername: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = ForgotSchema.safeParse(body);
    if (!parsed.success) {
      return apiSuccess({ message: 'If an account exists, a reset email has been sent' });
    }

    const { emailOrUsername } = parsed.data;
    const dao = await createUserDAO();

    // Look up user by email or username
    let user = emailOrUsername.includes('@') ? await dao.getByEmail(emailOrUsername) : null;
    if (!user) {
      user = await dao.getByUsername(emailOrUsername);
    }

    // Always return success (prevent user enumeration)
    if (!user || !user.email) {
      return apiSuccess({ message: 'If an account exists, a reset email has been sent' });
    }

    // Generate reset token
    const { token, expiry } = generateResetToken();
    await dao.update(user.id, {
      resetToken: token,
      resetTokenExpiry: expiry,
    });

    // Send reset email (non-blocking)
    sendPasswordResetEmail(user.email, token).catch(() => {});

    return apiSuccess({ message: 'If an account exists, a reset email has been sent' });
  } catch {
    return apiSuccess({ message: 'If an account exists, a reset email has been sent' });
  }
}
