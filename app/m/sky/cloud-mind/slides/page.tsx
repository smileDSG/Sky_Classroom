'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MobileSkyShell } from '@/components/mobile/shell/mobile-sky-shell';
import { MobileSlidesForm } from '@/components/mobile/slides/mobile-slides-form';
import { MobileSlidesGenerating } from '@/components/mobile/slides/mobile-slides-generating';
import { MobileSlidesPreview } from '@/components/mobile/slides/mobile-slides-preview';
import { AlertTriangle } from 'lucide-react';
import type { DesignDNA } from '@/lib/slides/agent/design-dna';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ERRORS = 5;

const STAGE_PROGRESS_FALLBACK: Record<string, number> = {
  planning: 15,
  sections_generating: 50,
  pages_designing: 85,
  qa_reviewing: 95,
  repairing: 98,
  merging: 99,
  done: 100,
};

export default function MobileSlidesPage() {
  const router = useRouter();

  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'junior' | 'senior' | 'college'>('senior');

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [generatedPptx, setGeneratedPptx] = useState<{ url: string; fileName: string } | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearPoll();
    setGenerating(false);
    setProgress(0);
    setStatus('');
    setError(null);
    setPreviewImages(null);
    setGeneratedPptx(null);
  }, [clearPoll]);

  const resolveProgress = useCallback((stage: string, serverProgress: number) => {
    const fallback = STAGE_PROGRESS_FALLBACK[stage] ?? 50;
    if (serverProgress > 0) return Math.max(serverProgress, fallback * 0.8);
    return fallback;
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      clearPoll();
      let pollErrors = 0;

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/sky/slides/generate/status?jobId=${jobId}`);
          if (res.status === 401) {
            clearPoll();
            setGenerating(false);
            setStatus('登录已过期，请重新登录');
            router.refresh();
            return;
          }
          if (res.status === 404) {
            clearPoll();
            setGenerating(false);
            setError('生成任务已过期，请重新生成');
            return;
          }

          const data = (await res.json()) as {
            success?: boolean;
            job?: Record<string, unknown>;
            data?: Record<string, unknown>;
          };
          if (!data.success) {
            pollErrors++;
            if (pollErrors >= MAX_POLL_ERRORS) {
              clearPoll();
              setGenerating(false);
              setError('状态查询失败，请刷新页面后重试');
            }
            return;
          }

          pollErrors = 0;
          const job = data.job || data.data || {};
          const stage = (job.stage as string) || 'planning';
          const jobProgress = (job.progress as number) || 0;
          const message = (job.message as string) || '';

          setProgress(resolveProgress(stage, jobProgress));
          setStatus(message);

          if (stage === 'done') {
            clearPoll();
            setGenerating(false);
            const pptxUrl = job.pptxUrl as string | undefined;
            const fileName = (job.fileName as string) || '课件.pptx';
            const images = job.previewImages as string[] | undefined;

            if (pptxUrl) {
              setGeneratedPptx({ url: pptxUrl, fileName });
              setPreviewImages(images || null);
              setProgress(100);
              setStatus('');
            } else {
              const errMsg = (job.error as string) || '生成失败';
              setError(`生成失败: ${errMsg}`);
            }
          }
        } catch {
          pollErrors++;
          if (pollErrors >= MAX_POLL_ERRORS) {
            clearPoll();
            setGenerating(false);
            setError('状态查询失败，请检查网络');
          }
        }
      }, POLL_INTERVAL_MS);
    },
    [clearPoll, router, resolveProgress]
  );

  const handleGenerate = useCallback(async () => {
    const t = topic.trim();
    if (!t) return;

    reset();
    setGenerating(true);
    setStatus('AI 正在分析主题风格…');

    try {
      const suggestRes = await fetch('/api/sky/slides/suggest-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, difficulty }),
      });

      if (suggestRes.status === 401) {
        setGenerating(false);
        setStatus('登录已过期，请重新登录');
        router.refresh();
        return;
      }

      const suggestData = (await suggestRes.json()) as {
        success?: boolean;
        cover?: { designDNA?: DesignDNA };
        error?: string;
      };

      if (!suggestRes.ok || !suggestData.success || !suggestData.cover?.designDNA) {
        const serverError = suggestData.error || '风格推荐失败';
        setGenerating(false);
        setError(`推荐失败: ${serverError}`);
        return;
      }

      const designDNA = suggestData.cover.designDNA;
      setProgress(10);
      setStatus('正在启动生成任务…');

      const generateRes = await fetch('/api/sky/slides/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, difficulty, designDNA }),
      });

      if (generateRes.status === 401) {
        setGenerating(false);
        setStatus('登录已过期，请重新登录');
        router.refresh();
        return;
      }

      const generateData = (await generateRes.json()) as {
        success?: boolean;
        jobId?: string;
        error?: string;
      };

      if (!generateRes.ok || !generateData.success || !generateData.jobId) {
        const serverError = generateData.error || '生成请求失败';
        setGenerating(false);
        setError(`生成失败: ${serverError}`);
        return;
      }

      setProgress(15);
      startPolling(generateData.jobId);
    } catch {
      setGenerating(false);
      setError('网络错误，请检查服务是否运行');
    }
  }, [topic, difficulty, reset, router, startPolling]);

  const handleDownload = useCallback(() => {
    if (!generatedPptx) return;
    const a = document.createElement('a');
    a.href = generatedPptx.url;
    a.download = generatedPptx.fileName;
    a.click();
  }, [generatedPptx]);

  const handleRegenerate = useCallback(() => {
    reset();
  }, [reset]);

  useEffect(() => {
    return () => {
      clearPoll();
    };
  }, [clearPoll]);

  if (error) {
    return (
      <MobileSkyShell backHref="/m/sky/cloud-mind">
        <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-400" />
          <p className="mt-4 text-sm text-slate-300">{error}</p>
          <button
            type="button"
            onClick={handleRegenerate}
            className="mt-6 rounded-2xl bg-sky-500 px-6 py-2.5 text-sm font-bold text-white"
          >
            重试
          </button>
        </div>
      </MobileSkyShell>
    );
  }

  return (
    <MobileSkyShell backHref="/m/sky/cloud-mind">
      <div className="flex min-h-[calc(100dvh-7rem)] flex-col">
        {generating ? (
          <MobileSlidesGenerating progress={progress} status={status} />
        ) : previewImages && generatedPptx ? (
          <MobileSlidesPreview
            images={previewImages}
            fileName={generatedPptx.fileName}
            onDownload={handleDownload}
            onRegenerate={handleRegenerate}
          />
        ) : (
          <MobileSlidesForm
            topic={topic}
            difficulty={difficulty}
            generating={generating}
            onTopicChange={setTopic}
            onDifficultyChange={setDifficulty}
            onGenerate={handleGenerate}
          />
        )}
      </div>
    </MobileSkyShell>
  );
}
