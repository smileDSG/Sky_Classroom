/**
 * POST /api/auth/register
 * Create a new user account.
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api-response';
import { signAccessToken, signRefreshToken, hashPassword } from '@/lib/server/auth';
import { createUserDAO } from '@/lib/storage/dao/users';

const RegisterSchema = z.object({
  email: z.string().email().optional().nullable(),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 400, 'Validation failed', parsed.error.issues[0].message);
    }

    const { email, username, password } = parsed.data;
    const dao = await createUserDAO();

    // Check duplicates
    if (email) {
      const existing = await dao.getByEmail(email);
      if (existing) {
        return apiError('EMAIL_EXISTS', 409, 'Email already registered');
      }
    }
    const byName = await dao.getByUsername(username);
    if (byName) {
      return apiError('USERNAME_EXISTS', 409, 'Username already taken');
    }

    const passwordHash = await hashPassword(password);
    const user = await dao.create({
      id: crypto.randomUUID(),
      email: email ?? null,
      username,
      passwordHash,
      role: 'user',
      status: 'active',
      guestId: null,
      planType: 'free',
    });

    // Auto-login: generate tokens
    const accessToken = await signAccessToken({ id: user.id, email: user.email ?? undefined, role: user.role });
    const sessionId = crypto.randomUUID();
    const refreshToken = await signRefreshToken(user.id, sessionId);

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    }, {
      status: 201,
      headers: {
        'Set-Cookie': [
          `access_token=${accessToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60}`,
          `refresh_token=${refreshToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
        ].join(', '),
      },
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Registration failed');
  }
}
