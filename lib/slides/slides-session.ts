/**
 * sessionStorage helpers for managing active slides generation jobs.
 * Mirrors the pattern in lib/classroom/classroom-session.ts.
 */

const SLIDES_JOBS_KEY = 'activeSlidesJobIds';

export interface StoredSlidesJobEntry {
  jobId: string;
  topic: string;
  difficulty: string;
}

export function getActiveSlidesJobEntries(): StoredSlidesJobEntry[] {
  try {
    const raw = sessionStorage.getItem(SLIDES_JOBS_KEY);
    return raw ? (JSON.parse(raw) as StoredSlidesJobEntry[]) : [];
  } catch {
    return [];
  }
}

export function addActiveSlidesJobEntry(entry: StoredSlidesJobEntry): void {
  const entries = getActiveSlidesJobEntries().filter((e) => e.jobId !== entry.jobId);
  entries.push(entry);
  sessionStorage.setItem(SLIDES_JOBS_KEY, JSON.stringify(entries));
}

export function removeActiveSlidesJobEntry(jobId: string): void {
  const entries = getActiveSlidesJobEntries().filter((e) => e.jobId !== jobId);
  if (entries.length === 0) {
    sessionStorage.removeItem(SLIDES_JOBS_KEY);
  } else {
    sessionStorage.setItem(SLIDES_JOBS_KEY, JSON.stringify(entries));
  }
}
