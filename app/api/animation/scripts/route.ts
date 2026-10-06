import { apiSuccess } from '@/lib/server/api-response';
import { listAnimationScripts } from '@/lib/animation/script-store';

export async function GET() {
  const scripts = await listAnimationScripts();
  return apiSuccess({ scripts });
}
