/**
 * POST /api/user/avatar — Upload avatar image
 *
 * Accepts multipart/form-data with an "avatar" file field.
 * Saves to public/uploads/avatars/ and returns the URL.
 */

import { NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { createUserDAO } from '@/lib/storage/dao/users';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const formData = await request.formData();
  const file = formData.get('avatar') as File | null;

  if (!file) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'No avatar file provided');
  }

  if (file.size > MAX_SIZE) {
    return apiError('FILE_TOO_LARGE', 413, 'Avatar must be under 5MB');
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return apiError('INVALID_FILE_TYPE', 400, 'Only JPEG, PNG, WebP, and GIF are allowed');
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const fileName = `${auth.user.id}-${Date.now()}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars');

  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, fileName), buffer);

  const avatarUrl = `/uploads/avatars/${fileName}`;

  const dao = await createUserDAO();
  await dao.update(auth.user.id, { avatar: avatarUrl });

  return apiSuccess({ avatarUrl });
}
