'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Sparkles, CheckCircle2, Loader2, FileText, Search, Clapperboard, Image, Volume2, Save } from 'lucide-react';
import { toast } from 'sonner';

import { OutlinesEditor } from '@/components/generation/outlines-editor';
import {
  type ClassroomJobState,
  fetchClassroomJob,
  pollClassroomJob,
  approveClassroomOutline,
  cancelClassroomJob,
} from '@/lib/classroom/classroom-job-client';
import { useTaskStore } from '@/lib/store/use-task-store';
import { removeActiveJobEntry } from '@/lib/classroom/classroom-session';
import { createLogger } from '@/lib/logger';

const log = createLogger('GenerationProgress');

const PHASE_LABELS: Record<string, string> = {
  queued: '排队中',
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

function GenerationProgressContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');

  const [phase, setPhase] = useState<'loading' | 'generating' | 'reviewing' | 'generating_slides' | 'done'>('loading');
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

  const abortRef = useRef<AbortController | null>(null);
  const hasStartedRef = useRef(false);

  // Start polling on mount
  useEffect(() => {
    if (!jobId) return;

    // Reset on re-mount (handles React Strict Mode double-mount in dev)
    hasStartedRef.current = false;

    const abortController = new AbortController();
    abortRef.current = abortController;

    let cancelled = false;

    (async () => {
      // Guard against Strict Mode double-mount: if already started, skip
      if (hasStartedRef.current) return;
      hasStartedRef.current = true;

      try {
        // Check current state first
        const current = await fetchClassroomJob(jobId);
        if (cancelled || abortController.signal.aborted) return;
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
            setError(current.error || '生成失败');
          }
          return;
        }

        setPhase('generating');

        // Poll for progress
        await pollClassroomJob(
          jobId,
          (data) => {
            if (cancelled || abortController.signal.aborted) return;
            updateFromJob(data);
          },
          abortController.signal,
        );

        if (cancelled || abortController.signal.aborted) return;

        // Check final state after polling
        const final = await fetchClassroomJob(jobId);
        if (cancelled || abortController.signal.aborted) return;
        updateFromJob(final);

        if (final.status === 'awaiting_review') {
          setPhase('reviewing');
        } else if (final.done) {
          if (final.status === 'succeeded' && final.result) {
            setResult(final.result);
            setPhase('done');
          }
        }
      } catch (err) {
        if (cancelled || abortController.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        log.error('Generation progress poll error:', err);
        setError(err instanceof Error ? err.message : '生成过程出错');
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [jobId]);

  const updateFromJob = useCallback((data: ClassroomJobState) => {
    if (data.status === 'cancelled') {
      removeActiveJobEntry(jobId!);
      toast.info('课堂生成已取消');
      router.push('/');
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
      removeActiveJobEntry(jobId!);
    }

    // Update task store for multi-task tracking
    const task = useTaskStore.getState().tasks[jobId ?? ''];
    if (task) {
      useTaskStore.getState().updateTask(task.id, {
        progress: data.progress,
        phase: data.message,
      });
    }
  }, [jobId, router]);

  const handleApproveOutline = useCallback(async () => {
    if (!jobId) return;

    const signal = abortRef.current?.signal;
    try {
      setPhase('generating_slides');
      const editedOutlines = outlines;
      setOutlines(undefined);

      // 大纲已确认，清除草稿和会话数据
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

      const final = await fetchClassroomJob(jobId);
      if (signal?.aborted) return;
      if (final.status === 'awaiting_review') {
        if (final.outlines) setOutlines(final.outlines);
        if (final.outlinesMeta) setOutlinesMeta(final.outlinesMeta);
        setPhase('reviewing');
        return;
      }
      if (final.result) {
        setResult(final.result);
        setPhase('done');
      }
    } catch (err) {
      if (signal?.aborted) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      log.error('Approve outline error:', err);
      setError(err instanceof Error ? err.message : '继续生成失败');
    }
  }, [jobId, updateFromJob]);

  const handleCancel = useCallback(async () => {
    if (!jobId || cancelling) return;
    setCancelling(true);
    try {
      abortRef.current?.abort();
      await cancelClassroomJob(jobId);

      // Remove task from store
      useTaskStore.getState().removeTask(jobId);
      removeActiveJobEntry(jobId!);

      toast.info('课堂生成已取消');
      router.push('/');
    } catch (err) {
      log.error('Cancel job error:', err);
      toast.error('取消生成失败，请重试');
      setCancelling(false);
    }
  }, [jobId, cancelling, router]);

  const handleGoToClassroom = useCallback(() => {
    if (result?.classroomId) {
      removeActiveJobEntry(jobId!);
      router.push(`/classroom/${result.classroomId}`);
    }
  }, [result, router]);

  const stepLabel = PHASE_LABELS[step] || step || '处理中';

  return (
    <div className="min-h-screen bg-[#FAFBFC] dark:bg-slate-950">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => {
              router.push('/');
            }}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </button>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 tracking-tight">课堂制作</h1>
          <div className="w-20" />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Done state */}
        {phase === 'done' && result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/40 mb-6">
              <CheckCircle2 className="h-7 w-7 text-slate-600 dark:text-slate-300" />
            </div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-1 tracking-tight">课堂已就绪</h2>
            <p className="text-sm text-slate-400 mb-8">
              共 {result.scenesCount} 个场景
            </p>
            <button
              onClick={handleGoToClassroom}
              className="rounded-xl bg-slate-800 dark:bg-slate-200 px-6 py-2.5 text-sm font-medium text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors"
            >
              进入课堂
            </button>
          </motion.div>
        )}

        {/* Outline review */}
        {phase === 'reviewing' && outlines && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm p-6 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-slate-500" />
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  大纲预览（{outlinesMeta?.totalScenes ?? outlines.length} 个场景）
                </h2>
              </div>
              <OutlinesEditor
                outlines={outlines}
                onChange={setOutlines}
                onConfirm={handleApproveOutline}
                onBack={() => {
                  router.push('/');
                }}
                isLoading={false}
              />
            </div>
          </motion.div>
        )}

        {/* Progress display — two-column layout */}
        {(phase === 'loading' || phase === 'generating' || phase === 'generating_slides') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-6 lg:grid-cols-[360px_1fr]"
          >
            {/* ── LEFT: Progress card ── */}
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm p-6 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">
              {/* Header with workshop metaphor */}
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex items-center justify-center h-11 w-11">
                  <motion.div
                    className="absolute h-5 w-4 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-200/40 dark:border-slate-700/30"
                    animate={{ y: [0, 1, 0], rotate: [-2, 0, -2] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="absolute h-5 w-4 rounded-sm bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 shadow-sm flex items-center justify-center"
                    animate={{ y: [0, -2, 0], rotate: [1, 3, 1] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                    style={{ marginLeft: 3, marginTop: -3 }}
                  >
                    <div className="w-2.5 h-[2px] rounded-full bg-slate-200 dark:bg-slate-500" />
                  </motion.div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                    {phase === 'generating_slides' ? '编排幻灯片' : '制作课堂'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{stepLabel}</p>
                </div>
                <div className="text-xl font-semibold text-slate-500 tabular-nums tracking-wide">{progress}%</div>
              </div>

              {/* Refined progress bar */}
              <div className="mb-6">
                <div className="h-[3px] rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-slate-700 dark:bg-slate-300"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.7, ease: 'easeInOut' }}
                  />
                </div>
              </div>

              {/* Step timeline */}
              <div className="space-y-0">
                {[
                  { key: 'researching', icon: Search, label: '搜集资料' },
                  { key: 'generating_outlines', icon: FileText, label: '梳理结构' },
                  { key: 'generating_scenes', icon: Clapperboard, label: '编排场景' },
                  { key: 'generating_media', icon: Image, label: '准备素材' },
                  { key: 'persisting', icon: Save, label: '归档保存' },
                ].map(({ key, icon: Icon, label }, idx, arr) => {
                  const isActive = step === key;
                  const isDone =
                    (key === 'researching' && ['generating_outlines', 'awaiting_review', 'generating_scenes', 'generating_media', 'generating_tts', 'persisting', 'completed'].includes(step)) ||
                    (key === 'generating_outlines' && ['awaiting_review', 'generating_scenes', 'generating_media', 'generating_tts', 'persisting', 'completed'].includes(step)) ||
                    (key === 'generating_scenes' && ['generating_media', 'generating_tts', 'persisting', 'completed'].includes(step)) ||
                    (key === 'generating_media' && ['generating_tts', 'persisting', 'completed'].includes(step)) ||
                    (key === 'persisting' && ['completed'].includes(step));

                  return (
                    <div key={key} className="flex items-start gap-3">
                      {/* Timeline connector */}
                      <div className="flex flex-col items-center pt-2">
                        <motion.div
                          className={`h-2 w-2 rounded-full transition-colors duration-500 ${
                            isDone ? 'bg-slate-400' :
                            isActive ? 'bg-sky-500' :
                            'bg-slate-200 dark:bg-slate-700'
                          }`}
                          animate={isActive ? { scale: [1, 1.3, 1] } : {}}
                          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        {idx < arr.length - 1 && (
                          <div className={`w-[1px] h-6 mt-1 transition-colors duration-500 ${
                            isDone ? 'bg-slate-300 dark:bg-slate-600' : 'bg-slate-100 dark:bg-slate-800'
                          }`} />
                        )}
                      </div>
                      <div className={`flex-1 flex items-center gap-2 py-1.5 transition-colors duration-300 ${
                        isActive
                          ? 'text-slate-800 dark:text-slate-100'
                          : isDone
                            ? 'text-slate-500 dark:text-slate-400'
                            : 'text-slate-300 dark:text-slate-600'
                      }`}>
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className={`text-sm ${isActive ? 'font-medium' : ''}`}>{label}</span>
                        {isDone && <CheckCircle2 className="h-3 w-3 text-slate-400 shrink-0 ml-auto" />}
                        {isActive && (
                          <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
                            {key === 'generating_scenes' && totalScenes > 0
                              ? `${scenesGenerated}/${totalScenes}`
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  {cancelling ? '取消中...' : '取消制作'}
                </button>
              </div>

              <p className="mt-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
                可返回首页，后台继续处理
              </p>
            </div>

            {/* ── RIGHT: Live content feed ── */}
            <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/40 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm p-6 min-h-[400px] shadow-[0_2px_16px_-6px_rgba(15,23,42,0.06)]">
              <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] mb-5">
                {phase === 'generating_slides' ? '编排内容' : '制作进度'}
              </h3>

              {/* Phase: researching */}
              {step === 'researching' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3">
                    <Search className="h-4 w-4 text-slate-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">搜集相关资料</p>
                      <p className="text-xs text-slate-400">{message || '整理背景信息...'}</p>
                    </div>
                    <motion.div
                      className="h-1.5 w-1.5 rounded-full bg-slate-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                </div>
              )}

              {/* Phase: generating_outlines */}
              {step === 'generating_outlines' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3">
                    <FileText className="h-4 w-4 text-slate-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">梳理课堂结构</p>
                      <p className="text-xs text-slate-400">{message || '分析知识体系，构建场景大纲...'}</p>
                    </div>
                    <motion.div
                      className="h-1.5 w-1.5 rounded-full bg-slate-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  {/* Skeleton with refined styling */}
                  <div className="space-y-2.5 pl-2">
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 w-full" />
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 w-[85%]" />
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 w-[70%]" />
                    <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 w-[60%]" />
                  </div>
                  <p className="text-xs text-slate-400 text-center">分析需求中，构建场景大纲...</p>
                </div>
              )}

              {/* Phase: generating_scenes — show outlines with progress */}
              {(step === 'generating_scenes' || (step === 'awaiting_review' && outlines)) && outlines && outlines.length > 0 && (
                <div className="space-y-2">
                  {outlines.map((outline, i) => {
                    const isSceneDone = scenesGenerated > i;
                    const isCurrentScene = scenesGenerated === i;
                    return (
                      <div
                        key={outline.id || i}
                        className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-300 ${
                          isCurrentScene
                            ? 'bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/30'
                            : isSceneDone
                              ? 'bg-transparent'
                              : 'bg-transparent opacity-50'
                        }`}
                      >
                        <div className={`flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 text-[10px] font-medium ${
                          isSceneDone
                            ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            : isCurrentScene
                              ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                          {isSceneDone ? (
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          ) : isCurrentScene ? (
                            <motion.div
                              className="h-1.5 w-1.5 rounded-full bg-white dark:bg-slate-900"
                              animate={{ scale: [1, 0.6, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                            />
                          ) : (
                            <span>{i + 1}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${isCurrentScene ? 'font-medium text-slate-800 dark:text-slate-100' : isSceneDone ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`}>
                            {outline.title}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {outline.type === 'slide' ? '幻灯片' : outline.type === 'quiz' ? '测验' : outline.type === 'interactive' ? '互动' : 'PBL'}
                            {outline.keyPoints?.length ? ` · ${outline.keyPoints.length} 个要点` : ''}
                          </p>
                        </div>
                        {isCurrentScene && (
                          <span className="text-[11px] text-slate-500 font-medium flex-shrink-0">编排中</span>
                        )}
                      </div>
                    );
                  })}
                  {scenesGenerated < outlines.length && (
                    <p className="text-[11px] text-slate-400 text-center pt-2 tracking-wide">
                      已完成 {scenesGenerated}/{outlines.length} 个场景
                    </p>
                  )}
                </div>
              )}

              {/* Phase: generating_scenes but no outlines yet */}
              {step === 'generating_scenes' && (!outlines || outlines.length === 0) && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                  <div className="flex gap-1">
                    <motion.div className="h-1 w-1 rounded-full bg-slate-300" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} />
                    <motion.div className="h-1 w-1 rounded-full bg-slate-300" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} />
                    <motion.div className="h-1 w-1 rounded-full bg-slate-300" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />
                  </div>
                  <span className="text-sm">准备场景内容...</span>
                </div>
              )}

              {/* Phase: generating_media */}
              {step === 'generating_media' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3">
                    <Image className="h-4 w-4 text-slate-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">准备媒体素材</p>
                      <p className="text-xs text-slate-400">{message || '图片、视频处理中...'}</p>
                    </div>
                    <motion.div
                      className="h-1.5 w-1.5 rounded-full bg-slate-400"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </div>
                  {outlines && outlines.length > 0 && (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {outlines.map((outline, i) => (
                        <div key={outline.id || i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                          i < scenesGenerated ? 'text-slate-600 dark:text-slate-300' : 'text-slate-300 dark:text-slate-600'
                        }`}>
                          <svg className={`h-3.5 w-3.5 flex-shrink-0 ${i < scenesGenerated ? 'text-slate-400' : 'text-slate-200'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <span className="truncate">{outline.title}</span>
                          {i < scenesGenerated && outline.mediaGenerations?.length ? (
                            <span className="text-[11px] text-slate-400 ml-auto flex-shrink-0">{outline.mediaGenerations.length} 个素材</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Phase: generating_tts */}
              {step === 'generating_tts' && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3">
                  <Volume2 className="h-4 w-4 text-slate-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">录制语音</p>
                    <p className="text-xs text-slate-400">{message || '音频合成中...'}</p>
                  </div>
                  <motion.div
                    className="h-1.5 w-1.5 rounded-full bg-slate-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              )}

              {/* Phase: persisting */}
              {step === 'persisting' && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 px-4 py-3">
                  <Save className="h-4 w-4 text-slate-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">归档保存</p>
                    <p className="text-xs text-slate-400">整理数据并归档...</p>
                  </div>
                  <motion.div
                    className="h-1.5 w-1.5 rounded-full bg-slate-400"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </div>
              )}

              {/* Initial/fallback */}
              {!['researching', 'generating_outlines', 'generating_scenes', 'generating_media', 'generating_tts', 'persisting'].includes(step) && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                  <div className="flex gap-1.5">
                    <motion.div className="h-1.5 w-1.5 rounded-full bg-slate-300" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0 }} />
                    <motion.div className="h-1.5 w-1.5 rounded-full bg-slate-300" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }} />
                    <motion.div className="h-1.5 w-1.5 rounded-full bg-slate-300" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }} />
                  </div>
                  <span className="text-sm">{message || '准备中...'}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function GenerationProgressPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#FAFBFC] dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: '0ms' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: '150ms' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm text-slate-400">加载中...</span>
        </div>
      </div>
    }>
      <GenerationProgressContent />
    </Suspense>
  );
}
