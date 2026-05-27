/**
 * GET /api/beta/admin/codes  — List invitation codes
 * POST /api/beta/admin/codes — Batch generate invitation codes
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createInvitationDAO } from '@/lib/server/beta/dao/invitation-codes';

const GenerateSchema = z.object({
  prefix: z.string().min(1).max(10),
  count: z.number().int().min(1).max(100).default(10),
  type: z.enum(['direct', 'request']).default('direct'),
  notes: z.string().max(200).optional(),
});

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || undefined;
    const dao = await createInvitationDAO();
    const codes = await dao.list(status ? { status } : undefined);

    return apiSuccess({
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code,
        type: c.type,
        status: c.status,
        createdBy: c.createdBy,
        createdAt: c.createdAt.toISOString(),
        usedBy: c.usedBy,
        usedAt: c.usedAt?.toISOString() ?? null,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        maxUses: c.maxUses,
        currentUses: c.currentUses,
        notes: c.notes,
      })),
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to list invitation codes');
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = GenerateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 400, 'Invalid request', parsed.error.issues[0].message);
    }

    const { prefix, count, type, notes } = parsed.data;

    // Get user ID from JWT for created_by
    const cookieHeader = request.headers.get('cookie') || '';
    const accessToken = cookieHeader.match(/access_token=([^;]+)/)?.[1];
    let createdBy = 'admin';
    if (accessToken) {
      try {
        const { jwtVerify } = await import('jose');
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'change-me-in-production');
        const { payload } = await jwtVerify(accessToken, secret);
        createdBy = (payload as any).id || 'admin';
      } catch {}
    }

    const dao = await createInvitationDAO();
    const codes = await dao.batchCreate({ prefix, count, type: type as 'direct' | 'request', createdBy, notes });

    return apiSuccess({
      codes: codes.map((c) => ({
        id: c.id,
        code: c.code,
        type: c.type,
        createdAt: c.createdAt.toISOString(),
      })),
    }, 201);
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to generate invitation codes');
  }
}
