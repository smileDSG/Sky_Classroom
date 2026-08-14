import { z } from 'zod';

import { apiError, apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { getRequiredServerStorage } from '@/lib/server/server-storage';
import { createVirtualSimulationDAO } from '@/lib/adaptive-learning/data/virtual-simulations';
import {
  simulateVirtualStudent,
  VIRTUAL_STUDENT_PROFILES,
} from '@/lib/adaptive-learning/simulation/virtual-student';

const runInputSchema = z
  .object({
    profileId: z.string().min(1).max(80),
    topic: z.string().min(1).max(200),
    maxTurns: z.number().int().min(1).max(30).optional(),
    seed: z.number().int().optional(),
    modelMode: z.enum(['mock', 'cheap-llm']).default('mock'),
  })
  .strict();

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const storage = await getRequiredServerStorage();
  const runs = await createVirtualSimulationDAO(storage).list();
  return apiSuccess({ profiles: VIRTUAL_STUDENT_PROFILES, runs });
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => null);
  const parsed = runInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      'INVALID_REQUEST',
      400,
      'Invalid virtual student simulation',
      parsed.error.issues[0]?.message,
    );
  }
  const profile = VIRTUAL_STUDENT_PROFILES.find((item) => item.profileId === parsed.data.profileId);
  if (!profile) return apiError('NOT_FOUND', 404, 'Virtual student profile not found');
  const result = simulateVirtualStudent({ ...parsed.data, profile });
  const storage = await getRequiredServerStorage();
  const record = await createVirtualSimulationDAO(storage).add(result);
  return apiSuccess({ run: record, source: 'simulation' }, 201);
}
