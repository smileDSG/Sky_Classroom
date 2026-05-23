/**
 * POST /api/sky/slides/export-pptx
 * PPTX Export — generates a .pptx file server-side and returns it as a download.
 */
import { NextRequest, NextResponse } from 'next/server';
import { exportPptx } from '@/lib/slides/pptx-exporter';
import { exportPptxWithTemplate } from '@/lib/slides/template-exporter';
import type { PptxThemeId } from '@/lib/slides/pptx-themes';
import { apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import type { Slide } from '@/lib/types/slides';
import type { AvatarSpeech } from '@/lib/slides/types';

const log = createLogger('API:SkyExportPptx');

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let titleSnippet: string | undefined;
  try {
    const body = await req.json();
    const {
      title,
      slides,
      theme,
      speakerNotes,
      avatarSpeech,
      includeSpeakerNotes,
      layoutMode,
    } = body as {
      title?: string;
      slides?: Slide[];
      theme?: string;
      speakerNotes?: string[];
      avatarSpeech?: AvatarSpeech;
      includeSpeakerNotes?: boolean;
      layoutMode?: 'ai' | 'template';
    };

    if (!title || !title.trim()) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400,
        'Missing required field: title',
      );
    }

    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400,
        'Missing required field: slides (non-empty array)',
      );
    }

    titleSnippet = title.substring(0, 40);

    log.info(`Exporting PPTX: "${titleSnippet}" (${slides.length} slides, notes=${!!includeSpeakerNotes})`);

    const exporter = exportPptxWithTemplate;

    const result = await exporter({
      title: title.trim(),
      slides,
      theme: theme as PptxThemeId | undefined,
      speakerNotes,
      avatarSpeech,
      includeSpeakerNotes: includeSpeakerNotes ?? false,
      layoutMode: layoutMode,
    });

    const blob = new Uint8Array(result.buffer);
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
        'Content-Length': String(result.size),
      },
    });
  } catch (err) {
    log.error(`PPTX export failed [title="${titleSnippet ?? 'unknown'}"]:`, err);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR, 500,
      'PPTX 导出失败',
      err instanceof Error ? err.message : undefined,
    );
  }
}
