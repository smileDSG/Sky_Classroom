import 'server-only';

import { search as kbSearch, write as kbWrite } from '@/lib/knowledge-base/kb-manager';
import type { KBWriteOptions } from '@/lib/knowledge-base/types';
import type { SoftwareCupGenerationResult } from '@/lib/software-cup/demo-service';
import { createLogger } from '@/lib/logger';

const log = createLogger('ResourceGenerationKB');

/**
 * 学习包工坊产物入库：把生成的资源写入共享知识库的 `course` 类型，
 * 使其成为授课、出题等功能的 RAG 检索素材源。
 */
export async function ingestGeneratedResources(option: {
  jobId: string;
  result: SoftwareCupGenerationResult;
  write?: (opts: KBWriteOptions) => Promise<{ docId: string; chunks: number }>;
}): Promise<{ documents: number; chunks: number }> {
  const writeFn = option.write ?? kbWrite;
  let documents = 0;
  let chunks = 0;

  for (const resource of option.result.resources) {
    const content = resource.content ?? resource.contentPreview;
    if (!content) continue;

    try {
      const written = await writeFn({
        kbType: 'course',
        title: resource.title || resource.id,
        content,
        tags: ['course_studio', resource.type, resource.generationSource ?? 'generated'].filter(
          Boolean,
        ),
        sourceId: `resource-${option.jobId}-${resource.id}`,
        verified: resource.qualityReview ? resource.qualityReview.issues.length === 0 : false,
      });
      documents += 1;
      chunks += written.chunks;
    } catch (error) {
      log.warn(
        `Failed to ingest resource ${resource.id} (${resource.type}) into KB[course]:`,
        error,
      );
    }
  }

  return { documents, chunks };
}

/**
 * 检索共享 `course` 知识库中由学习包工坊生成的个性化学习资料，
 * 供授课、出题等功能作为 RAG 素材使用。检索失败或为空时返回空串，
 * 调用方应将其视为可选的补充上下文。
 */
export async function retrieveCourseStudioContext(
  query: string,
  options: { topK?: number; maxChars?: number } = {},
): Promise<string> {
  const { topK = 2, maxChars = 1200 } = options;
  let results;
  try {
    results = await kbSearch({ kbType: 'course', query, topK });
  } catch (error) {
    log.warn('KB[course] search failed:', error);
    return '';
  }
  if (results.length === 0) return '';

  return results
    .map((result) => `【${result.chunk.docTitle}】\n${result.chunk.content.slice(0, maxChars)}`)
    .join('\n\n');
}
