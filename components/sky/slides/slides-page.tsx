'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Sparkles,
  Presentation,
  Wand2,
  Download,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Image as ImageIcon,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AvatarSpeechPlayer } from './avatar-speech-player';
import { AvatarSelector } from './avatar-selector';
import { CoverGallery, type CoverItem } from './cover-gallery';
import { SmartCoverView } from './smart-cover-view';
import { useCoverDraft } from '@/lib/slides/hooks/use-cover-draft';
import { SlideThumbnail } from './slide-thumbnail';
import { SlidePreviewGallery } from './slide-preview-gallery';
import { exportCourseToPPTX } from '@/lib/export/course-exporter';
import { AVATAR_CONFIGS } from '@/lib/slides/avatar-config';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { useTaskStore } from '@/lib/store/use-task-store';
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
  const difficulty = ['junior', 'senior', 'college'].includes(
    generationOptions?.difficulty as string,
  )
    ? generationOptions.difficulty!
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
  const [coverStage, setCoverStage] = useState<'idle' | 'analyzing' | 'designing' | 'rendering'>(
    'idle',
  );
  const [coverCovers, setCoverCovers] = useState<CoverItem[]>([]);
  const [showCoverGallery, setShowCoverGallery] = useState(false);
  const coverCacheRef = useRef<Map<string, CoverItem[]>>(new Map());
  // ── Smart Cover View state ──
  const [showSmartCover, setShowSmartCover] = useState(false);
  const [showStyleLab, setShowStyleLab] = useState(false);
  const [suggestProgress, setSuggestProgress] = useState(0);
  const [suggestStatus, setSuggestStatus] = useState('');
  const {
    draftDNA,
    isSuggesting,
    startSuggesting,
    applySuggestion,
    updatePalette,
    updateLayout,
    updateFont,
    updateDensity,
    confirm,
  } = useCoverDraft();
  // ── Legacy ──
  const [generatedPptx, setGeneratedPptx] = useState<{ url: string; fileName: string } | null>(
    null,
  );
  const [previewing, setPreviewing] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [previewId, setPreviewId] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [genStage, setGenStage] = useState<
    | 'idle'
    | 'planning'
    | 'sections_generating'
    | 'pages_designing'
    | 'qa_reviewing'
    | 'repairing'
    | 'merging'
    | 'done'
  >('idle');
  const [genProgress, setGenProgress] = useState(0);
  const activeJobId = useSkyClassroomStore((s) => s.activeJobId);
  const setActiveJobId = useSkyClassroomStore((s) => s.setActiveJobId);
  const [qaReport, setQaReport] = useState<{
    totalScore: number;
    pass: boolean;
    issues: Array<{
      pageNum: number;
      severity: string;
      type: string;
      layer: string;
      detail: string;
    }>;
  } | null>(null);
  const [showQaReport, setShowQaReport] = useState(false);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = useCallback(
    (stage: 'planning' | 'sections_generating' | 'pages_designing') => {
      setGenStage(stage);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      let target = 0;
      let current = 0;
      let step = 0;
      let intervalMs = 500;
      if (stage === 'planning') {
        current = 0;
        target = 8;
        step = (8 - 0) / 10;
        intervalMs = 300;
      }
      if (stage === 'sections_generating') {
        current = 10;
        target = 90;
        step = (90 - 10) / 80;
        intervalMs = 600;
      }
      if (stage === 'pages_designing') {
        current = 92;
        target = 98;
        step = (98 - 92) / 12;
        intervalMs = 400;
      }
      setGenProgress(current);

      progressIntervalRef.current = setInterval(() => {
        setGenProgress((p) => {
          if (p >= target) {
            // 到达 target 后继续以极慢速度前进，避免"卡住"感
            if (stage === 'sections_generating' && p < 95) {
              return Math.min(p + 0.3, 95);
            }
            if (stage === 'pages_designing' && p < 99) {
              return Math.min(p + 0.2, 99);
            }
            return p;
          }
          return Math.min(p + step, target);
        });
      }, intervalMs);
    },
    [],
  );

  const stopProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // ── Cover Gallery handlers ──
  const handleGenerateCovers = useCallback(
    async (overrideTopic?: string) => {
      const t = (overrideTopic ?? topic).trim();
      if (!t) return;

      // Prevent duplicate requests
      if (coverLoading) return;

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
    },
    [topic, difficulty],
  );

  const handleRefreshCovers = useCallback(async () => {
    const t = topic.trim();
    if (!t || coverLoading) return;
    setShowCoverGallery(false);
    // Clear cache for this topic
    const cacheKey = `${t}_${difficulty}`;
    coverCacheRef.current.delete(cacheKey);
    // Re-generate
    await handleGenerateCovers(t);
  }, [topic, difficulty, coverLoading, handleGenerateCovers]);

  const onCoverSelected = useCallback(
    async (cover: CoverItem) => {
      setShowCoverGallery(false);
      setGenerating(true);
      setGenStage('planning');
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
          // Persist jobId so user can resume after navigation
          setActiveJobId(data.jobId);
          // Start polling
          const jobId = data.jobId;
          let pollErrors = 0;
          const MAX_POLL_ERRORS = 5;
          const poll = setInterval(async () => {
            try {
              const statusRes = await fetch(`/api/sky/slides/generate/status?jobId=${jobId}`);
              const statusData = await statusRes.json();
              if (statusData.success) {
                pollErrors = 0;
                const job = statusData.data || statusData.job;
                setGenStage(job.stage);
                setGenProgress(job.progress || 0);
                setStatus(job.message || '');

                if (job.stage === 'done') {
                  clearInterval(poll);
                  setActiveJobId(null);
                  if (job.pptxUrl) {
                    setGeneratedPptx({ url: job.pptxUrl, fileName: job.fileName || '课件.pptx' });
                    setPreviewImages(job.previewImages || null);
                    if (job.qaReport) setQaReport(job.qaReport);
                    setStatus('');
                    setGenStage('done');
                    setGenProgress(100);
                  } else if (job.error) {
                    setStatus(`生成失败: ${job.error}`);
                    setActiveJobId(null);
                  }
                  setGenerating(false);
                }
              } else if (statusRes.status === 404) {
                clearInterval(poll);
                setActiveJobId(null);
                setGenerating(false);
                setStatus('生成任务已过期，请重新生成');
              }
            } catch {
              pollErrors++;
              if (pollErrors >= MAX_POLL_ERRORS) {
                clearInterval(poll);
                setActiveJobId(null);
                setGenerating(false);
                setStatus('状态查询失败，请检查网络或刷新页面后重试');
              }
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
    },
    [topic, difficulty],
  );

  // ── Smart Cover handlers ──
  const handleSuggestCover = useCallback(
    async (overrideTopic?: string) => {
      const t = (overrideTopic ?? topic).trim();
      if (!t) return;

      startSuggesting();
      setShowSmartCover(true);
      setShowStyleLab(false);
      setSuggestProgress(0);
      setSuggestStatus('AI 正在分析主题风格…');

      const progressInterval = setInterval(() => {
        setSuggestProgress((p) => {
          if (p >= 85) return p;
          return p + Math.random() * 3 + 1;
        });
      }, 300);

      try {
        const res = await fetch('/api/sky/slides/suggest-cover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: t, difficulty }),
        });

        clearInterval(progressInterval);

        if (!res.ok) {
          setSuggestStatus('推荐失败，请重试');
          setSuggestProgress(0);
          return;
        }

        const data = await res.json();
        if (data.success && data.cover) {
          applySuggestion(data.cover.pngUrl, data.cover.designDNA);
          setSuggestProgress(100);
          setSuggestStatus('');
        } else {
          setSuggestStatus(`推荐失败: ${data.error || '请重试'}`);
          setSuggestProgress(0);
        }
      } catch {
        clearInterval(progressInterval);
        setSuggestStatus('网络错误，请检查服务是否运行');
        setSuggestProgress(0);
      }
    },
    [topic, difficulty, startSuggesting, applySuggestion],
  );

  const handleConfirmSmartCover = useCallback(() => {
    const finalDNA = confirm();
    if (!finalDNA) return;

    setShowSmartCover(false);
    setShowStyleLab(false);
    setGenerating(true);
    setGenStage('planning');
    setGenProgress(0);

    fetch('/api/sky/slides/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        difficulty,
        designDNA: finalDNA,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.jobId) {
          setActiveJobId(data.jobId);
          const jobId = data.jobId;
          let pollErrors = 0;
          const MAX_POLL_ERRORS = 5;
          const poll = setInterval(async () => {
            try {
              const statusRes = await fetch(`/api/sky/slides/generate/status?jobId=${jobId}`);
              const statusData = await statusRes.json();
              if (statusData.success) {
                pollErrors = 0;
                const job = statusData.data || statusData.job;
                setGenStage(job.stage);
                setGenProgress(job.progress || 0);
                setStatus(job.message || '');
                if (job.stage === 'done') {
                  clearInterval(poll);
                  setActiveJobId(null);
                  if (job.pptxUrl) {
                    setGeneratedPptx({ url: job.pptxUrl, fileName: job.fileName || '课件.pptx' });
                    setPreviewImages(job.previewImages || null);
                    if (job.qaReport) setQaReport(job.qaReport);
                    setStatus('');
                    setGenStage('done');
                    setGenProgress(100);
                  } else if (job.error) {
                    setStatus(`生成失败: ${job.error}`);
                    setActiveJobId(null);
                  }
                  setGenerating(false);
                }
              } else if (statusRes.status === 404) {
                clearInterval(poll);
                setActiveJobId(null);
                setGenerating(false);
                setStatus('生成任务已过期，请重新生成');
              }
            } catch {
              pollErrors++;
              if (pollErrors >= MAX_POLL_ERRORS) {
                clearInterval(poll);
                setActiveJobId(null);
                setGenerating(false);
                setStatus('状态查询失败，请检查网络或刷新页面后重试');
              }
            }
          }, 2000);
        } else {
          setStatus(`生成请求失败: ${data.error || '请重试'}`);
          setGenerating(false);
        }
      })
      .catch(() => {
        setStatus('网络错误');
        setGenerating(false);
      });
  }, [topic, difficulty, confirm, setActiveJobId]);

  const handleGenerate = useCallback(
    async (overrideTopic?: string) => {
      handleSuggestCover(overrideTopic);
    },
    [handleSuggestCover],
  );

  const handleDownloadGenerated = useCallback(() => {
    if (!generatedPptx) return;
    const a = document.createElement('a');
    a.href = generatedPptx.url;
    a.download = generatedPptx.fileName;
    a.click();
  }, [generatedPptx]);

  const handleReset = useCallback(() => {
    setGeneratedPptx(null);
    setPreviewImages(null);
    setGenStage('idle');
    setGenProgress(0);
    setStatus('');
    setQaReport(null);
  }, []);

  // ── Restore state from background task on mount ──
  useEffect(() => {
    const store = useTaskStore.getState();
    const tasks = Object.values(store.tasks).filter(
      (t) => t.type === 'slides' && t.status !== 'failed',
    );
    if (tasks.length === 0) return;
    const task = tasks[tasks.length - 1];

    if (task.status === 'running') {
      setGenerating(true);
      setGenProgress(task.progress || 0);
      setStatus(task.phase || '生成中...');
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
      const result = task.result as {
        pptxUrl?: string;
        fileName?: string;
        previewImages?: string[];
        qaReport?: unknown;
      };
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
    const stages: Array<'analyzing' | 'designing' | 'rendering'> = [
      'analyzing',
      'designing',
      'rendering',
    ];
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

  // Auto-resume job polling on mount (survives navigation)
  useEffect(() => {
    if (!activeJobId || generating) return;
    setGenerating(true);
    setGenStage('planning');
    setGenProgress(5);
    let pollErrors = 0;
    const MAX_POLL_ERRORS = 5;
    const poll = setInterval(async () => {
      try {
        const statusRes = await fetch(`/api/sky/slides/generate/status?jobId=${activeJobId}`);
        const statusData = await statusRes.json();
        if (statusData.success) {
          pollErrors = 0;
          const job = statusData.data || statusData.job;
          if (!job) return;
          setGenStage(job.stage);
          setGenProgress(job.progress || 0);
          setStatus(job.message || '');
          if (job.stage === 'done') {
            clearInterval(poll);
            setActiveJobId(null);
            if (job.pptxUrl) {
              setGeneratedPptx({ url: job.pptxUrl, fileName: job.fileName || '课件.pptx' });
              setPreviewImages(job.previewImages || null);
              if (job.qaReport) setQaReport(job.qaReport);
              setStatus('');
              setGenStage('done');
              setGenProgress(100);
            } else if (job.error) {
              setStatus(`生成失败: ${job.error}`);
              setActiveJobId(null);
            }
            setGenerating(false);
          }
        } else if (statusRes.status === 404) {
          // Job expired, stop polling
          clearInterval(poll);
          setActiveJobId(null);
          setGenerating(false);
          setStatus('生成任务已过期，请重新生成');
        }
      } catch {
        pollErrors++;
        if (pollErrors >= MAX_POLL_ERRORS) {
          clearInterval(poll);
          setActiveJobId(null);
          setGenerating(false);
          setStatus('状态查询失败，请检查网络或刷新页面后重试');
        }
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [activeJobId]);

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

      {/* Top bar */}
      <header className="relative z-10 flex flex-shrink-0 items-center border-b border-slate-200/50 dark:border-gray-700/50 bg-white/70 dark:bg-gray-900/70 px-6 py-3 backdrop-blur-2xl">
        <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-sky-300/30 dark:via-sky-500/20 to-transparent" />
        {/* Left: back + brand */}
        <div className="flex w-48 flex-shrink-0 items-center gap-2 animate-fade-in-left">
          <Link
            href="/sky"
            className="group flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-gray-500 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-600 dark:hover:text-gray-200 hover:scale-105 active:scale-95"
            title="返回首页"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="relative">
            {/* Breathing glow behind icon */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 animate-soft-pulse blur-md" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-lg shadow-sky-500/25">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold bg-gradient-to-r from-sky-500 via-blue-500 to-sky-500 bg-[length:200%_100%] bg-clip-text text-transparent tracking-tight animate-gradient-x">
              天空课堂
            </span>
            <span className="text-[10px] font-medium text-slate-400 dark:text-gray-500 -mt-0.5">
              AI 互动课件
            </span>
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Center: input + controls */}
        <div className="flex flex-1 items-center justify-center gap-3 animate-fade-in-down">
          <div className="relative w-full max-w-md group">
            <input
              value={topic}
              onChange={(e) => setGenerationOptions({ topic: e.target.value, difficulty })}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="输入教学主题，如：勾股定理、牛顿定律…"
              className="w-full rounded-xl border border-slate-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-4 py-2.5 pl-10 text-sm text-slate-700 dark:text-gray-200 placeholder:text-slate-400 dark:placeholder:text-gray-500 focus:border-sky-400 focus:bg-white dark:focus:bg-gray-800 focus:outline-none focus:ring-[3px] focus:ring-sky-100/80 dark:focus:ring-sky-900/40 transition-all duration-300 shadow-sm group-hover:shadow-md group-hover:border-slate-300/80 dark:group-hover:border-gray-600/80"
            />
            <svg
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-gray-500 transition-colors duration-300 group-focus-within:text-sky-500"
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
            {/* Focus glow ring */}
            <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-sky-400/0 via-sky-400/0 to-blue-400/0 group-focus-within:from-sky-400/20 group-focus-within:via-blue-400/20 group-focus-within:to-sky-400/20 blur-sm transition-all duration-500 -z-10" />
          </div>

          <div className="relative inline-flex flex-shrink-0 rounded-xl border border-slate-200/80 dark:border-gray-700/80 bg-white/60 dark:bg-gray-900/60 p-[3px] shadow-sm backdrop-blur-sm overflow-hidden">
            {/* Sliding active background */}
            <div
              className="absolute top-[3px] bottom-[3px] rounded-[9px] bg-gradient-to-r from-sky-500 to-blue-500 shadow-md shadow-sky-200/50 transition-all duration-300 ease-out"
              style={{
                width: `${100 / DIFFICULTIES.length}%`,
                left: `${DIFFICULTIES.findIndex((d) => d.value === difficulty) * (100 / DIFFICULTIES.length)}%`,
              }}
            />
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setGenerationOptions({ topic, difficulty: d.value })}
                className={`relative z-10 rounded-[9px] px-3.5 py-2 text-sm font-semibold transition-colors duration-300 ${
                  d.value === difficulty
                    ? 'text-white'
                    : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => handleGenerate()}
            disabled={generating || !topic.trim()}
            className="relative inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/25 transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(14,165,233,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 overflow-hidden"
          >
            {/* Button hover shine */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
            {generating && (
              <svg className="relative h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            <span className="relative">
              {generating ? '生成中' : '生成幻灯片'}
              {!generating && (
                <span className="absolute -right-1.5 -top-1.5 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
                  <span className="relative inline-flex h-full w-full rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/30" />
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Right: status + template */}
        <div className="flex w-48 flex-shrink-0 items-center justify-end gap-2 animate-fade-in-right">
          {status && (
            <span
              className={`text-xs font-medium animate-fade-in-up ${
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
          <div
            className="scrollbar-hide flex-shrink-0 overflow-y-auto px-4 pt-4"
            style={{ maxHeight: '35%', overscrollBehavior: 'contain' }}
          >
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

          <div className="mx-4 h-px flex-shrink-0 bg-gradient-to-r from-transparent via-slate-200/60 dark:via-gray-700/60 to-transparent relative">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-400/0 via-sky-400/10 to-sky-400/0 opacity-0 transition-opacity duration-500 hover:opacity-100" />
          </div>

          {/* Thumbnails */}
          <div
            className="scrollbar-hide flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
                幻灯片
              </span>
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-slate-100 dark:bg-gray-800 px-1.5 text-[10px] font-bold tabular-nums text-slate-500 dark:text-gray-400">
                {totalPages}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {previewImages
                ? previewImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveIndex(i)}
                      className={`group relative flex items-center gap-3 rounded-xl p-2 text-left transition-all duration-300 overflow-hidden ${
                        i === activeIndex
                          ? 'bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-blue-900/30 dark:to-indigo-900/20 ring-1 ring-blue-200/60 dark:ring-blue-800/40 shadow-sm shadow-blue-100/50 dark:shadow-blue-900/20'
                          : 'hover:bg-slate-50/80 dark:hover:bg-gray-800/80 hover:shadow-sm hover:-translate-y-[1px]'
                      }`}
                    >
                      {/* Active left accent bar */}
                      {i === activeIndex && (
                        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-sky-400 to-blue-500" />
                      )}
                      <div className="relative flex-shrink-0 ml-0.5">
                        <img
                          src={img}
                          alt={`Thumb ${i + 1}`}
                          className={`h-[56px] w-[100px] rounded-lg object-cover shadow-sm transition-all duration-300 ${
                            i === activeIndex
                              ? 'ring-2 ring-sky-400/40 shadow-md shadow-sky-500/15'
                              : 'group-hover:scale-[1.04] group-hover:shadow-md'
                          }`}
                          draggable={false}
                        />
                        <span
                          className={`absolute -left-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold shadow-sm transition-all duration-300 ${
                            i === activeIndex
                              ? 'bg-sky-500 text-white shadow-sky-200 scale-110'
                              : 'bg-white dark:bg-gray-800 text-slate-400 dark:text-gray-500 shadow-sm ring-1 ring-slate-200 dark:ring-gray-600'
                          }`}
                        >
                          {i + 1}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span
                          className={`text-[11px] font-semibold transition-colors ${
                            i === activeIndex
                              ? 'text-sky-700 dark:text-sky-300'
                              : 'text-slate-500 dark:text-gray-400'
                          }`}
                        >
                          {i === 0
                            ? '封面'
                            : i === previewImages.length - 1
                              ? '封底'
                              : `第 ${i + 1} 页`}
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
                : null}
            </div>
          </div>
        </aside>

        {/* Right: slide display */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1">
            {showSmartCover && draftDNA ? (
              <SmartCoverView
                topic={topic}
                difficulty={difficulty}
                draftDNA={draftDNA}
                showStyleLab={showStyleLab}
                onToggleStyleLab={() => setShowStyleLab((v) => !v)}
                onConfirm={handleConfirmSmartCover}
                onRefresh={() => handleSuggestCover(topic)}
                onShowGallery={() => {
                  setShowSmartCover(false);
                  handleGenerateCovers(topic);
                }}
                onUpdatePalette={updatePalette}
                onUpdateLayout={updateLayout}
                onUpdateFont={updateFont}
                onUpdateDensity={updateDensity}
              />
            ) : previewImages ? (
              <div className="flex h-full items-center justify-center bg-white/40 dark:bg-gray-900/40 backdrop-blur-sm p-6 animate-fade-in-scale">
                <div
                  className="relative max-h-full max-w-full group"
                  style={{ perspective: '1200px' }}
                >
                  {/* Ambient glow behind slide */}
                  <div className="absolute -inset-6 rounded-3xl bg-gradient-to-b from-sky-500/8 via-blue-500/4 to-transparent dark:from-sky-400/8 dark:via-blue-400/4 blur-2xl transition-opacity duration-500 group-hover:opacity-100 opacity-60" />
                  {/* 3D tilt container */}
                  <div
                    className="relative transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.01]"
                    style={{ transformStyle: 'preserve-3d' }}
                  >
                    <img
                      src={previewImages[activeIndex]}
                      alt={`Slide ${activeIndex + 1}`}
                      className="relative max-h-full max-w-full rounded-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] object-contain border border-white/20 dark:border-white/5 transition-shadow duration-500 group-hover:shadow-[0_35px_70px_-15px_rgba(14,165,233,0.2)]"
                      draggable={false}
                    />
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-6 h-6 pointer-events-none">
                      <div className="absolute top-2 left-2 w-3 h-[1.5px] bg-white/20 rounded-full" />
                      <div className="absolute top-2 left-2 w-[1.5px] h-3 bg-white/20 rounded-full" />
                    </div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 pointer-events-none">
                      <div className="absolute bottom-2 right-2 w-3 h-[1.5px] bg-white/20 rounded-full" />
                      <div className="absolute bottom-2 right-2 w-[1.5px] h-3 bg-white/20 rounded-full" />
                    </div>
                  </div>
                  {/* Dot indicators */}
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                    {previewImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveIndex(i)}
                        className={`h-1 rounded-full transition-all duration-300 ${
                          i === activeIndex
                            ? 'w-5 bg-sky-400 shadow-sm shadow-sky-400/30'
                            : 'w-1.5 bg-slate-300/60 dark:bg-gray-600/60 hover:bg-slate-400 dark:hover:bg-gray-500'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : generating ? (
              <div className="flex h-full flex-col items-center justify-center gap-8 animate-fade-in-scale">
                {/* Workshop metaphor — layered composition cards */}
                <div className="relative flex items-center justify-center h-32 w-32">
                  <motion.div
                    className="absolute h-[72px] w-[52px] rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/30 shadow-sm"
                    animate={{ y: [-2, 2, -2], rotate: [-4, -2, -4] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="absolute h-[72px] w-[52px] rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/50 shadow-md"
                    animate={{ y: [-1, 3, -1], rotate: [1, 3, 1] }}
                    transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                    style={{ marginLeft: 5, marginTop: -7 }}
                  />
                  <motion.div
                    className="absolute h-[72px] w-[52px] rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-lg flex flex-col items-center justify-center gap-1"
                    animate={{ y: [0, -2, 0], rotate: [-1, 1, -1] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                    style={{ marginLeft: 10, marginTop: -14 }}
                  >
                    <div className="w-8 h-1 rounded-full bg-slate-200 dark:bg-slate-500" />
                    <div className="w-6 h-[3px] rounded-full bg-slate-150 dark:bg-slate-550" />
                    <div className="w-5 h-[3px] rounded-full bg-slate-150 dark:bg-slate-550" />
                  </motion.div>
                </div>

                <div className="flex flex-col items-center gap-4 w-80">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300 text-center">
                    {status || '准备素材中...'}
                  </p>
                  {/* Stage steps — refined dots */}
                  <div className="flex items-center gap-2">
                    {(
                      [
                        'planning',
                        'sections_generating',
                        'pages_designing',
                        'qa_reviewing',
                        'merging',
                        'done',
                      ] as const
                    ).map((stage, i) => {
                      const stages = [
                        'planning',
                        'sections_generating',
                        'pages_designing',
                        'qa_reviewing',
                        'merging',
                        'done',
                      ];
                      const currentIdx = stages.indexOf(genStage);
                      const state =
                        i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending';
                      return (
                        <div key={stage} className="flex items-center gap-2">
                          <motion.div
                            className={`h-[5px] w-[5px] rounded-full transition-colors duration-700 ${
                              state === 'done'
                                ? 'bg-slate-400'
                                : state === 'active'
                                  ? 'bg-sky-500'
                                  : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                            animate={state === 'active' ? { scale: [1, 1.4, 1] } : {}}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          />
                          {i < stages.length - 1 && (
                            <div
                              className={`w-5 h-[1px] rounded-full transition-colors duration-700 ${
                                state === 'done'
                                  ? 'bg-slate-300 dark:bg-slate-600'
                                  : 'bg-slate-100 dark:bg-slate-800'
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Refined progress bar */}
                  <div className="w-full h-[3px] rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-slate-700 dark:bg-slate-300"
                      animate={{ width: `${genProgress || 2}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 tabular-nums tracking-wide">
                    {Math.round(genProgress || 2)}%
                  </p>
                </div>
              </div>
            ) : generatedPptx ? (
              <div className="flex h-full flex-col items-center justify-center bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm gap-5 animate-slide-up-fade">
                {/* Success ring animation */}
                <div className="relative flex items-center justify-center">
                  {/* Ambient glow */}
                  <div className="absolute h-32 w-32 rounded-full bg-emerald-400/10 dark:bg-emerald-400/5 blur-2xl animate-soft-pulse" />
                  {/* Orbital ring */}
                  <div className="absolute h-24 w-24 rounded-full border border-dashed border-emerald-200/30 dark:border-emerald-500/15 animate-[spin_12s_linear_infinite]" />
                  <div className="absolute h-20 w-20 rounded-full border-2 border-emerald-300/40 animate-ring-expand" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/20 shadow-lg shadow-emerald-500/15 border border-emerald-100/60 dark:border-emerald-800/30">
                    <svg
                      className="h-8 w-8 text-emerald-500 animate-check-pop"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-base font-bold text-slate-800 dark:text-gray-100">
                    课件生成成功
                  </p>
                  <p className="text-xs text-slate-400 dark:text-gray-500">文件已自动下载到本地</p>
                </div>
                <button
                  onClick={handleDownloadGenerated}
                  className="relative inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-[0_8px_30px_-4px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                  <svg
                    className="relative h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  重新下载课件
                </button>
              </div>
            ) : isSuggesting ? (
              <div className="flex h-full flex-col items-center justify-center gap-8 animate-fade-in-scale">
                {/* Style exploration metaphor — color swatches */}
                <div className="relative flex items-center justify-center h-28 w-32">
                  <motion.div
                    className="absolute h-14 w-11 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/30"
                    animate={{ rotate: [-6, -2, -6], y: [0, -3, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ marginLeft: -14 }}
                  />
                  <motion.div
                    className="absolute h-14 w-11 rounded-md bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-md"
                    animate={{ rotate: [2, 6, 2], y: [0, -5, 0] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                    style={{ marginLeft: 2, marginTop: -6 }}
                  />
                  <motion.div
                    className="absolute h-14 w-11 rounded-md bg-sky-50 dark:bg-sky-900/20 border border-sky-200/40 dark:border-sky-700/30 shadow-sm"
                    animate={{ rotate: [8, 12, 8], y: [0, -2, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                    style={{ marginLeft: 18, marginTop: -3 }}
                  />
                </div>
                <div className="flex flex-col items-center gap-3.5 w-80">
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300 text-center">
                    {suggestStatus || '浏览风格参考中...'}
                  </p>
                  <div className="w-full h-[3px] rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-slate-700 dark:bg-slate-300"
                      animate={{ width: `${Math.min(suggestProgress, 100)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 tabular-nums tracking-wide">
                    {Math.round(Math.min(suggestProgress, 100))}%
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-8 animate-fade-in-scale">
                {/* Refined illustration — stacked composition cards */}
                <div className="relative flex items-center justify-center h-28 w-32">
                  <motion.div
                    className="absolute h-16 w-12 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/30 shadow-sm"
                    animate={{ y: [0, 2, 0], rotate: [-4, -2, -4] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ marginLeft: -14 }}
                  />
                  <motion.div
                    className="absolute h-16 w-12 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-md flex flex-col items-center justify-center gap-1"
                    animate={{ y: [0, -3, 0], rotate: [2, 5, 2] }}
                    transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                    style={{ marginLeft: 0, marginTop: -8 }}
                  >
                    <svg
                      className="h-5 w-5 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                      />
                    </svg>
                  </motion.div>
                  <motion.div
                    className="absolute h-16 w-12 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-200/40 dark:border-sky-700/30 shadow-sm"
                    animate={{ y: [0, 1, 0], rotate: [8, 10, 8] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                    style={{ marginLeft: 16, marginTop: -2 }}
                  />
                </div>

                {/* Typography */}
                <div className="flex flex-col items-center gap-2 text-center">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                    输入教学主题，开始制作课件
                  </h2>
                  <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
                    分析学科特点，生成精美幻灯片
                  </p>
                </div>

                {/* Quick topic chips */}
                <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-md">
                  {[
                    { label: '勾股定理', icon: '📐' },
                    { label: '牛顿定律', icon: '🍎' },
                    { label: '光合作用', icon: '🌿' },
                    { label: '唐诗宋词', icon: '📜' },
                  ].map((item, i) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        setGenerationOptions({ topic: item.label, difficulty });
                        setTimeout(() => handleGenerate(), 50);
                      }}
                      className="group flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/70 dark:bg-gray-800/70 border border-slate-200/60 dark:border-gray-700/60 text-sm font-medium text-slate-600 dark:text-gray-300 hover:border-sky-300/60 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50/50 dark:hover:bg-sky-900/10 hover:shadow-lg hover:shadow-sky-500/10 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 animate-fade-in-up opacity-0"
                      style={{ animationDelay: `${0.25 + i * 0.08}s` }}
                    >
                      <span className="text-base transition-transform duration-300 group-hover:scale-110">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  ))}
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
            <footer className="relative flex flex-shrink-0 items-center justify-between border-t border-slate-200/50 dark:border-gray-700/50 bg-white/60 dark:bg-gray-900/60 px-6 py-2.5 backdrop-blur-2xl">
              <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-sky-300/30 dark:via-sky-500/20 to-transparent" />
              {previewImages && previewImages.length > 0 ? (
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                    disabled={activeIndex === 0}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 dark:text-gray-400 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-700 dark:hover:text-gray-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:scale-100"
                  >
                    <svg
                      className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    上一页
                  </button>

                  <div className="flex flex-col items-center gap-1">
                    <span className="min-w-[4rem] text-center text-xs tabular-nums text-slate-400 dark:text-gray-500">
                      <span className="font-bold text-slate-700 dark:text-gray-200">
                        {activeIndex + 1}
                      </span>
                      <span className="mx-1 text-slate-300 dark:text-gray-600">/</span>
                      <span className="font-medium">{totalPages}</span>
                    </span>
                    {/* Progress bar */}
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500 relative overflow-hidden"
                        style={{ width: `${((activeIndex + 1) / totalPages) * 100}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveIndex((i) => Math.min(totalPages - 1, i + 1))}
                    disabled={activeIndex === totalPages - 1}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 dark:text-gray-400 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-700 dark:hover:text-gray-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:scale-100"
                  >
                    下一页
                    <svg
                      className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-gray-500">
                  <svg
                    className="h-4 w-4 text-emerald-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>课件已生成</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                {qaReport && (
                  <button
                    onClick={() => setShowQaReport(true)}
                    className="group rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 dark:text-gray-400 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-700 dark:hover:text-gray-200 hover:scale-105 active:scale-95"
                  >
                    <span className="mr-1 inline-block transition-transform group-hover:scale-110">
                      📋
                    </span>
                    查看质检报告
                  </button>
                )}
                <button
                  onClick={() => {
                    setGeneratedPptx(null);
                    handleGenerate();
                  }}
                  disabled={generating}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 dark:text-gray-400 transition-all hover:bg-slate-100 dark:hover:bg-gray-800 hover:text-slate-700 dark:hover:text-gray-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                >
                  重新生成
                </button>
                {generatedPptx && (
                  <button
                    onClick={handleDownloadGenerated}
                    className="relative inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-[0_8px_30px_-4px_rgba(16,185,129,0.4)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
                    <svg
                      className="relative h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-fade-in">
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            onClick={() => setShowQaReport(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.4)] overflow-hidden animate-slide-up-fade border border-white/50 dark:border-white/5">
            <div className="absolute top-0 left-4 right-4 h-[2px] rounded-full bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100/80 dark:border-gray-700/80">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-gray-100">质检报告</h2>
                <p className="text-xs text-slate-400 dark:text-gray-500">
                  总分: {qaReport.totalScore}/100 {qaReport.pass ? '✅ 通过' : '⚠️ 未通过'}
                </p>
              </div>
              <button
                onClick={() => setShowQaReport(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 dark:text-gray-500 hover:bg-slate-100 dark:hover:bg-gray-800"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {qaReport.issues.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-gray-400 text-center py-4">
                  无问题，课件质量良好
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {qaReport.issues.map((issue, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveIndex(issue.pageNum - 1);
                        setShowQaReport(false);
                      }}
                      className={`group flex items-start gap-2 rounded-xl p-2.5 text-left text-xs transition-all duration-200 hover:shadow-sm ${
                        issue.severity === 'high'
                          ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100/60 dark:hover:bg-red-900/30'
                          : issue.severity === 'medium'
                            ? 'bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100/60 dark:hover:bg-amber-900/30'
                            : 'bg-slate-50 dark:bg-gray-800/50 hover:bg-slate-100/60 dark:hover:bg-gray-800/80'
                      }`}
                    >
                      <span className="mt-0.5 flex-shrink-0">
                        {issue.severity === 'high'
                          ? '❌'
                          : issue.severity === 'medium'
                            ? '⚠️'
                            : 'ℹ️'}
                      </span>
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-700 dark:text-gray-200">
                          第 {issue.pageNum} 页 — {issue.type}
                        </span>
                        <p className="text-slate-500 dark:text-gray-400 mt-0.5">{issue.detail}</p>
                      </div>
                      <svg
                        className="h-3 w-3 flex-shrink-0 mt-1 text-slate-300 dark:text-gray-600 transition-transform group-hover:translate-x-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
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
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-slate-950/30 backdrop-blur-sm animate-fade-in-scale">
          <div className="relative flex flex-col items-center gap-6 rounded-2xl bg-white/95 dark:bg-slate-900/95 p-8 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.2)] max-w-sm w-full mx-4 border border-slate-100 dark:border-slate-800">
            {/* Stage indicator */}
            <div className="flex items-center gap-2 w-full">
              {[
                { key: 'analyzing', label: '分析主题' },
                { key: 'designing', label: '搭配风格' },
                { key: 'rendering', label: '渲染预览' },
              ].map((s, i) => {
                const isDone =
                  coverStage === 'rendering' ||
                  (coverStage === 'designing' && i < 2) ||
                  (coverStage === 'analyzing' && i < 1);
                const isActive = coverStage === s.key;
                return (
                  <div key={s.key} className="flex items-center gap-2 flex-1">
                    <div
                      className={`relative flex items-center justify-center h-3.5 w-3.5 rounded-full transition-all duration-500 ${
                        isActive
                          ? 'bg-slate-700 dark:bg-slate-300'
                          : isDone
                            ? 'bg-slate-400 dark:bg-slate-500'
                            : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                    >
                      {isDone && !isActive && (
                        <svg
                          className="h-2 w-2 text-white dark:text-slate-900"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {isActive && (
                        <motion.div
                          className="h-1 w-1 rounded-full bg-white dark:bg-slate-900"
                          animate={{ scale: [1, 0.5, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? 'text-slate-700 dark:text-slate-200'
                          : isDone
                            ? 'text-slate-500 dark:text-slate-400'
                            : 'text-slate-300 dark:text-slate-600'
                      }`}
                    >
                      {s.label}
                    </span>
                    {i < 2 && (
                      <div
                        className={`flex-1 h-[1px] rounded-full transition-all duration-500 ${
                          isDone
                            ? 'bg-slate-300 dark:bg-slate-600'
                            : 'bg-slate-100 dark:bg-slate-800'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Message */}
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 text-center min-h-[1.25rem]">
              {coverStage === 'analyzing' && `分析"${topic}"的学科特点...`}
              {coverStage === 'designing' && '搭配 12 种封面风格...'}
              {coverStage === 'rendering' && '即将呈现封面画廊...'}
            </p>

            {/* Subtle loading indicator */}
            <div className="flex gap-1.5">
              <motion.div
                className="h-1.5 w-1.5 rounded-full bg-slate-300"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
              />
              <motion.div
                className="h-1.5 w-1.5 rounded-full bg-slate-300"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
              />
              <motion.div
                className="h-1.5 w-1.5 rounded-full bg-slate-300"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
