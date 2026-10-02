/**
 * Media Proxy API
 *
 * Server-side proxy for fetching remote media URLs (images/videos).
 * Required because browser fetch() to remote CDN URLs fails with CORS errors.
 * The media orchestrator uses this to download generated media as blobs
 * for IndexedDB persistence.
 *
 * POST /api/proxy-media
 * Body: { url: string }
 * Response: Binary blob with appropriate Content-Type
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';
import { apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('ProxyMedia');

export const maxDuration = 60;

// Cap downstream media payload to prevent memory exhaustion from a
// compromised/hostile upstream returning an arbitrarily large body.
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let url: string | undefined;
  try {
    ({ url } = await request.json());

    if (!url || typeof url !== 'string') {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing or invalid url');
    }

    // Block local/private network URLs to prevent SSRF
    const ssrfError = await validateUrlForSSRF(url);
    if (ssrfError) {
      return apiError('INVALID_URL', 403, ssrfError);
    }

    // Disable redirect following to prevent redirect-to-internal attacks
    const response = await fetch(url, { redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      return apiError('REDIRECT_NOT_ALLOWED', 403, 'Redirects are not allowed');
    }
    if (!response.ok) {
      return apiError('UPSTREAM_ERROR', 502, `Upstream returned ${response.status}`);
    }

    // Reject oversized payloads before buffering them into memory.
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (declaredLength && declaredLength > MAX_DOWNLOAD_BYTES) {
      return apiError('UPSTREAM_ERROR', 502, 'Upstream payload exceeds size limit');
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Stream the body with a hard size cap so a hostile upstream cannot force
    // us to buffer an unbounded amount of data.
    if (!response.body) {
      return apiError('UPSTREAM_ERROR', 502, 'Upstream returned no body');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_DOWNLOAD_BYTES) {
        await reader.cancel();
        return apiError('UPSTREAM_ERROR', 502, 'Upstream payload exceeds size limit');
      }
      chunks.push(value);
    }
    const blob = new Blob(
      chunks.map((c) => c.slice()),
      { type: contentType },
    );

    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(blob.size),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    log.error(`Proxy media failed [url="${url?.substring(0, 100) ?? 'unknown'}"]:`, error);
    return apiError('INTERNAL_ERROR', 500, error instanceof Error ? error.message : String(error));
  }
}
