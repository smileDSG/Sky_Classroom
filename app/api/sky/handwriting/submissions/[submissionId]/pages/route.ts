import { NextRequest } from 'next/server';
import { resolveHandwritingUserId } from '@/app/api/sky/handwriting/auth';
import {
  HANDWRITING_MAX_PAGES,
  HandwritingPageBatchError,
  createHandwritingPageDAO,
  createHandwritingPageIngestionService,
  createHandwritingSubmissionDAO,
} from '@/lib/handwriting';
import { getHandwritingObjectStore } from '@/lib/handwriting/object-store';
import { createLogger } from '@/lib/logger';
import { apiError, API_ERROR_CODES, apiSuccess } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';

const log = createLogger('API:HandwritingPages');
const UPLOADABLE_STATUSES = new Set(['draft', 'uploaded', 'quality_rejected']);

let servicesPromise: ReturnType<typeof initServices> | null = null;

async function initServices() {
  const storage = await getServerStorage();
  const submissionDAO = createHandwritingSubmissionDAO(storage);
  const pageDAO = createHandwritingPageDAO(storage);
  return {
    submissionDAO,
    ingestion: createHandwritingPageIngestionService({
      submissionDAO,
      pageDAO,
      objectStore: getHandwritingObjectStore(),
    }),
  };
}

async function getServices() {
  if (!servicesPromise) servicesPromise = initServices();
  return servicesPromise;
}

interface RouteContext {
  params: Promise<{ submissionId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const userId = await resolveHandwritingUserId();
  if (!userId) {
    return apiError(API_ERROR_CODES.UNAUTHORIZED, 401, 'Not authenticated');
  }

  try {
    const { submissionId } = await params;
    const { submissionDAO, ingestion } = await getServices();
    const submission = await submissionDAO.getForUser(submissionId, userId);
    if (!submission) {
      return apiError(API_ERROR_CODES.NOT_FOUND, 404, '手写提交不存在');
    }
    if (!UPLOADABLE_STATUSES.has(submission.status)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 409, '当前提交状态不允许上传图片');
    }

    const formData = await req.formData();
    const files = formData
      .getAll('images[]')
      .filter((value): value is File => value instanceof File);
    if (files.length === 0) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '至少上传一张答案图片');
    }
    if (submission.pageIds.length + files.length > HANDWRITING_MAX_PAGES) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 409, '每份手写提交最多包含 12 页');
    }

    const result = await ingestion.ingest({ submission, userId, files });
    if (submission.status === 'draft' || submission.status === 'quality_rejected') {
      await submissionDAO.updateStatus(submission.id, userId, 'uploaded');
    }
    return apiSuccess({ ...result }, 201);
  } catch (error) {
    if (error instanceof HandwritingPageBatchError) {
      const status =
        error.code === 'file_too_large' ? 413 : error.code === 'too_many_pages' ? 409 : 400;
      const code =
        error.code === 'file_too_large'
          ? API_ERROR_CODES.FILE_TOO_LARGE
          : error.code === 'invalid_type'
            ? API_ERROR_CODES.INVALID_FILE_TYPE
            : API_ERROR_CODES.INVALID_REQUEST;
      return apiError(code, status, error.message);
    }
    if (error instanceof Error && error.message === '无法解析图片内容') {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, error.message);
    }
    log.error('Upload handwriting pages failed:', error);
    return apiError(API_ERROR_CODES.STORAGE_ERROR, 500, '手写图片上传失败');
  }
}
