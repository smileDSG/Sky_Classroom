'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
// motion removed — using CSS animations for SSR compatibility
// Preview now shows PPTX screenshot only — SlideViewer removed
import { AvatarSpeechPlayer } from './avatar-speech-player';
import { AvatarSelector } from './avatar-selector';
import { CoverGallery, type CoverItem } from './cover-gallery';
import { SlideThumbnail } from './slide-thumbnail';
import { SlidePreviewGallery } from './slide-preview-gallery';
import { exportCourseToPPTX } from '@/lib/export/course-exporter';
import { AVATAR_CONFIGS } from '@/lib/slides/avatar-config';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { useTaskStore } from '@/lib/store/use-task-store';
import type { AvatarConfig } from '@/lib/slides/types';

const DIFFICULTIES = [
  { value: 'junior', label: '初中' },
  { value: 'senior', label: '高中' },
  { value: 'college', label: '大学' },
] as const;

export default function SlidesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Persistent state from Zustand store
  const setSlides = useSkyClassroomStore((s) => s.setSlides);
  const generationOptions = useSkyClassroomStore((s) => s.generationOptions);
  const setGenerationOptions = useSkyClassroomStore((s) => s.setGenerationOptions);
  const storeSelectedAvatarId = useSkyClassroomStore((s) => s.selectedAvatarId);
  const setSelectedAvatarId = useSkyClassroomStore((s) => s.setSelectedAvatar);

  // Defensive: localStorage may contain stale non-string values from old schema
  const topic = typeof generationOptions?.topic === 'string' ? generationOptions.topic : '';
  const difficulty = ['junior', 'senior', 'college'].includes(generationOptions?.difficulty as string)
    ? generationOptions.difficulty
    : 'senior';

  // Ephemeral UI state
  const [generating, setGenerating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarConfig>(
    AVATAR_CONFIGS.find((a) => a.id === storeSelectedAvatarId) || AVATAR_CONFIGS[0],
  );
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // ── Cover Gallery state ──
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverStage, setCoverStage] = useState<'idle' | 'analyzing' | 'designing' | 'rendering'>('idle');
  const [coverCovers, setCoverCovers] = useState<CoverItem[]>([]);
  const [showCoverGallery, setShowCoverGallery] = useState(false);
  const coverCacheRef = useRef<Map<string, CoverItem[]>>(new Map());
  // ── Legacy ──
  const [generatedPptx, setGeneratedPptx] = useState<{ url: string; fileName: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [previewId, setPreviewId] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [genStage, setGenStage] = useState<'idle' | 'thinking' | 'writing' | 'rendering' | 'done'>('idle');
  const [genProgress, setGenProgress] = useState(0);
  const [qaReport, setQaReport] = useState<{ totalScore: number; pass: boolean; issues: Array<{ pageNum: number; severity: string; type: string; layer: string; detail: string }> } | null>(null);
  const [showQaReport, setShowQaReport] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = useCallback((stage: 'thinking' | 'writing' | 'rendering') => {
    setGenStage(stage);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    let target = 0;
    let current = 0;
    let step = 0;
    let intervalMs = 500;
    if (stage === 'thinking') { current = 0; target = 8; step = (8 - 0) / 10; intervalMs = 300; }
    if (stage === 'writing') { current = 10; target = 90; step = (90 - 10) / 80; intervalMs = 600; }
    if (stage === 'rendering') { current = 92; target = 98; step = (98 - 92) / 12; intervalMs = 400; }
    setGenProgress(current);

    progressIntervalRef.current = setInterval(() => {
      setGenProgress((p) => {
        if (p >= target) {
          // 到达 target 后继续以极慢速度前进，避免"卡住"感
          if (stage === 'writing' && p < 95) {
            return Math.min(p + 0.3, 95);
          }
          if (stage === 'rendering' && p < 99) {
            return Math.min(p + 0.2, 99);
          }
          return p;
        }
        return Math.min(p + step, target);
      });
    }, intervalMs);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // ── Cover Gallery handlers ──
  const handleGenerateCovers = useCallback(async (overrideTopic?: string) => {
    const t = (overrideTopic ?? topic).trim();
    if (!t) return;

    // Check cache first
    const cacheKey = `${t}_${difficulty}`;
    const cached = coverCacheRef.current.get(cacheKey);
    if (cached) {
      setCoverCovers(cached);
      setShowCoverGallery(true);
      return;
    }

    setCoverLoading(true);
    setCoverStage('analyzing');

    try {
      const res = await fetch('/api/sky/slides/generate-covers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, difficulty }),
      });

      if (!res.ok) {
        setCoverLoading(false);
        setStatus('封面生成失败，请重试');
        setTimeout(() => setStatus(''), 3000);
        return;
      }

      const data = await res.json();
      if (data.success && data.covers) {
        coverCacheRef.current.set(cacheKey, data.covers);
        setCoverCovers(data.covers);
        setCoverLoading(false);
        setCoverStage('idle');
        setShowCoverGallery(true);
      } else {
        setCoverLoading(false);
        setStatus(`封面生成失败: ${data.error || '请重试'}`);
        setTimeout(() => setStatus(''), 3000);
      }
    } catch {
      setCoverLoading(false);
      setStatus('网络错误，请检查服务是否运行');
      setTimeout(() => setStatus(''), 3000);
    }
  }, [topic, difficulty]);

  const handleRefreshCovers = useCallback(async () => {
    const t = topic.trim();
    if (!t) return;
    setShowCoverGallery(false);
    // Clear cache for this topic
    const cacheKey = `${t}_${difficulty}`;
    coverCacheRef.current.delete(cacheKey);
    // Re-generate
    await handleGenerateCovers(t);
  }, [topic, difficulty, handleGenerateCovers]);

  const onCoverSelected = useCallback(async (cover: CoverItem) => {
    setShowCoverGallery(false);
    setGenerating(true);
    setGenStage('thinking');
    setGenProgress(0);

    const taskId = `ppt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const res = await fetch('/api/sky/slides/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          difficulty,
          designDNA: cover.designParams,
        }),
      });
      const data = await res.json();
      if (data.success && data.jobId) {
        const jobId = data.jobId;

        // Add to background task store
        useTaskStore.getState().addTask({
          id: jobId,
          type: 'slides',
          label: `PPT课件: ${topic.slice(0, 20)}${topic.length > 20 ? '...' : ''}`,
          status: 'running',
          progress: 0,
          phase: '正在初始化...',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          jobId,
        });

        // Start polling
        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/sky/slides/generate/status?jobId=${jobId}`);
            const statusData = await statusRes.json();
            if (statusData.success) {
              const job = statusData.data || statusData.job;
              setGenStage(job.stage as never);
              setGenProgress(job.progress || 0);
              setStatus(job.message || '');

              // Update background task
              useTaskStore.getState().updateTask(jobId, {
                progress: job.progress || 0,
                phase: job.message || job.stage || '',
              });

              if (job.stage === 'done') {
                clearInterval(poll);
                if (job.pptxUrl) {
                  setGeneratedPptx({ url: job.pptxUrl, fileName: job.fileName || '课件.pptx' });
                  setPreviewImages(job.previewImages || null);
                  if (job.qaReport) setQaReport(job.qaReport);
                  setStatus('');
                  setGenStage('done');
                  setGenProgress(100);

                  // Update background task as completed
                  useTaskStore.getState().updateTask(jobId, {
                    status: 'completed',
                    progress: 100,
                    phase: 'PPT生成完成',
                    result: {
                      pptxUrl: job.pptxUrl,
                      fileName: job.fileName || '课件.pptx',
                      previewImages: job.previewImages,
                      qaReport: job.qaReport,
                    },
                  });
                } else if (job.error) {
                  setStatus(`生成失败: ${job.error}`);
                  useTaskStore.getState().updateTask(jobId, {
                    status: 'failed',
                    error: job.error,
                  });
                }
                setGenerating(false);
              }
            }
          } catch {
            // Polling error, ignore
          }
        }, 2000);
      } else {
        setStatus(`生成请求失败: ${data.error || '请重试'}`);
        setGenerating(false);
      }
    } catch {
      setStatus('网络错误');
      setGenerating(false);
    }
  }, [topic, difficulty]);

  const handleGenerate = useCallback(async (overrideTopic?: string) => {
    handleGenerateCovers(overrideTopic);
  }, [handleGenerateCovers]);

  const handleDownloadGenerated = useCallback(() => {
    if (!generatedPptx) return;
    const a = document.createElement('a');
    a.href = generatedPptx.url;
    a.download = generatedPptx.fileName;
    a.click();
  }, [generatedPptx]);

  // ── Restore state from background task on mount ──
  useEffect(() => {
    const store = useTaskStore.getState();
    const tasks = Object.values(store.tasks).filter(
      (t) => t.type === 'slides' && t.status !== 'failed'
    );
    if (tasks.length === 0) return;
    const task = tasks[tasks.length - 1];

    if (task.status === 'running') {
      setGenerating(true);
      setGenProgress(task.progress || 0);
      setStatus(task.phase || '生成中...');
      // Resume polling if we have a jobId
      if (task.jobId) {
        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/sky/slides/generate/status?jobId=${task.jobId}`);
            const statusData = await statusRes.json();
            if (statusData.success) {
              const job = statusData.data || statusData.job;
              setGenStage(job.stage as never);
              setGenProgress(job.progress || 0);
              setStatus(job.message || '');

              useTaskStore.getState().updateTask(task.jobId!, {
                progress: job.progress || 0,
                phase: job.message || job.stage || '',
              });

              if (job.stage === 'done') {
                clearInterval(poll);
                if (job.pptxUrl) {
                  setGeneratedPptx({ url: job.pptxUrl, fileName: job.fileName || '课件.pptx' });
                  setPreviewImages(job.previewImages || null);
                  if (job.qaReport) setQaReport(job.qaReport);
                  setStatus('');
                  setGenStage('done');
                  setGenProgress(100);

                  useTaskStore.getState().updateTask(task.jobId!, {
                    status: 'completed',
                    progress: 100,
                    phase: 'PPT生成完成',
                    result: {
                      pptxUrl: job.pptxUrl,
                      fileName: job.fileName || '课件.pptx',
                      previewImages: job.previewImages,
                      qaReport: job.qaReport,
                    },
                  });
                } else if (job.error) {
                  setStatus(`生成失败: ${job.error}`);
                  useTaskStore.getState().updateTask(task.jobId!, {
                    status: 'failed',
                    error: job.error,
                  });
                }
                setGenerating(false);
              }
            }
          } catch {
            // Polling error, ignore
          }
        }, 2000);
      }
    } else if (task.status === 'completed' && task.result) {
      const result = task.result as { pptxUrl?: string; fileName?: string; previewImages?: string[]; qaReport?: unknown };
      if (result.pptxUrl) {
        setGeneratedPptx({ url: result.pptxUrl, fileName: result.fileName || '课件.pptx' });
        setPreviewImages(result.previewImages || null);
        if (result.qaReport) setQaReport(result.qaReport as never);
        setGenStage('done');
        setGenProgress(100);
      }
      store.removeTask(task.id);
    }
  }, []);

  // ── Cover loading stage animation ──
  useEffect(() => {
    if (!coverLoading) return;
    const stages: Array<'analyzing' | 'designing' | 'rendering'> = ['analyzing', 'designing', 'rendering'];
    let idx = 0;
    const timer = setInterval(() => {
      idx++;
      if (idx < stages.length) {
        setCoverStage(stages[idx]);
      } else {
        clearInterval(timer);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [coverLoading]);

  // Auto-trigger generation from URL ?topic=xxx
  useEffect(() => {
    const urlTopic = searchParams.get('topic');
    if (urlTopic && !autoTriggered && !generating) {
      setAutoTriggered(true);
      handleGenerate(urlTopic);
    }
  }, [searchParams, autoTriggered, generating, handleGenerate]);

  const totalPages = previewImages?.length ?? 0;
  const hasContent = !!previewImages?.length || !!generatedPptx;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setActiveIndex((i) => Math.max(0, i - 1));
      if (e.key === 'ArrowRight') setActiveIndex((i) => Math.min(totalPages - 1, i + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [totalPages]);



  return (
    <div className="flex h-[calc(100vh-4rem)] w-full flex-col overflow-hidden relative">

      <style jsx global>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <style jsx global>{`
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-left {
          animation: fadeInLeft 0.5s ease-out forwards;
        }
        .animate-fade-in-right {
          animation: fadeInRight 0.5s ease-out 0.2s forwards;
          opacity: 0;
        }
        .animate-fade-in-down {
          animation: fadeInDown 0.5s ease-out 0.1s forwards;
          opacity: 0;
        }
        .animate-fade-in-scale {
          animation: fadeInScale 0.5s ease-out forwards;
        }
      `}</style>

      {/* Top bar */}
      <header className="relative z-10 flex flex-shrink-0 items-center border-b border-slate-200/30 dark:border-gray-700/30 bg-white/60 dark:bg-gray-900/60 px-5 py-3 backdrop-blur-md">
        {/* Left: back + brand */}
        <div className="flex w-56 flex-shrink-0 items-center gap-3 animate-fade-in-left">
          <Link
            href="/sky"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 dark:text-gray-500 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-600 dark:hover:text-gray-200 hover:scale-105 active:scale-95"
            title="返回云端智囊"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="h-6 w-px bg-slate-200 dark:bg-gray-700" />
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg shadow-sky-500/25">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">PPT课件生成</span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-gray-500 -mt-0.5">AI 智能创作</span>
            </div>
          </div>
          {hasContent && (
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 dark:text-gray-500 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-600 dark:hover:text-gray-200 hover:scale-105 active:scale-95"
              title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
            >
              <svg
                className={`h-4 w-4 transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {/* Center: input + controls */}
        <div className="flex flex-1 items-center justify-center gap-3 px-4 animate-fade-in-down">
          <div className="relative w-full max-w-lg">
            <input
              value={topic}
              onChange={(e) => setGenerationOptions({ topic: e.target.value, difficulty })}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="输入教学主题，如：勾股定理、牛顿定律、细胞分裂…"
              className="w-full rounded-xl border border-slate-200/80 dark:border-gray-700/80 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-4 py-2.5 pl-10 text-sm text-slate-700 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:border-sky-400 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900 transition-all shadow-sm"
            />
            <svg
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          <div className="inline-flex flex-shrink-0 rounded-xl border border-slate-200/80 dark:border-gray-700/80 bg-white/60 dark:bg-gray-900/60 p-0.5 shadow-sm backdrop-blur-sm">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setGenerationOptions({ topic, difficulty: d.value })}
                className={`relative rounded-[10px] px-3.5 py-2 text-sm font-semibold transition-all duration-300 ${
                  d.value === difficulty
                    ? 'bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-md shadow-sky-200/50'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-800/60'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => handleGenerate()}
            disabled={generating || !topic.trim()}
            className="relative inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-sky-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0"
          >
            {generating && (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span className="relative">
              {generating ? '生成中...' : '生成课件'}
            </span>
          </button>
        </div>

        {/* Right: status */}
        <div className="flex w-56 flex-shrink-0 items-center justify-end gap-2 animate-fade-in-right">
          {status && (
            <span
              className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
                status.includes('失败') || status.includes('错误')
                  ? 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
                  : 'text-slate-500 bg-slate-50 dark:text-gray-400 dark:bg-gray-800'
              }`}
            >
              {status}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Left panel */}
        <aside
          className={`flex min-h-0 flex-shrink-0 flex-col overflow-hidden border-r border-slate-200/30 dark:border-gray-700/30 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md transition-all duration-300 ${
            sidebarOpen ? 'w-64' : 'w-0 border-r-0'
          }`}
        >
          {/* Avatar selector */}
          <div className="scrollbar-hide flex-shrink-0 overflow-y-auto px-4 pt-4 pb-2" style={{ maxHeight: '35%', overscrollBehavior: 'contain' }}>
            <div className="mb-2 flex items-center gap-2 px-1">
              <svg className="h-3.5 w-3.5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">讲解角色</span>
            </div>
            <AvatarSelector
              avatars={AVATAR_CONFIGS}
              selectedId={selectedAvatar.id}
              onSelect={(id) => {
                const a = AVATAR_CONFIGS.find((av) => av.id === id) || AVATAR_CONFIGS[0];
                setSelectedAvatar(a);
                setSelectedAvatarId(a.id);
              }}
            />
          </div>

          <div className="mx-4 h-px flex-shrink-0 bg-gradient-to-r from-transparent via-slate-200/60 dark:via-gray-700/60 to-transparent" />

          {/* Thumbnails */}
          <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3" style={{ overscrollBehavior: 'contain' }}>
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                幻灯片
              </span>
              {totalPages > 0 && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900/30 px-1.5 text-[10px] font-bold tabular-nums text-sky-600 dark:text-sky-400">
                  {totalPages}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {previewImages ? (
                previewImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    className={`group relative flex items-center gap-2.5 rounded-xl p-2 text-left transition-all duration-200 ${
                      i === activeIndex
                        ? 'bg-gradient-to-r from-sky-50 to-blue-50/50 dark:from-sky-900/20 dark:to-blue-900/10 ring-1 ring-sky-200/60 dark:ring-sky-800/40 shadow-sm'
                        : 'hover:bg-slate-50/80 dark:hover:bg-gray-800/80'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={img}
                        alt={`Thumb ${i + 1}`}
                        className="h-[40px] w-[72px] rounded-lg object-cover shadow-sm ring-1 ring-slate-200/50 dark:ring-gray-700/50"
                        draggable={false}
                      />
                      <span className={`absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shadow-sm transition-colors ${
                        i === activeIndex
                          ? 'bg-sky-500 text-white shadow-sky-200/50'
                          : 'bg-white dark:bg-gray-800 text-slate-500 dark:text-gray-400 ring-1 ring-slate-200 dark:ring-gray-600'
                      }`}>
                        {i + 1}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className={`text-[11px] font-semibold truncate ${
                        i === activeIndex ? 'text-sky-700 dark:text-sky-300' : 'text-slate-600 dark:text-gray-400'
                      }`}>
                        {i === 0 ? '封面' : i === previewImages.length - 1 ? '封底' : `第 ${i + 1} 页`}
                      </span>
                      {i === activeIndex && (
                        <span className="flex items-center gap-1 text-[10px] text-sky-500 dark:text-sky-400">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
                          </span>
                          当前查看
                        </span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <svg className="h-8 w-8 text-slate-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                  <p className="text-[11px] text-slate-400 dark:text-gray-500">生成后显示幻灯片</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Right: slide display */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1">
            {previewImages ? (
              <div className="flex h-full items-center justify-center bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm p-6">
                <img
                  src={previewImages[activeIndex]}
                  alt={`Slide ${activeIndex + 1}`}
                  className="max-h-full max-w-full rounded-xl shadow-2xl object-contain"
                  style={{ aspectRatio: '16/9' }}
                  draggable={false}
                />
              </div>
            ) : generating ? (
              <div className="flex h-full flex-col items-center justify-center bg-white/20 dark:bg-gray-900/20 backdrop-blur-sm gap-6">
                {/* Animated icon */}
                <div className="relative">
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-sky-100 dark:border-sky-900/30 border-t-sky-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="h-6 w-6 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-4 w-80">
                  <div className="flex flex-col items-center gap-1">
                    <p className="text-base font-semibold text-slate-700 dark:text-gray-200">
                      {genStage === 'thinking' ? '正在构思课件结构...' :
                       genStage === 'writing' ? '正在生成课件内容...' :
                       genStage === 'rendering' ? '正在渲染幻灯片...' : '正在初始化...'}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-gray-500">
                      {status || 'AI 正在为您创作精美课件'}
                    </p>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full space-y-2">
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 transition-all duration-500 ease-out"
                        style={{ width: `${genProgress || 5}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-slate-400 dark:text-gray-500">
                        {genStage === 'thinking' ? '分析主题' :
                         genStage === 'writing' ? '生成内容' :
                         genStage === 'rendering' ? '渲染幻灯片' : '准备中'}
                      </p>
                      <p className="text-[11px] font-medium text-sky-500 tabular-nums">{Math.round(genProgress || 5)}%</p>
                    </div>
                  </div>
                  {/* Tips */}
                  <p className="text-[11px] text-slate-400 dark:text-gray-500 text-center mt-2">
                    生成完成后将自动显示预览，您可以继续浏览其他页面
                  </p>
                </div>
              </div>
            ) : generatedPptx ? (
              <div className="flex h-full flex-col items-center justify-center bg-white/20 dark:bg-gray-900/20 backdrop-blur-sm gap-6 animate-fade-in-scale">
                {/* Success icon with animation */}
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/20">
                    <svg className="h-10 w-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <p className="text-lg font-bold text-slate-800 dark:text-gray-100">课件生成成功！</p>
                  <p className="text-sm text-slate-500 dark:text-gray-400">共 {totalPages} 页幻灯片已准备就绪</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadGenerated}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下载课件
                  </button>
                  <button
                    onClick={() => {
                      setGeneratedPptx(null);
                      setPreviewImages(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-gray-700 px-5 py-3 text-sm font-medium text-slate-600 dark:text-gray-300 transition-all hover:bg-slate-50 dark:hover:bg-gray-800 hover:scale-105 active:scale-95"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    生成新课件
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-white/10 dark:bg-gray-900/10 backdrop-blur-sm gap-6 animate-fade-in-scale">
                {/* Welcome icon */}
                <div className="relative">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-900/20 dark:to-blue-900/20 shadow-lg shadow-sky-200/30 dark:shadow-sky-900/10">
                    <svg className="h-10 w-10 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div className="absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-3 max-w-sm text-center">
                  <p className="text-lg font-bold text-slate-800 dark:text-gray-100">AI PPT课件生成器</p>
                  <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed">
                    输入教学主题，AI 将为您一键生成精美的PPT课件
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                    <span>快速生成</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <span>精美设计</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                    <span>多难度支持</span>
                  </div>
                </div>
              </div>
            )}
            <AvatarSpeechPlayer
              avatar={hasContent ? selectedAvatar : null}
              speech={null}
              activeSlideIndex={activeIndex}
              totalSlides={totalPages}
            />
          </div>

          {generatedPptx && (
            <footer className="flex flex-shrink-0 items-center justify-between border-t border-slate-200/50 dark:border-gray-700/50 bg-white/60 dark:bg-gray-900/60 px-6 py-2.5 backdrop-blur-xl">
              {previewImages && previewImages.length > 0 ? (
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                    disabled={activeIndex === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 dark:text-gray-400 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 dark:bg-gray-800 hover:text-slate-700 dark:text-gray-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:scale-100"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    上一页
                  </button>

                  <div className="flex flex-col items-center gap-1">
                    <span className="min-w-[4rem] text-center text-xs tabular-nums text-slate-400 dark:text-gray-500">
                      <span className="font-bold text-slate-700 dark:text-gray-200">{activeIndex + 1}</span>
                      <span className="mx-1 text-slate-300 dark:text-gray-600">/</span>
                      <span className="font-medium">{totalPages}</span>
                    </span>
                    {/* Progress bar */}
                    <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500"
                        style={{ width: `${((activeIndex + 1) / totalPages) * 100}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveIndex((i) => Math.min(totalPages - 1, i + 1))}
                    disabled={activeIndex === totalPages - 1}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 dark:text-gray-400 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 dark:bg-gray-800 hover:text-slate-700 dark:text-gray-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:scale-100"
                  >
                    下一页
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-gray-500">
                  <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>课件已生成</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                {topic.trim() && (
                  <>
                    <button
                      onClick={() => router.push(`/sky/cloud-mind/memory?topic=${encodeURIComponent(topic)}&content=${encodeURIComponent(`关于"${topic}"的核心知识点`)}`)}
                      className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-500 transition-all hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    >
                      生成记忆卡片
                    </button>
                    <button
                      onClick={() => router.push(`/sky/cloud-mind/quiz?topic=${encodeURIComponent(topic)}`)}
                      className="rounded-xl px-3 py-2 text-xs font-semibold text-amber-500 transition-all hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    >
                      生成练习题
                    </button>
                  </>
                )}
                {qaReport && (
                  <button
                    onClick={() => setShowQaReport(true)}
                    className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 dark:text-gray-400 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 dark:bg-gray-800 hover:text-slate-700 dark:text-gray-200 hover:scale-105 active:scale-95"
                  >
                    📋 查看质检报告
                  </button>
                )}
                <button
                  onClick={() => {
                    setGeneratedPptx(null);
                    handleGenerate();
                  }}
                  disabled={generating}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 dark:text-gray-400 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 dark:bg-gray-800 hover:text-slate-700 dark:text-gray-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  重新生成
                </button>
                {generatedPptx && (
                  <button
                    onClick={handleDownloadGenerated}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下载课件
                  </button>
                )}
              </div>
            </footer>
          )}
        </main>
      </div>

      {showPreview && previewImages && (
        <SlidePreviewGallery
          slideImages={previewImages}
          initialIndex={activeIndex}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* QA Report Modal */}
      {showQaReport && qaReport && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowQaReport(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/80 dark:border-gray-700/80">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-gray-100">质检报告</h2>
                <p className="text-xs text-slate-400 dark:text-gray-500">
                  总分: {qaReport.totalScore}/100 {qaReport.pass ? '✅ 通过' : '⚠️ 未通过'}
                </p>
              </div>
              <button onClick={() => setShowQaReport(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {qaReport.issues.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-gray-400 text-center py-4">无问题，课件质量良好</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {qaReport.issues.map((issue, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveIndex(issue.pageNum - 1);
                        setShowQaReport(false);
                      }}
                      className={`flex items-start gap-2 rounded-lg p-2.5 text-left text-xs transition-all hover:bg-slate-50 dark:hover:bg-gray-800 ${
                        issue.severity === 'high' ? 'bg-red-50 dark:bg-red-900/20' :
                        issue.severity === 'medium' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-gray-800/50'
                      }`}
                    >
                      <span className="mt-0.5 flex-shrink-0">
                        {issue.severity === 'high' ? '❌' : issue.severity === 'medium' ? '⚠️' : 'ℹ️'}
                      </span>
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-700 dark:text-gray-200">
                          第 {issue.pageNum} 页 — {issue.type}
                        </span>
                        <p className="text-slate-500 dark:text-gray-400 mt-0.5">{issue.detail}</p>
                      </div>
                      <svg className="h-3 w-3 flex-shrink-0 mt-1 text-slate-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cover Gallery */}
      {showCoverGallery && (
        <CoverGallery
          open={showCoverGallery}
          topic={topic}
          covers={coverCovers}
          showRefresh={true}
          onSelect={onCoverSelected}
          onRefresh={handleRefreshCovers}
          onClose={() => setShowCoverGallery(false)}
        />
      )}

      {/* Cover Loading Overlay */}
      {coverLoading && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-slate-950/30 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-2xl max-w-sm w-full mx-4">
            {/* Stage indicator */}
            <div className="flex items-center gap-2 w-full">
              {[
                { key: 'analyzing', label: '分析主题' },
                { key: 'designing', label: '设计风格' },
                { key: 'rendering', label: '渲染预览' },
              ].map((s, i) => (
                <div key={s.key} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center justify-center h-3 w-3 rounded-full transition-all duration-500 ${
                    coverStage === s.key ? 'bg-sky-500 animate-pulse' :
                    (coverStage === 'rendering' || (coverStage === 'designing' && i < 2) || (coverStage === 'analyzing' && i < 1))
                      ? 'bg-sky-500' : 'bg-slate-200 dark:bg-gray-700'
                  }`} />
                  <span className={`text-[10px] font-medium whitespace-nowrap ${
                    coverStage === s.key ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400 dark:text-gray-500'
                  }`}>{s.label}</span>
                  {i < 2 && <div className="flex-1 h-px bg-slate-200 dark:bg-gray-700" />}
                </div>
              ))}
            </div>

            {/* Message */}
            <p className="text-sm font-medium text-slate-600 dark:text-gray-300 text-center">
              {coverStage === 'analyzing' && `AI 正在分析"${topic}"的学科特点…`}
              {coverStage === 'designing' && '正在渲染 12 种封面风格…'}
              {coverStage === 'rendering' && '即将呈现封面画廊…'}
            </p>

            {/* Spinner */}
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 dark:border-gray-700 border-t-sky-500" />
          </div>
        </div>
      )}
    </div>
  );
}
