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
import { hashPassword } from '@/lib/server/auth';
import { getServerStorage } from '@/lib/server/server-storage';
import { ensureAdminUser } from '@/lib/server/admin-seed';

export async function POST() {
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

    // Should not normally happen after ensureAdminUser(), but handle it safely.
    const passwordHash = await hashPassword('123');
    const created = await dao.create({
      id: 'admin-default',
      email: null,
      username: 'admin',
      passwordHash,
      role: 'admin',
      status: 'active',
      guestId: null,
      planType: 'enterprise',
      avatar: null,
      nickname: '管理员',
      bio: null,
      educationLevel: null,
      grade: null,
      favoriteSubjects: null,
      learningOnboarding: null,
      learningStyle: null,
      detailLevel: null,
      preferredLanguage: null,
      aiPersonality: null,
      aiName: null,
      customInstructions: null,
      autoGenerateQuiz: null,
      showStepByStep: null,
      enableMemory: null,
      enableRAG: null,
      emailVerified: true,
      emailVerifyToken: null,
      resetToken: null,
      resetTokenExpiry: null,
    });

    return NextResponse.json({
      success: true,
      action: 'created',
      storageType,
      userId: created.id,
      passwordHash,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
