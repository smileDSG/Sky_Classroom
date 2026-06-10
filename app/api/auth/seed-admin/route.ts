/**
 * POST /api/auth/seed-admin
 * Manually seed admin user and return diagnostic info.
 */

import { NextResponse } from 'next/server';
import { createUserDAO } from '@/lib/storage/dao/users';
import { hashPassword } from '@/lib/server/auth';
import { getServerStorage } from '@/lib/server/server-storage';

export async function POST() {
  try {
    const storage = await getServerStorage();
    const storageType = storage.constructor.name;

    const dao = await createUserDAO(storage);
    const existing = await dao.getByUsername('admin');

    if (existing) {
      // Reset password
      const passwordHash = await hashPassword('123');
      await dao.update(existing.id, { passwordHash });
      return NextResponse.json({
        success: true,
        action: 'password_reset',
        storageType,
        userId: existing.id,
      });
    }

    // Create new
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
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
