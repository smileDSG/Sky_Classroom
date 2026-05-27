/**
 * POST /api/auth/seed-admin
 * Returns the admin password hash for client-side seeding.
 */

import { NextResponse } from 'next/server';
import { ensureAdminUser } from '@/lib/server/admin-seed';
import { hashPassword } from '@/lib/server/auth';

export async function POST() {
  try {
    await ensureAdminUser();
    const passwordHash = await hashPassword('123');
    return NextResponse.json({ success: true, passwordHash });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
