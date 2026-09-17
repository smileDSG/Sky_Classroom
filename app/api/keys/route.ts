/**
 * API Key Pool — List & Create
 *
 * GET  /api/keys?provider=xxx  — list keys (masked)
 * POST /api/keys               — add a new key
 */

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { listKeys, createKey } from '@/lib/storage/dao/api-key-pool';
import { refreshCache } from '@/lib/api-key-pool/pool';
import { requireAdmin } from '@/lib/server/auth/helpers';

const CreateKeySchema = z.object({
  provider: z.string().regex(/^[a-zA-Z0-9:_-]{1,64}$/, 'invalid provider'),
  apiKey: z.string().min(1).max(2000),
  baseUrl: z.string().max(500).optional(),
  label: z.string().max(200).optional(),
  priority: z.number().min(0).max(100).optional(),
});

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
    const parsed = CreateKeySchema.safeParse(body);
    if (!parsed.success) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: provider');
    }

    const { provider, apiKey, baseUrl, label, priority } = parsed.data;

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
