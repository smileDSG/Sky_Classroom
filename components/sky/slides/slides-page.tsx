'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Sparkles, Presentation, Wand2, Download, RotateCcw, ChevronLeft, ChevronRight, ChevronDown, Image as ImageIcon, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AvatarSpeechPlayer } from './avatar-speech-player';
import { AvatarSelector } from './avatar-selector';
import { CoverGallery, type CoverItem } from './cover-gallery';
import { SlidePreviewGallery } from './slide-preview-gallery';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [avatarExpanded, setAvatarExpanded] = useState(false);
  // ── Cover Gallery state ──
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverStage, setCoverStage] = useState<'idle' | 'analyzing' | 'designing' | 'rendering'>('idle');
  const [coverCovers, setCoverCovers] = useState<CoverItem[]>([]);
  const [showCoverGallery, setShowCoverGallery] = useState(false);
  const coverCacheRef = useRef<Map<string, CoverItem[]>>(new Map());
  // ── Legacy ──
  const [generatedPptx, setGeneratedPptx] = useState<{ url: string; fileName: string } | null>(null);
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
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
          if (stage === 'writing' && p < 95) return Math.min(p + 0.3, 95);
          if (stage === 'rendering' && p < 99) return Math.min(p + 0.2, 99);
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
    const cacheKey = `${t}_${difficulty}`;
    coverCacheRef.current.delete(cacheKey);
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
        const jobId = data.jobId;

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

        const poll = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/sky/slides/generate/status?jobId=${jobId}`);
            const statusData = await statusRes.json();
            if (statusData.success) {
              const job = statusData.data || statusData.job;
              setGenStage(job.stage as never);
              setGenProgress(job.progress || 0);
              setStatus(job.message || '');

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
      (t) => t.type === 'slides' && t.status !== 'failed'
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

  const isLoading = generating || coverLoading;

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-transparent">
            PPT课件生成
          </h1>
          <p className="text-sm text-muted-foreground">输入教学主题，AI 为你一键生成精美PPT课件</p>
        </div>
        <div className="flex items-center gap-2">
          {(generating || generatedPptx) && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              重新生成
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ── LEFT COLUMN ── */}
        <div className="space-y-6">
          {/* Input Card */}
          <Card className="overflow-hidden border-cyan-200/50 dark:border-cyan-800/40 shadow-md shadow-cyan-100/50 dark:shadow-cyan-900/20">
            <CardHeader className="border-b bg-gradient-to-r from-cyan-50 to-transparent dark:from-cyan-950/30 dark:to-transparent">
              <CardTitle className="flex items-center gap-2 text-base text-cyan-700 dark:text-cyan-300">
                <Presentation className="h-4 w-4 text-cyan-500" />
                课件设置
              </CardTitle>
              <CardDescription>设置主题和难度，AI 将为你生成课件</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {/* Topic Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">教学主题</label>
                <input
                  value={topic}
                  onChange={(e) => setGenerationOptions({ topic: e.target.value, difficulty })}
                  onKeyDown={(e) => e.key === 'Enter' && !isLoading && topic.trim() && handleGenerate()}
                  placeholder="如：勾股定理、牛顿定律、细胞分裂…"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-colors"
                />
              </div>

              {/* Difficulty */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">难度等级</label>
                <div className="flex gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setGenerationOptions({ topic, difficulty: d.value })}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        d.value === difficulty
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-md shadow-cyan-200/50'
                          : 'border border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar Selector - Collapsible */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setAvatarExpanded((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-cyan-500" />
                    <span>讲解角色：{selectedAvatar.name}</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${avatarExpanded ? 'rotate-180' : ''}`} />
                </button>
                {avatarExpanded && (
                  <div className="rounded-lg border border-input bg-background p-3">
                    <AvatarSelector
                      avatars={AVATAR_CONFIGS}
                      selectedId={selectedAvatar.id}
                      onSelect={(id) => {
                        const a = AVATAR_CONFIGS.find((av) => av.id === id) || AVATAR_CONFIGS[0];
                        setSelectedAvatar(a);
                        setSelectedAvatarId(a.id);
                        setAvatarExpanded(false);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Generate Button */}
              <Button
                onClick={() => handleGenerate()}
                disabled={isLoading || !topic.trim()}
                className="w-full gap-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/25"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {coverLoading ? '生成封面中...' : '生成中...'}
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    生成课件
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Tips Card */}
          {!hasContent && !generating && (
            <Card className="overflow-hidden border-cyan-200/40 dark:border-cyan-800/30 bg-cyan-50/50 dark:bg-cyan-950/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-cyan-600 dark:text-cyan-400">
                  <Sparkles className="h-4 w-4" />
                  使用技巧
                </div>
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <li>• 主题越具体，生成的课件越精准</li>
                  <li>• 可选择不同难度适配学生水平</li>
                  <li>• 选择讲解角色获得个性化讲解</li>
                  <li>• 生成后可下载 PPTX 文件</li>
                </ul>
              </CardContent>
            </Card>
          )}

          {/* QA Report Card */}
          {qaReport && generatedPptx && (
            <Card className="overflow-hidden border-amber-200/50 dark:border-amber-800/40">
              <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-transparent dark:from-amber-950/30 dark:to-transparent pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <CheckCircle2 className="h-4 w-4 text-amber-500" />
                  质检报告
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl font-bold text-foreground">{qaReport.totalScore}</span>
                  <span className={`text-sm font-medium px-2 py-1 rounded-full ${
                    qaReport.pass ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {qaReport.pass ? '通过' : '未通过'}
                  </span>
                </div>
                {qaReport.issues.length > 0 && (
                  <div className="space-y-2">
                    {qaReport.issues.slice(0, 3).map((issue, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs">
                        <span className="mt-0.5">
                          {issue.severity === 'high' ? '❌' : issue.severity === 'medium' ? '⚠️' : 'ℹ️'}
                        </span>
                        <span className="text-muted-foreground">{issue.detail}</span>
                      </div>
                    ))}
                    {qaReport.issues.length > 3 && (
                      <p className="text-xs text-muted-foreground">还有 {qaReport.issues.length - 3} 个问题...</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="space-y-6">
          {/* Preview Card */}
          <Card className="overflow-hidden border-cyan-200/50 dark:border-cyan-800/40 shadow-md shadow-cyan-100/50 dark:shadow-cyan-900/20 min-h-[600px]">
            <CardHeader className="border-b bg-gradient-to-r from-cyan-50 to-transparent dark:from-cyan-950/30 dark:to-transparent">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base text-cyan-700 dark:text-cyan-300">
                  <ImageIcon className="h-4 w-4 text-cyan-500" />
                  课件预览
                </CardTitle>
                {previewImages && previewImages.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {activeIndex + 1} / {totalPages}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                        disabled={activeIndex === 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setActiveIndex((i) => Math.min(totalPages - 1, i + 1))}
                        disabled={activeIndex === totalPages - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {previewImages ? (
                <div className="relative">
                  {/* Slide Preview */}
                  <div className="flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
                    <img
                      src={previewImages[activeIndex]}
                      alt={`Slide ${activeIndex + 1}`}
                      className="max-h-[500px] w-full rounded-lg shadow-lg object-contain"
                      style={{ aspectRatio: '16/9' }}
                      draggable={false}
                    />
                  </div>

                  {/* Thumbnail Strip */}
                  <div className="border-t border-border bg-muted/30 p-3">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {previewImages.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveIndex(i)}
                          className={`flex-shrink-0 rounded-md overflow-hidden transition-all ${
                            i === activeIndex
                              ? 'ring-2 ring-cyan-500 shadow-md'
                              : 'ring-1 ring-border hover:ring-cyan-300'
                          }`}
                        >
                          <img
                            src={img}
                            alt={`Thumb ${i + 1}`}
                            className="h-12 w-20 object-cover"
                            draggable={false}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : generating ? (
                <div className="flex flex-col items-center justify-center py-16 gap-6">
                  {/* Animated icon */}
                  <div className="relative">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-cyan-100 dark:border-cyan-900/30 border-t-cyan-500" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Presentation className="h-6 w-6 text-cyan-500" />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 w-80">
                    <p className="text-base font-semibold text-foreground">
                      {genStage === 'thinking' ? '正在构思课件结构...' :
                       genStage === 'writing' ? '正在生成课件内容...' :
                       genStage === 'rendering' ? '正在渲染幻灯片...' : '正在初始化...'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {status || 'AI 正在为您创作精美课件'}
                    </p>
                    {/* Progress bar */}
                    <div className="w-full space-y-2">
                      <div className="h-2 rounded-full bg-cyan-100 dark:bg-cyan-900/30 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500 ease-out"
                          style={{ width: `${genProgress || 5}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{genStage === 'thinking' ? '分析主题' : genStage === 'writing' ? '生成内容' : genStage === 'rendering' ? '渲染幻灯片' : '准备中'}</span>
                        <span className="font-medium text-cyan-500">{Math.round(genProgress || 5)}%</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center mt-2">
                      生成完成后将自动显示预览，您可以继续浏览其他页面
                    </p>
                  </div>
                </div>
              ) : generatedPptx ? (
                <div className="flex flex-col items-center justify-center py-16 gap-6">
                  {/* Success icon */}
                  <div className="relative">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/20">
                      <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                    </div>
                    <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-lg font-bold text-foreground">课件生成成功！</p>
                    <p className="text-sm text-muted-foreground">共 {totalPages} 页幻灯片已准备就绪</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={handleDownloadGenerated}
                      className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25"
                    >
                      <Download className="h-4 w-4" />
                      下载课件
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      生成新课件
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-6">
                  {/* Welcome icon */}
                  <div className="relative">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/20 dark:to-blue-900/20 shadow-lg shadow-cyan-200/30 dark:shadow-cyan-900/10">
                      <Presentation className="h-10 w-10 text-cyan-500" />
                    </div>
                    <div className="absolute -right-2 -bottom-2 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
                      <Sparkles className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-3 max-w-sm text-center">
                    <p className="text-lg font-bold text-foreground">AI PPT课件生成器</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      输入教学主题，AI 将为你一键生成精美的PPT课件
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                      <span>快速生成</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Wand2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>精美设计</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5 text-amber-400" />
                      <span>一键下载</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Avatar Speech Player */}
      <AvatarSpeechPlayer
        avatar={hasContent ? selectedAvatar : null}
        speech={null}
        activeSlideIndex={activeIndex}
        totalSlides={totalPages}
      />

      {/* Cover Gallery Modal */}
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
        <div className="fixed inset-0 z-[101] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 rounded-2xl bg-card p-8 shadow-2xl max-w-sm w-full mx-4 border">
            <div className="flex items-center gap-2 w-full">
              {[
                { key: 'analyzing', label: '分析主题' },
                { key: 'designing', label: '设计风格' },
                { key: 'rendering', label: '渲染预览' },
              ].map((s, i) => (
                <div key={s.key} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center justify-center h-3 w-3 rounded-full transition-all duration-500 ${
                    coverStage === s.key ? 'bg-cyan-500 animate-pulse' :
                    (coverStage === 'rendering' || (coverStage === 'designing' && i < 2) || (coverStage === 'analyzing' && i < 1))
                      ? 'bg-cyan-500' : 'bg-muted'
                  }`} />
                  <span className={`text-[10px] font-medium whitespace-nowrap ${
                    coverStage === s.key ? 'text-cyan-600 dark:text-cyan-400' : 'text-muted-foreground'
                  }`}>{s.label}</span>
                  {i < 2 && <div className="flex-1 h-px bg-border" />}
                </div>
              ))}
            </div>
            <p className="text-sm font-medium text-foreground text-center">
              {coverStage === 'analyzing' && `AI 正在分析"${topic}"的学科特点…`}
              {coverStage === 'designing' && '正在渲染 12 种封面风格…'}
              {coverStage === 'rendering' && '即将呈现封面画廊…'}
            </p>
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-muted border-t-cyan-500" />
          </div>
        </div>
      )}

      {/* Slide Preview Gallery */}
      {showPreview && previewImages && (
        <SlidePreviewGallery
          slideImages={previewImages}
          initialIndex={activeIndex}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
