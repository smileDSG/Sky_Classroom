import type { StorageEntry, StorageProvider } from '@/lib/storage/storage-types';
import { transitionSubmission } from './submission-state';
import type { HandwritingSubject, HandwritingSubmission, SubmissionStatus } from './types';

const TABLE = 'handwriting_submissions';
export const HANDWRITING_MAX_PAGES = 12;

export interface CreateHandwritingSubmissionInput {
  userId: string;
  subject: HandwritingSubject;
  existingProblemId?: string;
  title?: string;
}

function createSubmissionId(): string {
  return `handwriting_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toSubmission(entry: StorageEntry<HandwritingSubmission>): HandwritingSubmission {
  return { ...entry.data, id: entry.id };
}

export function createHandwritingSubmissionDAO(storage: StorageProvider) {
  return {
    async create(input: CreateHandwritingSubmissionInput): Promise<HandwritingSubmission> {
      const now = Date.now();
      const submission: HandwritingSubmission = {
        id: createSubmissionId(),
        userId: input.userId,
        subject: input.subject,
        existingProblemId: input.existingProblemId,
        title: input.title,
        status: 'draft',
        pageIds: [],
        createdAt: now,
        updatedAt: now,
      };

      await storage.set<HandwritingSubmission>(TABLE, {
        id: submission.id,
        data: submission,
        createdAt: now,
        updatedAt: now,
      });
      return submission;
    },

    async getForUser(id: string, userId: string): Promise<HandwritingSubmission | null> {
      const entry = await storage.get<HandwritingSubmission>(TABLE, id);
      if (!entry || entry.data.userId !== userId) return null;
      return toSubmission(entry);
    },

    async listByUser(userId: string): Promise<{ items: HandwritingSubmission[]; total: number }> {
      const entries = await storage.getAll<HandwritingSubmission>(
        TABLE,
        (entry) => entry.data.userId === userId,
      );
      const items = entries.sort((a, b) => b.updatedAt - a.updatedAt).map(toSubmission);
      return { items, total: items.length };
    },

    async updateStatus(
      id: string,
      userId: string,
      status: SubmissionStatus,
    ): Promise<HandwritingSubmission | null> {
      const entry = await storage.get<HandwritingSubmission>(TABLE, id);
      if (!entry || entry.data.userId !== userId) return null;

      const now = Date.now();
      const submission: HandwritingSubmission = {
        ...entry.data,
        status: transitionSubmission(entry.data.status, status),
        updatedAt: now,
      };
      await storage.set<HandwritingSubmission>(TABLE, {
        ...entry,
        data: submission,
        updatedAt: now,
      });
      return submission;
    },

    async attachPages(
      id: string,
      userId: string,
      pageIds: string[],
    ): Promise<HandwritingSubmission | null> {
      const entry = await storage.get<HandwritingSubmission>(TABLE, id);
      if (!entry || entry.data.userId !== userId) return null;
      if (entry.data.pageIds.length + pageIds.length > HANDWRITING_MAX_PAGES) {
        throw new Error('A handwriting submission can contain at most 12 pages');
      }

      const now = Date.now();
      const submission: HandwritingSubmission = {
        ...entry.data,
        pageIds: [...entry.data.pageIds, ...pageIds],
        updatedAt: now,
      };
      await storage.set<HandwritingSubmission>(TABLE, {
        ...entry,
        data: submission,
        updatedAt: now,
      });
      return submission;
    },
  };
}
