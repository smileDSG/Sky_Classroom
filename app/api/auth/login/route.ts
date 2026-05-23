/**
 * POST /api/auth/login
 * Authenticate user and return JWT tokens.
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api-response';
import { signAccessToken, signRefreshToken, verifyPassword } from '@/lib/server/auth';
import { createUserDAO } from '@/lib/storage/dao/users';

const LoginSchema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 400, 'Invalid request', parsed.error.issues[0].message);
    }

    const { emailOrUsername, password } = parsed.data;
    const dao = await createUserDAO();

    // Lookup by email first, then username
    let user = emailOrUsername.includes('@')
      ? await dao.getByEmail(emailOrUsername)
      : null;
    if (!user) {
      user = await dao.getByUsername(emailOrUsername);
    }

    if (!user || !user.passwordHash) {
      return apiError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
    }

    if (user.status === 'suspended') {
      return apiError('ACCOUNT_SUSPENDED', 403, 'Account is suspended');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return apiError('INVALID_CREDENTIALS', 401, 'Invalid email or password');
    }

    // Update last login
    await dao.update(user.id, { lastLoginAt: Date.now() });

    // Generate tokens
    const accessToken = await signAccessToken({ id: user.id, email: user.email ?? undefined, role: user.role });
    const sessionId = crypto.randomUUID();
    const refreshToken = await signRefreshToken(user.id, sessionId);

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    }, {
      headers: {
        'Set-Cookie': [
          `access_token=${accessToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60}`,
          `refresh_token=${refreshToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
        ].join(', '),
      },
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Login failed');
  }
}
