/**
 * CORS Configuration
 *
 * Provides CORS headers for API route responses.
 * In Next.js App Router, each route can import and apply these headers.
 *
 * Usage:
 *   import { corsHeaders, withCors } from '@/lib/server/middleware/cors';
 *
 *   export async function OPTIONS() {
 *     return withCors(new Response(null, { status: 204 }));
 *   }
 *
 *   export async function POST(req: Request) {
 *     const response = NextResponse.json({ ... });
 *     return withCors(response);
 *   }
 */

export interface CorsConfig {
  /** Allowed origins. Use '*' for all origins (development only) */
  origins: string[];
  /** Allowed HTTP methods */
  methods: string[];
  /** Allowed request headers */
  allowedHeaders: string[];
  /** Whether to allow credentials (cookies, auth headers) */
  allowCredentials: boolean;
  /** Max age for preflight cache (seconds) */
  maxAge: number;
}

/** Default CORS config for development (allow all) */
export const DEFAULT_CORS_CONFIG: CorsConfig = {
  origins: ['*'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  allowCredentials: false,
  maxAge: 86400,
};

/** Production-ready CORS config — only allow known origins */
export function createProductionCorsConfig(allowedOrigins: string[]): CorsConfig {
  return {
    origins: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    allowCredentials: true,
    maxAge: 86400,
  };
}

/**
 * Build CORS headers from a config.
 */
export function buildCorsHeaders(
  config: CorsConfig,
  requestOrigin?: string | null,
): Record<string, string> {
  const origin = requestOrigin ?? '';

  // Determine allowed origin(s)
  let allowOrigin: string;
  if (config.origins.includes('*')) {
    allowOrigin = '*';
  } else if (config.allowCredentials && requestOrigin && config.origins.includes(requestOrigin)) {
    allowOrigin = requestOrigin;
  } else if (!config.allowCredentials) {
    allowOrigin = config.origins[0] ?? '*';
  } else {
    allowOrigin = '';
  }

  if (!allowOrigin) {
    return {}; // Origin not allowed — return empty headers
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': config.methods.join(', '),
    'Access-Control-Allow-Headers': config.allowedHeaders.join(', '),
    ...(config.allowCredentials ? { 'Access-Control-Allow-Credentials': 'true' } : {}),
    'Access-Control-Max-Age': String(config.maxAge),
  };
}

/**
 * Apply CORS headers to a Response.
 */
export function withCors<T extends Response>(
  response: T,
  config: CorsConfig = DEFAULT_CORS_CONFIG,
  requestOrigin?: string | null,
): T {
  const headers = buildCorsHeaders(config, requestOrigin);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Create a preflight OPTIONS response with CORS headers.
 */
export function corsPreflightResponse(
  config: CorsConfig = DEFAULT_CORS_CONFIG,
  requestOrigin?: string | null,
): Response {
  const headers = buildCorsHeaders(config, requestOrigin);
  return new Response(null, {
    status: 204,
    headers,
  });
}
