/**
 * POST /api/beta/invite
 * Validate invitation code and set beta_access cookie.
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createInvitationDAO } from '@/lib/server/beta/dao/invitation-codes';

const InviteSchema = z.object({
  code: z.string().min(1, 'Invitation code is required'),
});

function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function signBetaToken(secret: string): Promise<string> {
  const timestamp = String(Date.now());
  const keyData = encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const data = encode(timestamp);
  const sig = bufToHex(await crypto.subtle.sign('HMAC', key, data.buffer as ArrayBuffer));
  return `${timestamp}.${sig}`;
}

export async function POST(request: Request) {
  const accessCode = process.env.ACCESS_CODE;

  try {
    const body = await request.json();
    const parsed = InviteSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('INVALID_REQUEST', 400, 'Invalid request', parsed.error.issues[0].message);
    }

    const { code } = parsed.data;
    const dao = await createInvitationDAO();
    const invite = await dao.getByCode(code.trim().toUpperCase());

    if (!invite) {
      return apiError('INVITATION_INVALID', 400, '邀请码无效或已过期');
    }

    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return apiError('INVITATION_INVALID', 400, '邀请码已过期');
    }

    if (invite.currentUses >= invite.maxUses) {
      return apiError('INVITATION_EXHAUSTED', 410, '邀请码已被使用完');
    }

    // Sign beta_access cookie
    const secret = accessCode || process.env.JWT_SECRET || 'change-me-in-production';
    const betaToken = await signBetaToken(secret);

    return NextResponse.json({ success: true, message: '邀请码有效' }, {
      headers: {
        'Set-Cookie': `beta_access=${betaToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
      },
    });
  } catch (err) {
    return apiError('INTERNAL_ERROR', 500, 'Failed to validate invitation code');
  }
}
