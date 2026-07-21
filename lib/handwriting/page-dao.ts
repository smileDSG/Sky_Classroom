import type { StorageEntry, StorageProvider } from '@/lib/storage/storage-types';
import type { ImageQualityIssue, SubmissionPage } from './types';

const TABLE = 'handwriting_pages';

export interface CreateHandwritingPageInput {
  id?: string;
  submissionId: string;
  order: number;
  objectKey: string;
  width: number;
  height: number;
  qualityScore: number;
  qualityIssues: ImageQualityIssue[];
}

function createPageId(): string {
  return `handwriting_page_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toPage(entry: StorageEntry<SubmissionPage>): SubmissionPage {
  return { ...entry.data, id: entry.id };
}

export function createHandwritingPageDAO(storage: StorageProvider) {
  return {
    async create(input: CreateHandwritingPageInput): Promise<SubmissionPage> {
      const now = Date.now();
      const page: SubmissionPage = {
        id: input.id ?? createPageId(),
        submissionId: input.submissionId,
        order: input.order,
        objectKey: input.objectKey,
        width: input.width,
        height: input.height,
        qualityScore: input.qualityScore,
        qualityIssues: input.qualityIssues,
        regions: [],
        createdAt: now,
      };

      await storage.set<SubmissionPage>(TABLE, {
        id: page.id,
        data: page,
        createdAt: now,
        updatedAt: now,
      });
      return page;
    },

    async listBySubmission(submissionId: string): Promise<SubmissionPage[]> {
      const entries = await storage.getAll<SubmissionPage>(
        TABLE,
        (entry) => entry.data.submissionId === submissionId,
      );
      return entries.map(toPage).sort((a, b) => a.order - b.order);
    },
  };
}
