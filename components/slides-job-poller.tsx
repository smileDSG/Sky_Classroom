'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
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
import { getActiveSlidesJobEntries, removeActiveSlidesJobEntry } from '@/lib/slides/slides-session';
import { isDocumentVisible } from '@/lib/hooks/use-document-visibility';
import { useTaskStore } from '@/lib/store/use-task-store';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { toast } from 'sonner';

const POLL_INTERVAL_MS = 2000;

interface CompletedSlidesJob {
  jobId: string;
  topic: string;
  fileName: string;
  previewImages: string[];
  pptxUrl: string;
  qaReport?: {
    totalScore: number;
    pass: boolean;
    issues: Array<{
      pageNum: number;
      severity: string;
      type: string;
      layer: string;
      detail: string;
    }>;
  };
}

export function SlidesJobPoller() {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dialogShownRef = useRef<Set<string>>(new Set());
  const [completedJob, setCompletedJob] = useState<CompletedSlidesJob | null>(null);

  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const setSlides = useSkyClassroomStore((s) => s.setSlides);
  const setActiveJobId = useSkyClassroomStore((s) => s.setActiveJobId);

  const handleGoToSlides = useCallback(() => {
    if (completedJob) {
      removeActiveSlidesJobEntry(completedJob.jobId);
      setActiveJobId(null);
      setCompletedJob(null);
      router.push('/sky/cloud-mind');
    }
  }, [completedJob, router, setActiveJobId]);

  const handleDismiss = useCallback(() => {
    if (completedJob) {
      removeActiveSlidesJobEntry(completedJob.jobId);
      setActiveJobId(null);
    }
    setCompletedJob(null);
  }, [completedJob, setActiveJobId]);

  useEffect(() => {
    const entries = getActiveSlidesJobEntries();
    if (entries.length === 0) return;

    const poll = async () => {
      // Skip network work while the tab is hidden/backgrounded.
      if (!isDocumentVisible()) return;
      const currentEntries = getActiveSlidesJobEntries();
      if (currentEntries.length === 0) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      const onSlidesPage = pathname.startsWith('/sky/cloud-mind/slides');

      for (const entry of currentEntries) {
        try {
          const res = await fetch(`/api/sky/slides/generate/status?jobId=${entry.jobId}`);

          if (res.status === 404) {
            removeActiveSlidesJobEntry(entry.jobId);
            dialogShownRef.current.delete(entry.jobId);
            continue;
          }

          if (!res.ok) continue;

          const json = await res.json();
          if (!json.success) continue;

          const job = json.data?.job || json.job;
          if (!job) continue;

          // Update task store with latest progress
          const existingTask = useTaskStore.getState().tasks[entry.jobId];
          if (existingTask) {
            updateTask(entry.jobId, {
              progress: job.progress || 0,
              phase: job.message || job.stage || '',
            });
          }

          // Job completed
          if (job.stage === 'done' && job.result?.pptxUrl) {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = null;

            console.log('[SlidesJobPoller] Job completed, updating task store:', entry.jobId);

            // Update task store
            if (existingTask) {
              updateTask(entry.jobId, {
                status: 'completed',
                progress: 100,
                phase: 'PPT生成完成',
                result: {
                  pptxUrl: job.result.pptxUrl,
                  fileName: job.result.fileName,
                  previewImages: job.result.previewImages,
                  qaReport: job.qaReport,
                },
              });
            } else {
              addTask({
                id: entry.jobId,
                type: 'slides',
                label: `课件：${entry.topic}`,
                status: 'completed',
                progress: 100,
                phase: 'PPT生成完成',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                jobId: entry.jobId,
                result: {
                  pptxUrl: job.result.pptxUrl,
                  fileName: job.result.fileName,
                  previewImages: job.result.previewImages,
                  qaReport: job.qaReport,
                },
              });
            }

            // Update slides store so the page can display results on navigation
            setActiveJobId(null);

            // Show dialog and toast only when NOT on the slides page
            // (the slides page displays results inline via task store subscription)
            if (!onSlidesPage && !dialogShownRef.current.has(entry.jobId)) {
              dialogShownRef.current.add(entry.jobId);
              setCompletedJob({
                jobId: entry.jobId,
                topic: entry.topic,
                fileName: job.result.fileName,
                previewImages: job.result.previewImages || [],
                pptxUrl: job.result.pptxUrl,
                qaReport: job.qaReport,
              });
              toast.success(`课件「${entry.topic}」生成完成`);
            }
            continue;
          }

          // Job failed
          if (job.status === 'failed' || (job.stage === 'done' && job.error)) {
            removeActiveSlidesJobEntry(entry.jobId);
            dialogShownRef.current.delete(entry.jobId);

            if (existingTask) {
              updateTask(entry.jobId, {
                status: 'failed',
                error: job.error || '生成失败',
              });
            }
            if (!onSlidesPage) {
              toast.error(`课件「${entry.topic}」生成失败：${job.error || '未知错误'}`);
            }
            continue;
          }
        } catch {
          // Individual job fetch may fail — continue to next job
        }
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

  return (
    <AlertDialog
      open={!!completedJob}
      onOpenChange={(open) => {
        if (!open) handleDismiss();
      }}
    >
      <AlertDialogContent>
        {completedJob && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                课件生成完成
              </AlertDialogTitle>
              <AlertDialogDescription>
                课件「{completedJob.topic}」已生成完毕（{completedJob.previewImages.length}{' '}
                页），是否立即前往查看？
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleDismiss}>稍后再说</AlertDialogCancel>
              <AlertDialogAction onClick={handleGoToSlides}>查看课件</AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
