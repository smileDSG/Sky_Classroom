/**
 * sessionStorage helpers for managing active teaching jobs.
 * Supports multiple concurrent jobs with topic labels for display.
 * Survives page navigation but not browser close.
 */

const JOBS_KEY = 'activeTeachingJobIds';

export interface StoredTeachingJobEntry {
  jobId: string;
  topic: string;
}

export function getActiveTeachingJobEntries(): StoredTeachingJobEntry[] {
  try {
    const raw = sessionStorage.getItem(JOBS_KEY);
    return raw ? (JSON.parse(raw) as StoredTeachingJobEntry[]) : [];
  } catch {
    return [];
  }
}

export function addActiveTeachingJobEntry(entry: StoredTeachingJobEntry): void {
  const entries = getActiveTeachingJobEntries().filter((e) => e.jobId !== entry.jobId);
  entries.push(entry);
  sessionStorage.setItem(JOBS_KEY, JSON.stringify(entries));
}

export function removeActiveTeachingJobEntry(jobId: string): void {
  const entries = getActiveTeachingJobEntries().filter((e) => e.jobId !== jobId);
  if (entries.length === 0) {
    sessionStorage.removeItem(JOBS_KEY);
  } else {
    sessionStorage.setItem(JOBS_KEY, JSON.stringify(entries));
  }
}
