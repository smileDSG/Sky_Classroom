'use client';

import { useCallback, useRef } from 'react';
import { isDocumentVisible } from '@/lib/hooks/use-document-visibility';

export interface JobResult {
  pptxUrl: string;
  fileName: string;
  previewImages?: string[];
  qaReport?: unknown;
}

export interface JobPollingCallbacks {
  onStageUpdate?: (stage: string, progress: number, message: string) => void;
  onComplete?: (result: JobResult) => void;
  onError?: (error: string) => void;
}

export function useJobPolling() {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (jobId: string, callbacks: JobPollingCallbacks) => {
      stopPolling();
      let pollErrors = 0;
      const MAX_POLL_ERRORS = 5;

      const tick = async () => {
        // Skip network work while the tab is hidden/backgrounded.
        if (!isDocumentVisible()) return;
        try {
          const statusRes = await fetch(
            `/api/sky/slides/generate/status?jobId=${jobId}`,
          );
          const statusData = await statusRes.json();
          if (statusData.success) {
            pollErrors = 0;
            const job = statusData.data || statusData.job;
            if (!job) return;

            callbacks.onStageUpdate?.(
              job.stage,
              job.progress || 0,
              job.message || '',
            );

            if (job.stage === 'done') {
              stopPolling();
              if (job.pptxUrl) {
                callbacks.onComplete?.({
                  pptxUrl: job.pptxUrl,
                  fileName: job.fileName || '课件.pptx',
                  previewImages: job.previewImages || undefined,
                  qaReport: job.qaReport,
                });
              } else if (job.error) {
                callbacks.onError?.(`生成失败: ${job.error}`);
              }
            }
          } else if (statusRes.status === 404) {
            stopPolling();
            callbacks.onError?.('生成任务已过期，请重新生成');
          }
        } catch {
          pollErrors++;
          if (pollErrors >= MAX_POLL_ERRORS) {
            stopPolling();
            callbacks.onError?.(
              '状态查询失败，请检查网络或刷新页面后重试',
            );
          }
        }
      };

      tick(); // immediate first check
      pollRef.current = setInterval(tick, 2000);
      return () => stopPolling();
    },
    [stopPolling],
  );

  return { startPolling, stopPolling };
}
