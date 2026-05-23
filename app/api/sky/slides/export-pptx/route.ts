/**
 * POST /api/sky/slides/export-pptx
 * Validates export config and confirms readiness for client-side PPTX generation.
 * The actual PPTX file is generated client-side via lib/export/course-exporter.ts.
 */
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerTranslation } from '@/lib/server/i18n';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SkyExportPptx');

export async function POST(req: Request) {
  const locale = req.headers.get('X-Locale') || 'zh-CN';
  try {
    const body = await req.json();
    const { title, includeSlides, includeSpeakerNotes, includeKnowledgePoints, includeSimilarQuestions, avatarName } = body;

    if (!title || !title.trim()) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        'Missing required field: title',
      );
    }

    log.info(`PPTX export prepared: "${title}"`);

    // Return the validated config — client uses it with exportCourseToPPTX()
    return apiSuccess({
      config: {
        title: title.trim(),
        includeSlides: includeSlides ?? true,
        includeSpeakerNotes: includeSpeakerNotes ?? false,
        includeKnowledgePoints: includeKnowledgePoints ?? false,
        includeSimilarQuestions: includeSimilarQuestions ?? false,
        avatarName: avatarName ?? undefined,
      },
    });
  } catch (err) {
    log.error('PPTX export API error:', err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      getServerTranslation(locale, 'api.exportFailed'),
      err instanceof Error ? err.message : undefined,
    );
  }
}
