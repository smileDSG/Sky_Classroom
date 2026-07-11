'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  type ClassroomJobState,
  fetchClassroomJob,
  pollClassroomJob,
  approveClassroomOutline,
  cancelClassroomJob,
} from '@/lib/classroom/classroom-job-client';
import type { SceneOutline } from '@/lib/types/generation';
import { removeActiveJobEntry } from '@/lib/classroom/classroom-session';
import { useTaskStore } from '@/lib/store/use-task-store';
import { createLogger } from '@/lib/logger';

const log = createLogger('useClassroomJob');

const PHASE_LABELS: Record<string, string> = {
  initializing: '初始化',
  researching: '搜索资料',
  generating_outlines: '生成大纲',
  awaiting_review: '大纲已生成',
  generating_scenes: '生成场景',
  generating_media: '生成媒体',
  generating_tts: '生成语音',
  persisting: '保存课堂',
  completed: '完成',
};

function getClassroomFailureMessage(error?: string): string {
  if (error?.includes('Stale job')) {
    return '生成任务已失效，可能是开发服务重启或任务停留太久。请返回首页重新生成一次。';
  }
  return error || '课堂生成失败';
}

export type ClassroomJobPhase =
  | 'loading'
  | 'generating'
  | 'reviewing'
  | 'generating_slides'
  | 'done';

interface UseClassroomJobReturn {
  phase: ClassroomJobPhase;
  step: string;
  progress: number;
  message: string;
  outlines: ClassroomJobState['outlines'];
  outlinesMeta: ClassroomJobState['outlinesMeta'];
  scenesGenerated: number;
  totalScenes: number;
  result: ClassroomJobState['result'];
  error: string | null;
  cancelling: boolean;
  approving: boolean;
  stepLabel: string;
  handleApproveOutline: () => Promise<void>;
  handleCancel: () => Promise<void>;
  setOutlines: (outlines: SceneOutline[]) => void;
}

