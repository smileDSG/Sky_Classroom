/**
 * POST /api/telemetry
 * Receive client-side telemetry events, sanitize, and write to Supabase.
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TelemetryEventSchema = z.object({
  event_type: z.enum([
    'page_view',
    'api_call',
    'error',
    'performance',
    'feature_use',
    'ai_task',
  ] as const),
  event_data: z.record(z.string(), z.unknown()),
  page: z.string().optional(),
  session_id: z.string(),
  timestamp: z.number().optional(),
});

const TelemetryBatchSchema = z.object({
  events: z.array(TelemetryEventSchema).min(1).max(50),
});

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'email',
  'phone',
  'credit_card',
  'ssn',
];

function sanitize(data: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 5) return {};
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[_-]/g, '');
    // Recursively sanitize nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = sanitize(value as Record<string, unknown>, depth + 1);
      continue;
    }
    // Redact sensitive fields
    if (SENSITIVE_FIELDS.some((f) => lowerKey.includes(f))) {
      cleaned[key] = '[REDACTED]';
      continue;
    }
    // Truncate long string values
    if (typeof value === 'string' && value.length > 1000) {
      cleaned[key] = value.slice(0, 1000) + '…';
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = TelemetryBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, errorCode: 'INVALID_REQUEST', error: 'Invalid telemetry batch' },
        { status: 400 },
      );
    }

    const { events } = parsed.data;

    // Extract user ID from JWT if available (anonymous telemetry otherwise)
    let userId: string | null = null;
    const cookieHeader = request.headers.get('cookie') || '';
    const accessToken = cookieHeader.match(/access_token=([^;]+)/)?.[1];
    if (accessToken) {
      try {
        const { jwtVerify } = await import('jose');
        const secret = new TextEncoder().encode(
          process.env.JWT_SECRET || 'change-me-in-production',
        );
        const { payload } = await jwtVerify(accessToken, secret);
        userId = (payload as any).id || null;
      } catch {}
    }

    const db = createClient(supabaseUrl, supabaseKey);

    const rows = events.map((e) => ({
      user_id: userId,
      session_id: e.session_id,
      event_type: e.event_type,
      event_data: sanitize(e.event_data),
      page: e.page || null,
      created_at: e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString(),
    }));

    const { error } = await db.from('telemetry_events').insert(rows);
    if (error) {
      console.error('[Telemetry] Insert failed:', error.message);
      return NextResponse.json(
        { success: false, errorCode: 'STORAGE_ERROR', error: 'Failed to store telemetry' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, received: rows.length });
  } catch (err) {
    console.error('[Telemetry] Error:', err);
    return NextResponse.json(
      { success: false, errorCode: 'INTERNAL_ERROR', error: 'Internal server error' },
      { status: 500 },
    );
  }
}
