'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
import type { AvatarConfig } from '@/lib/slides/types';
import { SkyBackground } from '@/components/sky/home/sky-background';

const DIFFICULTIES = [
  { value: 'junior', label: '初中' },
  { value: 'senior', label: '高中' },
  { value: 'college', label: '大学' },
] as const;

export default function SlidesPage() {
  const searchParams = useSearchParams();

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
        // Start polling
        const jobId = data.jobId;
        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/sky/slides/generate/status?jobId=${jobId}`);
            const statusData = await statusRes.json();
            if (statusData.success) {
              const job = statusData.data || statusData.job;
              setGenStage(job.stage as never);
              setGenProgress(job.progress || 0);
              setStatus(job.message || '');

              if (job.stage === 'done') {
                clearInterval(poll);
                if (job.pptxUrl) {
                  setGeneratedPptx({ url: job.pptxUrl, fileName: job.fileName || '课件.pptx' });
                  setPreviewImages(job.previewImages || null);
                  if (job.qaReport) setQaReport(job.qaReport);
                  setStatus('');
                  setGenStage('done');
                  setGenProgress(100);
                } else if (job.error) {
                  setStatus(`生成失败: ${job.error}`);
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
    <div className="flex h-screen w-full flex-col overflow-hidden relative">
      <SkyBackground />

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
      <header className="relative z-10 flex flex-shrink-0 items-center border-b border-slate-200/50 dark:border-gray-700/50 bg-white/70 dark:bg-gray-900/70 px-6 py-3 backdrop-blur-xl">
        {/* Left: back + brand */}
        <div className="flex w-48 flex-shrink-0 items-center gap-2 animate-fade-in-left">
          <Link
            href="/sky"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-gray-500 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-600 dark:hover:text-gray-200 hover:scale-105 active:scale-95"
            title="返回首页"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg shadow-sky-500/25">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent tracking-tight">天空课堂</span>
            <span className="text-[10px] font-medium text-slate-400 dark:text-gray-500 -mt-0.5">AI 互动课件</span>
          </div>
          {hasContent && (
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="ml-1 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-gray-500 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-600 dark:hover:text-gray-200 hover:scale-105 active:scale-95"
              title={sidebarOpen ? '收起讲解栏' : '展开讲解栏'}
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
        <div className="flex flex-1 items-center justify-center gap-3 animate-fade-in-down">
          <div className="relative w-full max-w-md">
            <input
              value={topic}
              onChange={(e) => setGenerationOptions({ topic: e.target.value, difficulty })}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="输入教学主题，如：勾股定理、牛顿定律…"
              className="w-full rounded-xl border border-slate-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-4 py-2.5 pl-10 text-sm text-slate-700 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500 dark:text-gray-500 focus:border-sky-400 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900 transition-all shadow-sm"
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
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-800/60 dark:bg-gray-900/60'
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
              {generating ? '生成中' : '生成幻灯片'}
              {!generating && (
                <span className="absolute -right-1 -top-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Right: status + template */}
        <div className="flex w-48 flex-shrink-0 items-center justify-end gap-2 animate-fade-in-right">
          {status && (
            <span
              className={`text-xs font-medium ${
                status.includes('失败') || status.includes('错误')
                  ? 'text-red-500'
                  : 'text-slate-500 dark:text-gray-400'
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
          className={`flex min-h-0 flex-shrink-0 flex-col overflow-hidden border-r border-slate-200/50 dark:border-gray-700/50 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl transition-all duration-300 ${
            sidebarOpen ? 'w-64' : 'w-0 border-r-0'
          }`}
        >
          {/* Avatar selector */}
          <div className="scrollbar-hide flex-shrink-0 overflow-y-auto px-4 pt-4" style={{ maxHeight: '35%', overscrollBehavior: 'contain' }}>
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
          <div className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3" style={{ overscrollBehavior: 'contain' }}>
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                幻灯片
              </span>
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800 px-1.5 text-[10px] font-bold tabular-nums text-slate-500 dark:text-gray-400">
                {totalPages}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {previewImages ? (
                previewImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    className={`group relative flex items-center gap-3 rounded-xl p-2 text-left transition-all duration-300 ${
                      i === activeIndex
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-blue-900/30 dark:to-indigo-900/20 ring-1 ring-blue-200/60 dark:ring-blue-800/40 shadow-sm shadow-blue-100/50 dark:shadow-blue-900/20'
                        : 'hover:bg-slate-50/80 dark:hover:bg-gray-800/80'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <img
                        src={img}
                        alt={`Thumb ${i + 1}`}
                        className="h-[45px] w-[80px] rounded-lg object-cover shadow-sm"
                        draggable={false}
                      />
                      <span className={`absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold shadow-sm ${
                        i === activeIndex
                          ? 'bg-sky-500 text-white shadow-sky-200'
                          : 'bg-white dark:bg-gray-800 text-slate-400 dark:text-gray-500 shadow-sm ring-1 ring-slate-200 dark:ring-gray-600'
                      }`}>
                        {i + 1}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <span
                        className={`text-[11px] font-semibold ${
                          i === activeIndex ? 'text-sky-700 dark:text-sky-300' : 'text-slate-500 dark:text-gray-400'
                        }`}
                      >
                        {i === 0 ? '封面' : i === previewImages.length - 1 ? '封底' : `第 ${i + 1} 页`}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-gray-500">
                        {i === activeIndex ? (
                          <span className="flex items-center gap-1 text-sky-500 dark:text-sky-400">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-500" />
                            </span>
                            当前
                          </span>
                        ) : (
                          ''
                        )}
                      </span>
                    </div>
                  </button>
                ))
              ) : null}
            </div>
          </div>
        </aside>

        {/* Right: slide display */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1">
            {previewImages ? (
              <div className="flex h-full items-center justify-center bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm p-6">
                <img
                  src={previewImages[activeIndex]}
                  alt={`Slide ${activeIndex + 1}`}
                  className="max-h-full max-w-full rounded-xl shadow-2xl object-contain"
                  style={{ aspectRatio: '16/9' }}
                  draggable={false}
                />
              </div>
            ) : generating ? (
              <div className="flex h-full flex-col items-center justify-center bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm gap-5">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 dark:border-gray-700 border-t-sky-500" />
                <div className="flex flex-col items-center gap-3 w-80">
                  <p className="text-sm font-medium text-slate-600 dark:text-gray-300 text-center">
                    {status || '正在初始化...'}
                  </p>
                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500 ease-out"
                      style={{ width: `${genProgress || 5}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-gray-500 tabular-nums">{Math.round(genProgress || 5)}%</p>
                </div>
              </div>
            ) : generatedPptx ? (
              <div className="flex h-full flex-col items-center justify-center bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm gap-4 animate-fade-in-scale">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 shadow-sm">
                  <svg className="h-8 w-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">课件生成成功</p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">文件已自动下载到本地</p>
                </div>
                <button
                  onClick={handleDownloadGenerated}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  重新下载课件
                </button>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm gap-3 animate-fade-in-scale">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/60 dark:bg-gray-900/60 shadow-sm">
                  <svg className="h-8 w-8 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500 dark:text-gray-400">输入主题，点击生成课件</p>
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
