'use client';

import { Suspense, useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
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
import { PageTour } from '@/components/sky/tour/page-tour';
import { Button } from '@/components/ui/button';
import { AvatarSpeechPlayer } from './avatar-speech-player';
import { CoverGallery, type CoverItem } from './cover-gallery';
import { SmartCoverView } from './smart-cover-view';
import { useCoverDraft } from '@/lib/slides/hooks/use-cover-draft';
import { SlidePreviewGallery } from './slide-preview-gallery';
import { SlideViewer } from './slide-viewer';
import { exportCourseToPPTX } from '@/lib/export/course-exporter';
import { AVATAR_CONFIGS } from '@/lib/slides/avatar-config';
import type { AvatarConfig } from '@/lib/slides/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { useTaskStore } from '@/lib/store/use-task-store';
import { EmptyState } from './states/empty-state';
import { GeneratingState } from './states/generating-state';
import { SuccessState } from './states/success-state';
import { SuggestingState } from './states/suggesting-state';
import { RegeneratePrompt } from './regenerate-prompt';
import { QaReportModalLight } from './qa-report-modal-light';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';

const DIFFICULTIES = [
  { value: 'senior', label: '高中' },
  { value: 'college', label: '大学' },
] as const;

interface SlidesPageProps {
  initialTopic?: string;
  personalizationNotice?: string | null;
  personalizationContext?: PersonalizationContext | null;
}

export default function SlidesPage(props: SlidesPageProps = {}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
          加载课件工坊...
        </div>
      }
    >
      <SlidesPageContent {...props} />
    </Suspense>
  );
}

