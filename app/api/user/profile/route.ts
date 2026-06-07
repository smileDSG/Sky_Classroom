/**
 * GET /api/user/profile — Get current user's full profile
 * PATCH /api/user/profile — Update profile (nickname, bio)
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { createUserDAO } from '@/lib/storage/dao/users';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { user } = auth;
  return apiSuccess({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      status: user.status,
      planType: user.planType,
      avatar: user.avatar,
      nickname: user.nickname,
      bio: user.bio,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
  });
}

const UpdateProfileSchema = z.object({
  nickname: z.string().max(30).optional(),
  bio: z.string().max(500).optional(),
});

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const parsed = UpdateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('INVALID_REQUEST', 400, 'Validation failed', parsed.error.issues[0].message);
  }

  const dao = await createUserDAO();
  const updated = await dao.update(auth.user.id, parsed.data);
  if (!updated) {
    return apiError('NOT_FOUND', 404, 'User not found');
  }

  return apiSuccess({
    user: {
      id: updated.id,
      nickname: updated.nickname,
      bio: updated.bio,
      avatar: updated.avatar,
    },
  });
}
