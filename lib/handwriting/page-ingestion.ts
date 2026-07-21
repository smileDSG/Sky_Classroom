import { analyzeHandwritingImage } from './image-quality';
import type { HandwritingImageQualityResult } from './image-quality';
import { validateHandwritingImage } from './image-validation';
import type { ImageValidationErrorCode } from './image-validation';
import type { HandwritingObjectStore } from './object-store';
import type { createHandwritingPageDAO } from './page-dao';
import { HANDWRITING_MAX_PAGES, type createHandwritingSubmissionDAO } from './submission-dao';
import type { HandwritingSubmission, ImageQualityIssue, SubmissionPage } from './types';

export type HandwritingPageBatchErrorCode =
  | ImageValidationErrorCode
  | 'empty_batch'
  | 'too_many_pages';

export class HandwritingPageBatchError extends Error {
  constructor(
    public readonly code: HandwritingPageBatchErrorCode,
    message: string,
    public readonly fileIndex?: number,
  ) {
    super(message);
    this.name = 'HandwritingPageBatchError';
  }
}

interface PageIngestionDependencies {
  submissionDAO: Pick<ReturnType<typeof createHandwritingSubmissionDAO>, 'attachPages'>;
  pageDAO: Pick<ReturnType<typeof createHandwritingPageDAO>, 'create'>;
  objectStore: HandwritingObjectStore;
  analyzeImage?: (buffer: Buffer) => Promise<HandwritingImageQualityResult>;
}

export interface IngestHandwritingPagesInput {
  submission: HandwritingSubmission;
  userId: string;
  files: File[];
}

export interface IngestHandwritingPagesResult {
  pages: SubmissionPage[];
  blockingIssues: ImageQualityIssue[];
  canContinue: boolean;
}

function createPageId(): string {
  return `handwriting_page_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createHandwritingPageIngestionService({
  submissionDAO,
  pageDAO,
  objectStore,
  analyzeImage = analyzeHandwritingImage,
}: PageIngestionDependencies) {
  return {
    async ingest(input: IngestHandwritingPagesInput): Promise<IngestHandwritingPagesResult> {
      if (input.files.length === 0) {
        throw new HandwritingPageBatchError('empty_batch', '至少上传一张答案图片');
      }
      if (input.submission.pageIds.length + input.files.length > HANDWRITING_MAX_PAGES) {
        throw new HandwritingPageBatchError(
          'too_many_pages',
          'A handwriting submission can contain at most 12 pages',
        );
      }

      input.files.forEach((file, index) => {
        const validation = validateHandwritingImage(file);
        if (!validation.valid) {
          throw new HandwritingPageBatchError(validation.code, validation.message, index);
        }
      });

      const buffers = await Promise.all(
        input.files.map(async (file) => Buffer.from(await file.arrayBuffer())),
      );
      const qualityResults = await Promise.all(buffers.map((buffer) => analyzeImage(buffer)));
      const pageIds = input.files.map(() => createPageId());
      const objectKeys: string[] = [];

      for (let index = 0; index < input.files.length; index += 1) {
        objectKeys.push(
          await objectStore.put({
            userId: input.userId,
            submissionId: input.submission.id,
            pageId: pageIds[index],
            mimeType: input.files[index].type,
            buffer: buffers[index],
          }),
        );
      }

      const pages: SubmissionPage[] = [];
      for (let index = 0; index < input.files.length; index += 1) {
        const quality = qualityResults[index];
        pages.push(
          await pageDAO.create({
            id: pageIds[index],
            submissionId: input.submission.id,
            order: input.submission.pageIds.length + index + 1,
            objectKey: objectKeys[index],
            width: quality.width,
            height: quality.height,
            qualityScore: quality.qualityScore,
            qualityIssues: quality.qualityIssues,
          }),
        );
      }

      const attached = await submissionDAO.attachPages(input.submission.id, input.userId, pageIds);
      if (!attached) throw new Error('Handwriting submission disappeared during page ingestion');

      const blockingIssues = pages.flatMap((page) =>
        page.qualityIssues.filter((issue) => issue.severity === 'blocking'),
      );
      return { pages, blockingIssues, canContinue: blockingIssues.length === 0 };
    },
  };
}
