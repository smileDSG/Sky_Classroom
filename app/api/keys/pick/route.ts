/**
 * API Key Pool — Pick Next Key
 *
 * POST /api/keys/pick
 * Body: { "provider": "openai" }
 * Returns: { "apiKey": "sk-xxx", "baseUrl": "...", "keyId": "..." }
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { pickKey } from '@/lib/api-key-pool/pool';
import { NoAvailableKeyError } from '@/lib/api-key-pool/types';
import { requireAdmin } from '@/lib/server/auth/helpers';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const { provider } = body;

    if (!provider || typeof provider !== 'string') {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing required field: provider');
    }

    const result = await pickKey(provider.toLowerCase().trim());

    return apiSuccess({
      apiKey: result.key.apiKey,
      baseUrl: result.key.baseUrl,
      keyId: result.key.id,
      index: result.index,
    });
  } catch (err) {
    if (err instanceof NoAvailableKeyError) {
      return apiError('UPSTREAM_ERROR', 503, err.message);
    }
    return apiError('INTERNAL_ERROR', 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
