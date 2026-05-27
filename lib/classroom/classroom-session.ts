/**
 * sessionStorage helpers for managing the active classroom job list.
 * Supports multiple concurrent jobs with topic labels for display.
 */

const JOBS_KEY = 'activeClassroomJobIds';

export interface StoredJobEntry {
  jobId: string;
  topic: string;
}

export function getActiveJobEntries(): StoredJobEntry[] {
  try {
    const raw = sessionStorage.getItem(JOBS_KEY);
    return raw ? (JSON.parse(raw) as StoredJobEntry[]) : [];
  } catch {
    return [];
  }
}

export function addActiveJobEntry(entry: StoredJobEntry): void {
  const entries = getActiveJobEntries().filter((e) => e.jobId !== entry.jobId);
  entries.push(entry);
  sessionStorage.setItem(JOBS_KEY, JSON.stringify(entries));
}

export function removeActiveJobEntry(jobId: string): void {
  const entries = getActiveJobEntries().filter((e) => e.jobId !== jobId);
  if (entries.length === 0) {
    sessionStorage.removeItem(JOBS_KEY);
  } else {
    sessionStorage.setItem(JOBS_KEY, JSON.stringify(entries));
  }
}
