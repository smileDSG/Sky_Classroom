import { apiError, apiSuccess, API_ERROR_CODES } from '@/lib/server/api-response';
import { readAnimationScript } from '@/lib/animation/script-store';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scriptId: string }> },
) {
  const { scriptId } = await params;
  const script = await readAnimationScript(scriptId);
  if (!script) return apiError(API_ERROR_CODES.NOT_FOUND, 404, '脚本不存在');
  return apiSuccess({ script });
}
