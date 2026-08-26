/**
 * POST /api/sky/teaching/{jobId}/start-classroom
 *
 * Starts a new classroom-generation job from a completed TeachingJob.
 * The job skips AI outline generation and uses the lesson plan's sections
 * as pre-generated outlines, going straight to the review / continue phase.
 */

import { nanoid } from 'nanoid';
import { type NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api-response';
import { readTeachingJob } from '@/lib/server/teaching-job-store';
import { buildOutlineOnlyResultFromTeachingJob } from '@/lib/server/teaching-to-classroom-outline';
import type { TeachingToClassroomConfig } from '@/lib/teaching/classroom-config-recommendation';
import {
  createClassroomGenerationJobHybrid,
  updateClassroomGenerationJobHybrid,
} from '@/lib/server/classroom-job-store-hybrid';
import { buildRequestOrigin } from '@/lib/server/classroom-storage';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
import { resolveClassroomWebSearchConfig } from '@/lib/server/web-search-config';
import { formatSearchResultsAsContext, searchWeb } from '@/lib/web-search';
import { buildSearchQuery } from '@/lib/server/search-query-builder';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:TeachingStartClassroom');

const DEFAULT_CONFIG: TeachingToClassroomConfig = {
  selectedTeacherId: 'default-1',
  selectedStudentIds: ['default-3', 'default-4'],
  enableTTS: true,
  enableImageGeneration: true,
  enableVideoGeneration: false,
  enableWebSearch: false,
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  let resolvedJobId: string | undefined;
  try {
    const { jobId } = await params;
    resolvedJobId = jobId;

    if (!jobId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing jobId');
    }

    // 1. Auth + quota
    const quota = await requireQuota('generationCount');
    if ('error' in quota) return quota.error;

    // 2. Read teaching job
    const job = await readTeachingJob(jobId);
    if (!job) {
      return apiError('NOT_FOUND', 404, '教案不存在');
    }
    if (job.userId !== quota.userId) {
      return apiError('UNAUTHORIZED', 403, '无权访问此教案');
    }
    if (job.status !== 'succeeded') {
      return apiError('INVALID_REQUEST', 409, '教案尚未生成完成，无法创建课堂');
    }

    // 3. Parse user config
    const rawBody = (await req.json().catch(() => ({}))) as Partial<TeachingToClassroomConfig>;
    const config: TeachingToClassroomConfig = {
      ...DEFAULT_CONFIG,
      ...rawBody,
      selectedStudentIds: Array.isArray(rawBody.selectedStudentIds)
        ? rawBody.selectedStudentIds
        : DEFAULT_CONFIG.selectedStudentIds,
    };

    if (!config.selectedTeacherId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '请选择老师');
    }
    if (config.selectedStudentIds.length === 0) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '请至少选择一位同学');
    }

    // 4. Build outline-only result from the lesson plan
    let outlineOnlyResult = buildOutlineOnlyResultFromTeachingJob(job, config);

    // 4.5 Optional web search enrichment
    if (config.enableWebSearch) {
      try {
        const webSearchConfig = resolveClassroomWebSearchConfig({});
        if (webSearchConfig) {
          const searchQuery = await buildSearchQuery(outlineOnlyResult.requirement, undefined);
          const searchResult = await searchWeb({
            providerId: webSearchConfig.providerId,
            query: searchQuery.query,
            apiKey: webSearchConfig.apiKey,
            baseUrl: webSearchConfig.baseUrl,
            baiduSubSources: webSearchConfig.baiduSubSources,
          });
          const researchContext = formatSearchResultsAsContext(searchResult);
          if (researchContext) {
            outlineOnlyResult = { ...outlineOnlyResult, researchContext };
            log.info(`Start classroom web search returned ${searchResult.sources.length} sources for job ${jobId}`);
          }
        } else {
          log.warn(`enableWebSearch is true but no provider configured for job ${jobId}`);
        }
      } catch (searchErr) {
        log.warn(`Web search failed for start-classroom job ${jobId}:`, searchErr);
        // Non-fatal: continue without search context
      }
    }

    // 5. Create classroom generation job
    const baseUrl = buildRequestOrigin(req);
    const newJobId = nanoid(10);

    await createClassroomGenerationJobHybrid(
      newJobId,
      {
        requirement: job.topic,
        enableTTS: config.enableTTS,
        enableImageGeneration: config.enableImageGeneration,
        enableVideoGeneration: config.enableVideoGeneration,
        enableWebSearch: config.enableWebSearch,
      },
      quota.userId,
      undefined,
    );

    // 6. Pre-fill Phase 1 result and mark as awaiting review
    await updateClassroomGenerationJobHybrid(newJobId, {
      status: 'awaiting_review',
      step: 'generating_outlines',
      progress: 30,
      message: '教案大纲已生成，等待审阅',
      phaseOneResult: outlineOnlyResult as unknown as Record<string, unknown>,
      outlines: outlineOnlyResult.outlines,
      outlinesMeta: {
        languageDirective: outlineOnlyResult.languageDirective,
        totalScenes: outlineOnlyResult.outlines.length,
      },
      topicSummary: outlineOnlyResult.topicSummary,
    });

    // 7. Record usage
    await recordUsage(quota.userId, quota.planType, 'generationCount');

    log.info(`Teaching job ${jobId} started classroom job ${newJobId} with ${outlineOnlyResult.outlines.length} outlines`);

    // 注意：前端教学面板统一期望 { success: true, data: {...} } 的包装格式，
    // 不要直接用 apiSuccess（它会展开 data），避免 jobId 取不到。
    return NextResponse.json(
      {
        success: true,
        data: {
          jobId: newJobId,
          status: 'awaiting_review',
          pollUrl: `${baseUrl}/api/generate-classroom/${newJobId}`,
          pollIntervalMs: 1500,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    log.error(`Start classroom from teaching job failed [jobId=${resolvedJobId ?? 'unknown'}]:`, err);
    return apiError(
      'INTERNAL_ERROR',
      500,
      '创建课堂失败',
      err instanceof Error ? err.message : 'Unknown error',
    );
  }
}
