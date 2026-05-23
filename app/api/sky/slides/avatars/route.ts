/**
 * GET /api/sky/slides/avatars
 * Returns the list of available avatar configurations.
 */
import { apiSuccess } from '@/lib/server/api-response';
import { AVATAR_PRESETS } from '@/lib/slides';

export async function GET() {
  const avatars = AVATAR_PRESETS.map(({ id, name, avatarUrl, description, style }) => ({
    id,
    name,
    avatarUrl,
    description,
    style,
  }));
  return apiSuccess({ avatars });
}
