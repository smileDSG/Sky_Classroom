'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { fetchClassroomJob } from '@/lib/classroom/classroom-job-client';
import { getActiveJobEntries, removeActiveJobEntry, type StoredJobEntry } from '@/lib/classroom/classroom-session';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { isDocumentVisible } from '@/lib/hooks/use-document-visibility';

const POLL_INTERVAL_MS = 2000;

interface ReadyJob {
  jobId: string;
  topic: string;
  sceneCount: number;
}

interface GeneratingJob {
  jobId: string;
  topic: string;
}

interface CompletedJob {
  jobId: string;
  classroomId: string;
  topic: string;
  scenesCount: number;
}

/**
 * Global poller mounted in root layout.
 * Monitors ALL active classroom generation jobs across all pages.
 * - Shows a dialog when outlines are ready for review (non-home pages)
 * - Shows a dialog when classroom generation completes (non-home pages)
 */
export function ClassroomJobPoller() {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dialogShownRef = useRef<Set<string>>(new Set());
  const [readyJob, setReadyJob] = useState<ReadyJob | null>(null);
  const [completedJob, setCompletedJob] = useState<CompletedJob | null>(null);
  const [generatingJob, setGeneratingJob] = useState<GeneratingJob | null>(null);

  const handleGoToReview = useCallback(() => {
    if (readyJob) {
      router.push(`/generation-progress?jobId=${readyJob.jobId}`);
      setReadyJob(null);
    }
  }, [readyJob, router]);

  const handleGoToClassroom = useCallback(() => {
    if (completedJob) {
      removeActiveJobEntry(completedJob.jobId);
      router.push(`/classroom/${completedJob.classroomId}`);
      setCompletedJob(null);
    }
  }, [completedJob, router]);

  const handleDismissReady = useCallback(() => {
    if (readyJob) removeActiveJobEntry(readyJob.jobId);
    setReadyJob(null);
  }, [readyJob]);

  const handleDismissCompleted = useCallback(() => {
    if (completedJob) removeActiveJobEntry(completedJob.jobId);
    setCompletedJob(null);
  }, [completedJob]);

  const handleGoToGenerating = useCallback(() => {
    if (generatingJob) {
      removeActiveJobEntry(generatingJob.jobId);
      router.push(`/classroom/${generatingJob.jobId}`);
      setGeneratingJob(null);
    }
  }, [generatingJob, router]);

  const handleDismissGenerating = useCallback(() => {
    if (generatingJob) removeActiveJobEntry(generatingJob.jobId);
    setGeneratingJob(null);
  }, [generatingJob]);

  useEffect(() => {
    const entries = getActiveJobEntries();
    if (entries.length === 0) return;

    const poll = async () => {
      // Skip network work while the tab is hidden/backgrounded.
      if (!isDocumentVisible()) return;
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
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return;
        }

        for (const entry of entries) {
          try {
            // Client-side generation — show "generating" dialog directly
            if (entry.isClientSide) {
              if (!dialogShownRef.current.has(`gen:${entry.jobId}`)) {
                dialogShownRef.current.add(`gen:${entry.jobId}`);
                setGeneratingJob({ jobId: entry.jobId, topic: entry.topic });
              }
              continue;
            }

            const data = await fetchClassroomJob(entry.jobId);
            if (!data) {
              removeActiveJobEntry(entry.jobId);
              continue;
            }

            if (data.status === 'cancelled' || data.status === 'failed') {
              removeActiveJobEntry(entry.jobId);
              dialogShownRef.current.delete(entry.jobId);
              continue;
            }

            // Classroom completed — show dialog on non-home pages
            if (data.done && data.status === 'succeeded') {
              // Don't remove entry yet — keep it so the dialog can reappear
              // if the user navigates again without clicking the action button.
              // Entry is removed when the user clicks the dialog action or dismisses it.
              if (data.result && !dialogShownRef.current.has(`done:${entry.jobId}`)) {
                dialogShownRef.current.add(`done:${entry.jobId}`);
                setCompletedJob({
                  jobId: entry.jobId,
                  classroomId: data.result.classroomId,
                  topic: data.topicSummary || entry.topic,
                  scenesCount: data.result.scenesCount,
                });
              }
              continue;
            }

            // Show dialog when outlines are first ready (only once per job)
            if (data.status === 'awaiting_review' && data.outlines?.length) {
              if (!dialogShownRef.current.has(entry.jobId)) {
                dialogShownRef.current.add(entry.jobId);
                setReadyJob({
                  jobId: entry.jobId,
                  topic: data.topicSummary || entry.topic,
                  sceneCount: data.outlinesMeta?.totalScenes ?? data.outlines.length,
                });
              }
            } else if (data.status !== 'awaiting_review') {
              dialogShownRef.current.delete(entry.jobId);
            }
          } catch {
            // Individual job fetch may fail — continue to next job
          }
        }
      } catch {
        // sessionStorage may be unavailable
      }
    };

    poll();
    timerRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pathname]);

  const activeDialog = completedJob ? 'completed' : readyJob ? 'ready' : generatingJob ? 'generating' : null;

  return (
    <AlertDialog
      open={!!activeDialog}
      onOpenChange={(open) => {
        if (!open) {
          if (completedJob) handleDismissCompleted();
          if (readyJob) handleDismissReady();
          if (generatingJob) handleDismissGenerating();
        }
      }}
    >
      <AlertDialogContent>
        {completedJob && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                课堂生成完成
              </AlertDialogTitle>
              <AlertDialogDescription>
                课堂「{completedJob.topic}」共 {completedJob.scenesCount} 个场景已生成完毕，是否立即进入？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDismissCompleted}>稍后再说</AlertDialogCancel>
              <AlertDialogAction onClick={handleGoToClassroom}>进入课堂</AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
        {readyJob && !completedJob && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-sky-500" />
                大纲已生成
              </AlertDialogTitle>
              <AlertDialogDescription>
                课堂「{readyJob.topic}」共 {readyJob.sceneCount} 个场景的大纲已就绪，是否立即前往审阅？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDismissReady}>稍后再说</AlertDialogCancel>
              <AlertDialogAction onClick={handleGoToReview}>前往审阅</AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
        {generatingJob && !completedJob && !readyJob && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-sky-500 animate-spin" />
                课堂正在生成
              </AlertDialogTitle>
              <AlertDialogDescription>
                课堂「{generatingJob.topic}」正在生成中，是否前往查看？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDismissGenerating}>稍后再说</AlertDialogCancel>
              <AlertDialogAction onClick={handleGoToGenerating}>前往查看</AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
