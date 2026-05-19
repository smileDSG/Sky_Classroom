/**
 * GET /api/sky/slides/avatars
 * Returns the list of available avatar configurations.
 */
import { apiSuccess } from '@/lib/server/api-response';
import { AVATAR_CONFIGS } from '@/lib/slides';

export async function GET() {
  const avatars = AVATAR_CONFIGS.map(({ id, name, avatarUrl, personality }) => ({
    id,
    name,
    avatarUrl,
    personality,
  }));
  return apiSuccess({ avatars });
}