function SlidesPageContent({
  initialTopic,
  personalizationNotice,
  personalizationContext,
}: SlidesPageProps = {}) {
  const searchParams = useSearchParams();
  const urlTopic = searchParams.get('topic');

  // Persistent state from Zustand store
  const setSlides = useSkyClassroomStore((s) => s.setSlides);
  const generationOptions = useSkyClassroomStore((s) => s.generationOptions);
  const setGenerationOptions = useSkyClassroomStore((s) => s.setGenerationOptions);
  const storeSelectedAvatarId = useSkyClassroomStore((s) => s.selectedAvatarId);
  const setSelectedAvatarId = useSkyClassroomStore((s) => s.setSelectedAvatar);

  // Defensive: localStorage may contain stale non-string values from old schema
  const topic = typeof generationOptions?.topic === 'string' ? generationOptions.topic : '';
  const difficulty: 'junior' | 'senior' | 'college' = ['senior', 'college'].includes(
    generationOptions?.difficulty as string,
  )
    ? (generationOptions.difficulty as 'junior' | 'senior' | 'college')
    : 'senior';

  // Ephemeral UI state
  const [generating, setGenerating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const userEditedTopicRef = useRef(false);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarConfig>(
    AVATAR_CONFIGS.find((a) => a.id === storeSelectedAvatarId) || AVATAR_CONFIGS[0],
  );
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);

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

  useEffect(() => {
    const suggestedTopic = urlTopic?.trim() || initialTopic?.trim();
    if (!suggestedTopic || generating || userEditedTopicRef.current) return;

    const currentTopic = topic.trim();
    if (currentTopic === suggestedTopic || (!urlTopic && currentTopic)) return;

    setGenerationOptions({ topic: suggestedTopic, difficulty });
  }, [difficulty, generating, initialTopic, setGenerationOptions, topic, urlTopic]);
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
  const [genTotalPages, setGenTotalPages] = useState(0);
  const [genOutline, setGenOutline] = useState<Array<{
    pageNum: number;
    title: string;
    type: string;
  }> | null>(null);
  const [genCompletedSlides, setGenCompletedSlides] = useState<Array<{
    pageNum: number;
    title: string;
    type: string;
  }> | null>(null);
  const [genCurrentPage, setGenCurrentPage] = useState<{
    pageNum: number;
    title: string;
    type: string;
  } | null>(null);
  const [genStageTimings, setGenStageTimings] = useState<
    Record<string, { startAt: number; endAt?: number; durationMs?: number }> | undefined
  >(undefined);
  const [genStartedAt, setGenStartedAt] = useState<number | undefined>(undefined);
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
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
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

  const clearGeneratedDeckState = useCallback(() => {
    stopProgress();
    setActiveJobId(null);
    setSlides([]);
    setGeneratedPptx(null);
    setPreviewImages(null);
    setPreviewId('');
    setShowPreview(false);
    setActiveIndex(0);
    setQaReport(null);
    setShowQaReport(false);
    setGenStage('idle');
    setGenProgress(0);
    setGenTotalPages(0);
    setGenOutline(null);
    setGenCompletedSlides(null);
    setGenCurrentPage(null);
    setGenStageTimings(undefined);
    setGenStartedAt(undefined);
    setStatus('');
  }, [setActiveJobId, setSlides, stopProgress]);

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

        if (res.status === 401) {
          setCoverLoading(false);
          setStatus('登录已过期，正在刷新…');
          window.location.reload();
          return;
        }

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
      clearGeneratedDeckState();
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
        if (res.status === 401) {
          setStatus('登录已过期，请重新登录');
          setGenerating(false);
          window.location.reload();
          return;
        }

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
              if (statusRes.status === 401) {
                clearInterval(poll);
                setActiveJobId(null);
                setGenerating(false);
                setStatus('登录已过期，请重新登录');
                window.location.reload();
                return;
              }
              const statusData = await statusRes.json();
              if (statusData.success) {
                pollErrors = 0;
                const job = statusData.data || statusData.job;
                setGenStage(job.stage);
                setGenProgress(job.progress || 0);
                setStatus(job.message || '');
                setGenTotalPages(job.totalPages ?? 0);
                setGenOutline(job.outline ?? null);
                setGenCompletedSlides(job.completedSlides ?? null);
                setGenCurrentPage(job.currentPage ?? null);
                setGenStageTimings(job.stageTimings);
                setGenStartedAt(job.startedAt);

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
    [topic, difficulty, clearGeneratedDeckState, setActiveJobId],
  );

  // ── Smart Cover handlers ──
  const handleSuggestCover = useCallback(
    async (overrideTopic?: unknown) => {
      const rawTopic = typeof overrideTopic === 'string' ? overrideTopic : topic;
      const t = rawTopic.trim();
      if (!t) return;

      clearGeneratedDeckState();
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

        if (res.status === 401) {
          setSuggestStatus('登录已过期，请重新登录');
          setSuggestProgress(0);
          window.location.reload();
          return;
        }

        const data = await res.json().catch(() => ({ success: false, error: '无法解析服务响应' }));

        if (!res.ok || !data.success || !data.cover) {
          const serverError =
            data.error ||
            data.details ||
            (res.status === 500 ? '服务端异常' : `请求失败 (${res.status})`);
          setSuggestStatus(`推荐失败: ${serverError}`);
          setSuggestProgress(0);
          return;
        }

        // Completion beat: let progress animate to 100 with a visual flourish
        // before swapping to the cover preview.
        setSuggestProgress(100);
        setSuggestStatus('风格匹配完成');
        await new Promise((r) => setTimeout(r, 700));
        applySuggestion(data.cover.pngUrl, data.cover.designDNA);
        setSuggestStatus('');
      } catch {
        clearInterval(progressInterval);
        setSuggestStatus('网络错误，请检查服务是否运行');
        setSuggestProgress(0);
      }
    },
    [topic, difficulty, startSuggesting, applySuggestion, clearGeneratedDeckState],
  );

  const handleConfirmSmartCover = useCallback(() => {
    const finalDNA = confirm();
    if (!finalDNA) return;

    clearGeneratedDeckState();
    setShowSmartCover(false);
    setShowStyleLab(false);
    setGenerating(true);
    setGenStage('planning');
    setGenProgress(0);
    setGenStageTimings(undefined);
    setGenStartedAt(undefined);

    fetch('/api/sky/slides/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic,
        difficulty,
        designDNA: finalDNA,
      }),
    })
      .then((res) => {
        if (res.status === 401) {
          setStatus('登录已过期，请重新登录');
          setGenerating(false);
          window.location.reload();
          throw new Error('401');
        }
        return res.json();
      })
      .then((data) => {
        if (data.success && data.jobId) {
          setActiveJobId(data.jobId);
          const jobId = data.jobId;
          let pollErrors = 0;
          const MAX_POLL_ERRORS = 5;
          const poll = setInterval(async () => {
            try {
              const statusRes = await fetch(`/api/sky/slides/generate/status?jobId=${jobId}`);
              if (statusRes.status === 401) {
                clearInterval(poll);
                setActiveJobId(null);
                setGenerating(false);
                setStatus('登录已过期，请重新登录');
                window.location.reload();
                return;
              }
              const statusData = await statusRes.json();
              if (statusData.success) {
                pollErrors = 0;
                const job = statusData.data || statusData.job;
                setGenStage(job.stage);
                setGenProgress(job.progress || 0);
                setStatus(job.message || '');
                setGenTotalPages(job.totalPages ?? 0);
                setGenOutline(job.outline ?? null);
                setGenCompletedSlides(job.completedSlides ?? null);
                setGenCurrentPage(job.currentPage ?? null);
                setGenStageTimings(job.stageTimings);
                setGenStartedAt(job.startedAt);
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
  }, [topic, difficulty, confirm, setActiveJobId, clearGeneratedDeckState]);

  const handleGenerate = useCallback(
    async (overrideTopic?: unknown) => {
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
    clearGeneratedDeckState();
  }, [clearGeneratedDeckState]);

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
        let pollErrors = 0;
        const MAX_POLL_ERRORS = 5;
        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/sky/slides/generate/status?jobId=${task.jobId}`);
            if (statusRes.status === 401) {
              clearInterval(poll);
              setGenerating(false);
              setStatus('登录已过期，请重新登录');
              window.location.reload();
              return;
            }
            if (statusRes.status === 404) {
              clearInterval(poll);
              setGenerating(false);
              setStatus('生成任务已过期，请重新生成');
              useTaskStore.getState().removeTask(task.id);
              return;
            }
            const statusData = await statusRes.json();
            if (statusData.success) {
              pollErrors = 0;
              const job = statusData.data || statusData.job;
              setGenStage(job.stage as never);
              setGenProgress(job.progress || 0);
              setStatus(job.message || '');
              setGenTotalPages(job.totalPages ?? 0);
              setGenOutline(job.outline ?? null);
              setGenCompletedSlides(job.completedSlides ?? null);
              setGenCurrentPage(job.currentPage ?? null);
              setGenStageTimings(job.stageTimings);
              setGenStartedAt(job.startedAt);

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
            } else {
              pollErrors++;
              if (pollErrors >= MAX_POLL_ERRORS) {
                clearInterval(poll);
                setGenerating(false);
                setStatus('状态查询失败，请刷新页面后重试');
                useTaskStore.getState().removeTask(task.id);
              }
            }
          } catch {
            pollErrors++;
            if (pollErrors >= MAX_POLL_ERRORS) {
              clearInterval(poll);
              setGenerating(false);
              setStatus('状态查询失败，请检查网络或刷新页面后重试');
              useTaskStore.getState().removeTask(task.id);
            }
          }
        }, 2000);
      }
    } else if (task.status === 'completed') {
      // Don't auto-restore completed tasks on mount — user should land on empty state
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
        if (statusRes.status === 401) {
          clearInterval(poll);
          setActiveJobId(null);
          setGenerating(false);
          setStatus('登录已过期，请重新登录');
          window.location.reload();
          return;
        }
        const statusData = await statusRes.json();
        if (statusData.success) {
          pollErrors = 0;
          const job = statusData.data || statusData.job;
          if (!job) return;
          setGenStage(job.stage);
          setGenProgress(job.progress || 0);
          setStatus(job.message || '');
          setGenTotalPages(job.totalPages ?? 0);
          setGenOutline(job.outline ?? null);
          setGenCompletedSlides(job.completedSlides ?? null);
          setGenCurrentPage(job.currentPage ?? null);
          setGenStageTimings(job.stageTimings);
          setGenStartedAt(job.startedAt);
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
    <div
      className="slides-workspace relative flex h-[calc(100dvh-4rem)] min-h-0 w-full flex-col overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, var(--celestial-void) 0%, var(--celestial-horizon) 100%)',
      }}
    >
      {/* Top bar */}
      <header
        data-tour-step="page-header"
        className="slides-workspace-header relative z-10 flex h-14 flex-shrink-0 items-center border-b border-[var(--celestial-haze)]/20 px-5"
        style={{ background: 'var(--celestial-surface)' }}
      >
        {/* Left: brand */}
        <div className="flex flex-shrink-0 items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div
              className="slides-workspace-mark flex h-7 w-7 items-center justify-center rounded-lg text-[var(--celestial-starlight)]"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(56,189,248,0.25))',
                boxShadow:
                  '0 0 10px rgba(139,92,246,0.25), inset 0 0 0 1px var(--celestial-border)',
              }}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
                />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-[var(--celestial-starlight)]/90">
                深空工坊
              </span>
              <span className="text-[9px] font-mono tracking-widest text-[var(--celestial-starlight)]/25">
                CELESTIAL ATELIER
              </span>
            </div>
          </div>
        </div>

        {/* Center: file name or empty */}
        <div className="flex flex-1 items-center justify-center">
          {previewImages && generatedPptx?.fileName && (
            <span className="max-w-xs truncate text-sm text-[var(--celestial-starlight)]/40">
              {generatedPptx.fileName}
            </span>
          )}
        </div>

        {/* Right: status only */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {status && (
            <span
              className={`text-xs font-medium ${
                status.includes('失败') || status.includes('错误')
                  ? 'text-red-500'
                  : 'text-[var(--celestial-starlight)]/30'
              }`}
            >
              {status}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        <main data-tour-step="page-primary" className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1 flex flex-col">
            <AnimatePresence mode="wait">
              {showSmartCover && draftDNA ? (
                <motion.div
                  key="smart-cover"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="relative min-h-0 flex-1 flex flex-col"
                >
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
                    onUpdateLayout={(layoutType) => layoutType && updateLayout(layoutType)}
                    onUpdateFont={updateFont}
                    onUpdateDensity={updateDensity}
                  />
                </motion.div>
              ) : generating ? (
                <GeneratingState
                  stage={genStage}
                  progress={genProgress}
                  status={status}
                  totalPages={genTotalPages}
                  outline={genOutline || undefined}
                  completedSlides={genCompletedSlides || undefined}
                  currentPage={genCurrentPage || undefined}
                  stageTimings={genStageTimings}
                  startedAt={genStartedAt}
                />
              ) : previewImages ? (
                <SlideViewer
                  images={previewImages}
                  activeIndex={activeIndex}
                  onIndexChange={setActiveIndex}
                  fileName={generatedPptx?.fileName}
                  onDownload={handleDownloadGenerated}
                  onRegenerate={() => setShowRegeneratePrompt(true)}
                  onShowQaReport={() => setShowQaReport(true)}
                  hasQaReport={!!qaReport}
                />
              ) : generatedPptx ? (
                <SuccessState
                  fileName={generatedPptx.fileName}
                  onDownload={handleDownloadGenerated}
                  onRegenerate={() => setShowRegeneratePrompt(true)}
                />
              ) : isSuggesting ? (
                <motion.div
                  key="suggesting"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeIn' }}
                  className="relative min-h-0 flex-1 flex flex-col"
                >
                  <SuggestingState progress={suggestProgress} status={suggestStatus} />
                </motion.div>
              ) : (
                <EmptyState
                  topic={topic}
                  difficulty={difficulty}
                  generating={generating}
                  personalizationNotice={personalizationNotice}
                  personalizationContext={personalizationContext}
                  onTopicChange={(t) => {
                    userEditedTopicRef.current = true;
                    setGenerationOptions({ topic: t, difficulty });
                  }}
                  onDifficultyChange={(d) => setGenerationOptions({ topic, difficulty: d })}
                  onGenerate={handleGenerate}
                />
              )}
            </AnimatePresence>
            <AvatarSpeechPlayer
              avatar={hasContent ? selectedAvatar : null}
              speech={null}
              activeSlideIndex={activeIndex}
              totalSlides={totalPages}
            />
          </div>
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
        <QaReportModalLight
          report={qaReport}
          onClose={() => setShowQaReport(false)}
          onNavigate={(pageNum) => {
            setActiveIndex(pageNum - 1);
            setShowQaReport(false);
          }}
        />
      )}

      {/* Regenerate Prompt */}
      {showRegeneratePrompt && (
        <RegeneratePrompt
          currentTopic={topic || undefined}
          onGenerate={(newTopic) => {
            setShowRegeneratePrompt(false);
            clearGeneratedDeckState();
            setGenerationOptions({ topic: newTopic, difficulty });
            handleGenerate(newTopic);
          }}
          onClose={() => setShowRegeneratePrompt(false)}
        />
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
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-slate-400/30 backdrop-blur-sm animate-fade-in-scale dark:bg-slate-950/30">
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

      <PageTour id="resources-slides" />
    </div>
  );
}
