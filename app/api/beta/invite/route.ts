/**
 * POST /api/beta/invite
 * 验证邀请码，成功后设置 beta_access HttpOnly cookie
 */
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

const InviteSchema = z.object({
  code: z.string().min(1, '邀请码不能为空'),
});

export async function POST(request: Request) {
  const accessCode = process.env.ACCESS_CODE;

  try {
    const body = await request.json();
    const parsed = InviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { code } = parsed.data;
    const db = createClient(supabaseUrl, supabaseKey);

    const { data: invite } = await db
      .from('invitation_codes')
      .select()
      .eq('code', code.trim().toUpperCase())
      .eq('status', 'active')
      .single();

    if (!invite) {
      return NextResponse.json(
        { success: false, error: '邀请码无效或已过期' },
        { status: 400 },
      );
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      await db.from('invitation_codes').update({ status: 'expired' }).eq('id', invite.id);
      return NextResponse.json(
        { success: false, error: '邀请码已过期' },
        { status: 400 },
      );
    }

    if (invite.current_uses >= invite.max_uses) {
      return NextResponse.json(
        { success: false, error: '邀请码已被使用完' },
        { status: 410 },
      );
    }

    // 更新使用次数
    await db
      .from('invitation_codes')
      .update({ current_uses: invite.current_uses + 1 })
      .eq('id', invite.id);

    // 签名 beta_access cookie
    const secret = accessCode || process.env.JWT_SECRET || 'beta-default-secret';
    const betaToken = await signBetaToken(secret);

    return NextResponse.json({ success: true, message: '验证成功' }, {
      headers: {
        'Set-Cookie': `beta_access=${betaToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
      },
    });
  } catch (err) {
    console.error('[Beta Invite] Error:', err);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 },
    );
  }
}
