'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { fetchClassroomJob } from '@/lib/classroom/classroom-job-client';
import { getActiveJobEntries, removeActiveJobEntry } from '@/lib/classroom/classroom-session';

const POLL_INTERVAL_MS = 2000;

/**
 * Global poller mounted in root layout.
 * Monitors ALL active classroom generation jobs across all pages and
 * forces navigation to the outline review page when outlines are first ready.
 */
export function ClassroomJobPoller() {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigatedJobsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const entries = getActiveJobEntries();
    if (entries.length === 0) return; // 没有活跃 job 时不启动轮询

    const poll = async () => {
      try {
        // Already on a generation page — don't interrupt
        if (
          pathname.startsWith('/generation-progress') ||
          pathname.startsWith('/generation-preview')
        ) {
          return;
        }

        const entries = getActiveJobEntries();
        if (entries.length === 0) {
          // 没有活跃 job，停止轮询
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return;
        }

        for (const entry of entries) {
          try {
            const data = await fetchClassroomJob(entry.jobId);
            if (!data) {
              removeActiveJobEntry(entry.jobId);
              navigatedJobsRef.current.delete(entry.jobId);
              continue;
            }

            if (data.status === 'cancelled' || data.status === 'failed') {
              removeActiveJobEntry(entry.jobId);
              navigatedJobsRef.current.delete(entry.jobId);
              continue;
            }

            if (data.done && data.status === 'succeeded') {
              removeActiveJobEntry(entry.jobId);
              navigatedJobsRef.current.delete(entry.jobId);
              continue;
            }

            // Force navigate to review when outlines are first ready (only once per job)
            if (data.status === 'awaiting_review' && data.outlines?.length) {
              if (!navigatedJobsRef.current.has(entry.jobId)) {
                navigatedJobsRef.current.add(entry.jobId);
                router.push(`/generation-progress?jobId=${entry.jobId}`);
              }
            } else if (data.status !== 'awaiting_review') {
              // Reset guard when job leaves awaiting_review (e.g. user approved)
              navigatedJobsRef.current.delete(entry.jobId);
            }
          } catch {
            // Individual job fetch may fail — continue to next job
          }
        }
      } catch {
        // sessionStorage may be unavailable
      }
    };

    // Poll immediately, then on interval
    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pathname, router]);

  return null;
}
