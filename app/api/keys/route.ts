/**
 * API Key Pool — List & Create
 *
 * GET  /api/keys?provider=xxx  — list keys (masked)
 * POST /api/keys               — add a new key
 */

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { listKeys, createKey } from '@/lib/storage/dao/api-key-pool';
import { refreshCache } from '@/lib/api-key-pool/pool';
import { requireAdmin } from '@/lib/server/auth/helpers';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const provider = req.nextUrl.searchParams.get('provider') ?? undefined;
  const keys = await listKeys(provider);
  return apiSuccess({ keys });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const { provider, apiKey, baseUrl, label, priority } = body;

    if (!provider || typeof provider !== 'string') {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: provider');
    }
    if (!apiKey || typeof apiKey !== 'string') {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: apiKey');
    }

    const entry = await createKey({
      id: randomUUID(),
      provider: provider.toLowerCase().trim(),
      apiKey: apiKey.trim(),
      baseUrl: baseUrl?.trim(),
      label: label?.trim(),
      priority,
    });

    await refreshCache(provider.toLowerCase().trim());

    return apiSuccess({ key: entry }, 201);
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
