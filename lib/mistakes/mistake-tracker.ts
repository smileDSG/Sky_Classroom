/**
 * Sky Classroom — Mistake tracker (high-level CRUD + stats + export).
 */

import type { MistakeRecord, MistakeFilter, MistakeStats } from './types';
import type { MistakeCause } from '@/lib/solve/types';
import {
  addMistake as dbAdd,
  getAllMistakes,
  updateMistake as dbUpdate,
  deleteMistake as dbDelete,
} from './db';

// ── Helpers ──────────────────────────────────────────────────────────

function applyFilter(records: MistakeRecord[], filter: MistakeFilter): MistakeRecord[] {
  switch (filter.type) {
    case 'cause':
      return records.filter((r) => r.cause === filter.value);
    case 'knowledgePoint':
      return records.filter((r) => r.knowledgePoints.includes(filter.value));
    case 'dateRange': {
      const from = filter.from.getTime();
      const to = filter.to.getTime();
      return records.filter((r) => {
        const t = r.solvedAt.getTime();
        return t >= from && t <= to;
      });
    }
    case 'reviewed':
      return records.filter((r) => r.reviewed === filter.value);
  }
}

const FIRST_DAY_OF_EPOCH = '1970-01-01T00:00:00.000Z';

function deserializeRecords(records: MistakeRecord[]): MistakeRecord[] {
  return records.map((r) => ({
    ...r,
    solvedAt: new Date(r.solvedAt),
  }));
}

function serializeRecords(records: MistakeRecord[]): MistakeRecord[] {
  return records.map((r) => ({
    ...r,
    solvedAt: r.solvedAt instanceof Date ? r.solvedAt : new Date(r.solvedAt),
  }));
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Track a mistake: persist to IndexedDB.
 * Automatically sets `solvedAt` to now.
 */
export async function trackMistake(record: MistakeRecord): Promise<void> {
  const persisted: MistakeRecord = {
    ...record,
    solvedAt: new Date(),
  };
  await dbAdd(persisted);
}

/**
 * Retrieve all mistakes, optionally filtered.
 */
export async function getMistakes(
  filter?: MistakeFilter,
): Promise<MistakeRecord[]> {
  const raw = await getAllMistakes();
  const records = deserializeRecords(raw);
  if (!filter) return records;
  return applyFilter(records, filter);
}

/**
 * Mark a mistake as reviewed (sets reviewed = true, increments reviewCount).
 */
export async function markReviewed(id: string): Promise<void> {
  const raw = await getAllMistakes();
  const records = deserializeRecords(raw);
  const record = records.find((r) => r.id === id);
  if (!record) {
    throw new Error(`Mistake record not found: ${id}`);
  }
  await dbUpdate(id, {
    reviewed: true,
    reviewCount: (record.reviewCount ?? 0) + 1,
  });
}

/**
 * Delete a mistake record by id.
 */
export async function deleteMistake(id: string): Promise<void> {
  await dbDelete(id);
}

/**
 * Compute aggregate statistics over all tracked mistakes.
 */
export async function getMistakeStats(): Promise<MistakeStats> {
  const raw = await getAllMistakes();
  const records = deserializeRecords(raw);

  const totalCount = records.length;
  const reviewedCount = records.filter((r) => r.reviewed).length;

  const causeDistribution = {} as Record<MistakeCause, number>;
  for (const r of records) {
    causeDistribution[r.cause] = (causeDistribution[r.cause] ?? 0) + 1;
  }

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const recentCount = records.filter(
    (r) => now - r.solvedAt.getTime() <= sevenDaysMs,
  ).length;

  return { totalCount, reviewedCount, causeDistribution, recentCount };
}

/**
 * Export mistakes matching an optional filter.
 */
export async function exportMistakes(
  filter?: MistakeFilter,
): Promise<MistakeRecord[]> {
  const raw = await getAllMistakes();
  const records = deserializeRecords(raw);
  const filtered = filter ? applyFilter(records, filter) : records;
  return serializeRecords(filtered);
}
