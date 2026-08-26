/**
 * POST /api/auth/seed-admin
 * Ensure the default admin account exists.
 *
 * Security: this endpoint only CREATES the admin account if it does not exist.
 * It never resets the password of an existing admin — that would let anyone
 * take over the account by forcing it back to the default password. Password
 * resets must go through an authenticated admin path.
 */

import { NextResponse } from 'next/server';
import { createUserDAO } from '@/lib/storage/dao/users';
import { getServerStorage } from '@/lib/server/server-storage';
import { ensureAdminUser } from '@/lib/server/admin-seed';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  try {
    // Run the same idempotent seeding the login flow uses, then report state.
    await ensureAdminUser();

    const storage = await getServerStorage();
    const storageType = storage.constructor.name;

    const dao = await createUserDAO(storage);
    const existing = await dao.getByUsername('admin');

    // Account already exists — do NOT touch its password.
    if (existing) {
      return NextResponse.json({
        success: true,
        action: 'exists',
        storageType,
        userId: existing.id,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Admin seed is disabled or unavailable' },
      { status: 503 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
