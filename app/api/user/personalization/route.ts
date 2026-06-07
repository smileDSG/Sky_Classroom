/**
 * GET /api/user/personalization — Get user's personalization settings
 * PATCH /api/user/personalization — Update personalization settings
 */

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { createUserDAO } from '@/lib/storage/dao/users';

const SubjectPreferenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
});

const UpdatePersonalizationSchema = z.object({
  educationLevel: z.enum(['primary', 'middle', 'high', 'undergraduate', 'graduate', 'other']).optional(),
  grade: z.string().max(20).optional(),
  favoriteSubjects: z.array(SubjectPreferenceSchema).optional(),
  learningStyle: z.enum(['visual', 'auditory', 'reading', 'kinesthetic', 'balanced']).optional(),
  detailLevel: z.enum(['concise', 'standard', 'detailed', 'comprehensive']).optional(),
  preferredLanguage: z.string().max(10).optional(),
  aiPersonality: z.enum(['friendly', 'professional', 'encouraging', 'strict', 'humorous']).optional(),
  aiName: z.string().max(20).optional(),
  customInstructions: z.string().max(500).optional(),
  autoGenerateQuiz: z.boolean().optional(),
  showStepByStep: z.boolean().optional(),
  enableMemory: z.boolean().optional(),
  enableRAG: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { user } = auth;
  
  // Return personalization fields from user record
  return apiSuccess({
    personalization: {
      educationLevel: user.educationLevel || 'middle',
      grade: user.grade || '',
      favoriteSubjects: user.favoriteSubjects || [],
      learningStyle: user.learningStyle || 'balanced',
      detailLevel: user.detailLevel || 'standard',
      preferredLanguage: user.preferredLanguage || 'zh',
      aiPersonality: user.aiPersonality || 'friendly',
      aiName: user.aiName || '小智',
      customInstructions: user.customInstructions || '',
      autoGenerateQuiz: user.autoGenerateQuiz ?? true,
      showStepByStep: user.showStepByStep ?? true,
      enableMemory: user.enableMemory ?? true,
      enableRAG: user.enableRAG ?? true,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const body = await request.json();
  const parsed = UpdatePersonalizationSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('INVALID_REQUEST', 400, 'Validation failed', parsed.error.issues[0].message);
  }

  const dao = await createUserDAO();
  
  // Build update data with only provided fields
  const updateData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== undefined) {
      updateData[key] = value;
    }
  }

  const updated = await dao.update(auth.user.id, updateData);
  if (!updated) {
    return apiError('NOT_FOUND', 404, 'User not found');
  }

  return apiSuccess({
    personalization: {
      educationLevel: updated.educationLevel,
      grade: updated.grade,
      favoriteSubjects: updated.favoriteSubjects,
      learningStyle: updated.learningStyle,
      detailLevel: updated.detailLevel,
      preferredLanguage: updated.preferredLanguage,
      aiPersonality: updated.aiPersonality,
      aiName: updated.aiName,
      customInstructions: updated.customInstructions,
      autoGenerateQuiz: updated.autoGenerateQuiz,
      showStepByStep: updated.showStepByStep,
      enableMemory: updated.enableMemory,
      enableRAG: updated.enableRAG,
    },
  });
}
