/**
 * API Key Pool — Update & Delete
 *
 * PATCH  /api/keys/[id]  — update key fields
 * DELETE /api/keys/[id]  — remove a key
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { updateKey, removeKey, getKeyById } from '@/lib/storage/dao/api-key-pool';
import { refreshCache } from '@/lib/api-key-pool/pool';
import { requireAdmin } from '@/lib/server/auth/helpers';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    const { apiKey, baseUrl, label, isActive, priority } = body;

    const existing = await getKeyById(id);
    if (!existing) {
      return apiError('NOT_FOUND', 404, 'Key not found');
    }

    const updated = await updateKey(id, { apiKey, baseUrl, label, isActive, priority });
    await refreshCache(existing.provider);

    return apiSuccess({ key: updated });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err instanceof Error ? err.message : 'Unknown error');
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await params;

    const existing = await getKeyById(id);
    if (!existing) {
      return apiError('NOT_FOUND', 404, 'Key not found');
    }

    await removeKey(id);
    await refreshCache(existing.provider);

    return apiSuccess({ deleted: true });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
