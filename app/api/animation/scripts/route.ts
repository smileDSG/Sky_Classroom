import { apiSuccess } from '@/lib/server/api-response';
import { requireAuth } from '@/lib/server/auth/helpers';
import { listAnimationScripts } from '@/lib/animation/script-store';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const scripts = await listAnimationScripts();
  return apiSuccess({ scripts });
}