export function useClassroomJob(jobId: string | null): UseClassroomJobReturn {
  const [phase, setPhase] = useState<ClassroomJobPhase>('loading');
  const [step, setStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [outlines, setOutlines] = useState<ClassroomJobState['outlines']>(undefined);
  const [outlinesMeta, setOutlinesMeta] = useState<ClassroomJobState['outlinesMeta']>(undefined);
  const [scenesGenerated, setScenesGenerated] = useState(0);
  const [totalScenes, setTotalScenes] = useState(0);
  const [result, setResult] = useState<ClassroomJobState['result']>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [approving, setApproving] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const hasStartedRef = useRef(false);
  const approveInFlightRef = useRef(false);

  const updateFromJob = useCallback(
    (data: ClassroomJobState) => {
      if (data.status === 'cancelled') {
        removeActiveJobEntry(jobId!);
        toast.info('课堂生成已取消');
        return;
      }

      setStep(data.step);
      setProgress(data.progress);
      setMessage(data.message);
      if (data.outlines) setOutlines(data.outlines);
      if (data.outlinesMeta) setOutlinesMeta(data.outlinesMeta);
      if (data.scenesGenerated != null) setScenesGenerated(data.scenesGenerated);
      if (data.totalScenes != null) setTotalScenes(data.totalScenes);
      if (data.result) {
        setResult(data.result);
      }
      if (data.status === 'failed') {
        removeActiveJobEntry(jobId!);
        setError(getClassroomFailureMessage(data.error));
      }

      const task = useTaskStore.getState().tasks[jobId ?? ''];
      if (task) {
        const update: Record<string, unknown> = {
          progress: data.progress,
          phase: data.message,
        };

        if (data.status === 'awaiting_review') {
          update.status = 'completed';
          update.progress = 100;
          update.phase = '大纲已生成，等待审阅';
        }
        if (data.status === 'failed') {
          update.status = 'failed';
          update.error = getClassroomFailureMessage(data.error);
        }

        useTaskStore.getState().updateTask(task.id, update);
      }
    },
    [jobId],
  );

  useEffect(() => {
    if (!jobId) return;

    hasStartedRef.current = false;

    const abortController = new AbortController();
    abortRef.current = abortController;

    let cancelled = false;

    (async () => {
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      try {
        const current = await fetchClassroomJob(jobId, abortController.signal);
        if (cancelled || abortController.signal.aborted) return;
        if (!current) {
          setError('课堂生成任务不存在');
          return;
        }
        updateFromJob(current);

        if (current.status === 'awaiting_review') {
          setPhase('reviewing');
          return;
        }
        if (current.done) {
          if (current.status === 'succeeded' && current.result) {
            setResult(current.result);
            setPhase('done');
          } else if (current.status === 'failed') {
            setError(getClassroomFailureMessage(current.error));
            removeActiveJobEntry(jobId);
          }
          return;
        }

        setPhase('generating');

        await pollClassroomJob(
          jobId,
          (data) => {
            if (cancelled || abortController.signal.aborted) return;
            updateFromJob(data);
          },
          abortController.signal,
        );

        if (cancelled || abortController.signal.aborted) return;

        const final = await fetchClassroomJob(jobId, abortController.signal);
        if (cancelled || abortController.signal.aborted) return;
        if (!final) {
          setError('课堂生成任务不存在');
          return;
        }
        updateFromJob(final);

        if (final.status === 'awaiting_review') {
          setPhase('reviewing');
        } else if (final.done) {
          if (final.status === 'succeeded' && final.result) {
            setResult(final.result);
            setPhase('done');
          } else if (final.status === 'failed') {
            setError(getClassroomFailureMessage(final.error));
            removeActiveJobEntry(jobId);
          }
        }
      } catch (err) {
        if (cancelled || abortController.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        log.warn('Generation progress poll warning:', err);
        setError(err instanceof Error ? getClassroomFailureMessage(err.message) : '生成过程出错');
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [jobId, updateFromJob]);

  const handleApproveOutline = useCallback(async () => {
    if (!jobId) return;
    if (approveInFlightRef.current) return;
    approveInFlightRef.current = true;
    setApproving(true);

    const signal = abortRef.current?.signal;
    try {
      setPhase('generating_slides');
      const editedOutlines = outlines;
      setOutlines(undefined);

      try {
        localStorage.removeItem('requirementDraft');
        sessionStorage.removeItem('generationSession');
      } catch {
        /* ignore */
      }

      await approveClassroomOutline(jobId, editedOutlines);
      if (signal?.aborted) return;

      await pollClassroomJob(
        jobId,
        (data) => {
          if (signal?.aborted) return;
          updateFromJob(data);
        },
        signal ?? new AbortController().signal,
      );

      if (signal?.aborted) return;

      const final = await fetchClassroomJob(jobId, signal);
      if (signal?.aborted) return;
      if (!final) {
        setError('课堂生成任务不存在');
        return;
      }
      if (final.status === 'awaiting_review') {
        if (final.outlines) setOutlines(final.outlines);
        if (final.outlinesMeta) setOutlinesMeta(final.outlinesMeta);
        approveInFlightRef.current = false;
        setApproving(false);
        setPhase('reviewing');
        return;
      }
      if (final.result) {
        setResult(final.result);
        setPhase('done');
      } else if (final.status === 'failed') {
        setError(getClassroomFailureMessage(final.error));
        removeActiveJobEntry(jobId);
      }
    } catch (err) {
      if (signal?.aborted) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      approveInFlightRef.current = false;
      setApproving(false);
      log.warn('Approve outline warning:', err);
      setError(err instanceof Error ? getClassroomFailureMessage(err.message) : '继续生成失败');
    }
  }, [jobId, outlines, updateFromJob]);

  const handleCancel = useCallback(async () => {
    if (!jobId || cancelling) return;
    setCancelling(true);
    try {
      abortRef.current?.abort();
      await cancelClassroomJob(jobId);

      useTaskStore.getState().removeTask(jobId);
      removeActiveJobEntry(jobId);

      toast.info('课堂生成已取消');
    } catch (err) {
      log.error('Cancel job error:', err);
      toast.error('取消生成失败，请重试');
      setCancelling(false);
    }
  }, [jobId, cancelling]);

  const stepLabel = PHASE_LABELS[step] || step || '处理中';

  return {
    phase,
    step,
    progress,
    message,
    outlines,
    outlinesMeta,
    scenesGenerated,
    totalScenes,
    result,
    error,
    cancelling,
    approving,
    stepLabel,
    handleApproveOutline,
    handleCancel,
    setOutlines,
  };
}
