'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { useI18n } from '@/lib/hooks/use-i18n';
import { resolveLocale } from '@/lib/templates/types';
import { useAuth } from '@/components/auth/auth-provider';
import { useUserProfileStore } from '@/lib/store/user-profile';
import { useSettingsStore } from '@/lib/store/settings';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useTaskStore } from '@/lib/store/use-task-store';
import { useDraftCache } from '@/lib/hooks/use-draft-cache';
import { useImportClassroom } from '@/lib/import/use-import-classroom';

import {
  listStages,
  deleteStageData,
  renameStage,
  getFirstSlideByStages,
  revokeThumbnailSlideMediaUrls,
} from '@/lib/utils/stage-storage';
import { storePdfBlob } from '@/lib/utils/image-storage';
import { createLogger } from '@/lib/logger';
import type { Slide } from '@/lib/types/slides';
import type { CourseTemplate } from '@/lib/templates/types';

import { SettingsDialog } from '@/components/settings';
import { TemplatePicker } from '@/components/templates/template-picker';
import { UpgradeDialog } from '@/components/billing/upgrade-dialog';
import { UsageProgress } from '@/components/billing/usage-progress';
import { DraggableQaButton } from '@/components/draggable-qa-button';

// 新组件
import { SkyBackground } from '@/components/sky/home/sky-background';
import { MinimalNavbar } from '@/components/sky/home/minimal-navbar';
import { FloatingUserCard } from '@/components/sky/home/floating-user-card';
import { AnimatedLogo, FeatureHighlights } from '@/components/sky/home/animated-logo';
import { IntroSequence } from '@/components/sky/home/intro-sequence';
import { HeroInput } from '@/components/sky/home/hero-input';
import { ClassroomGrid } from '@/components/sky/home/classroom-grid';
import type { SettingsSection } from '@/lib/types/settings';
import { cn } from '@/lib/utils';

const log = createLogger('Home');

const WEB_SEARCH_STORAGE_KEY = 'webSearchEnabled';
const INTERACTIVE_MODE_STORAGE_KEY = 'interactiveModeEnabled';

// ── Classroom background job API helpers ──────────────────────────

import {
  type ClassroomJobState,
  submitClassroomJob,
  fetchClassroomJob,
} from '@/lib/classroom/classroom-job-client';
import {
  type StoredJobEntry,
  getActiveJobEntries,
  addActiveJobEntry,
  removeActiveJobEntry,
} from '@/lib/classroom/classroom-session';

interface StageListItem {
  id: string;
  name: string;
  description?: string;
  sceneCount: number;
  createdAt: number;
  updatedAt: number;
  interactiveMode?: boolean;
}

export default function HomePage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { user } = useAuth();

  // 状态
  const [requirement, setRequirement] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [introDone, setIntroDone] = useState(false);

  // ── Classroom background generation state (multi-job) ──
  interface JobCardState {
    jobId: string;
    topic: string;
    phase: 'submitting' | 'generating_outline' | 'reviewing' | 'generating_slides' | 'done';
    step: string;
    progress: number;
    outlines?: ClassroomJobState['outlines'];
    outlinesMeta?: ClassroomJobState['outlinesMeta'];
  }
  const [activeJobs, setActiveJobs] = useState<Record<string, JobCardState>>({});
  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  const activeSolveTaskId = useTaskStore((s) => s.activeSolveTaskId);
  const tasks = useTaskStore((s) => s.tasks);
  const setActiveSolveTask = useTaskStore((s) => s.setActiveSolveTask);

  // ── Handle job completion ──
  const handleClassroomComplete = useCallback(
    (result: NonNullable<ClassroomJobState['result']>, taskId: string) => {
      useTaskStore.getState().updateTask(taskId, {
        status: 'completed',
        progress: 100,
        phase: '课堂生成完成',
        result,
      });
      removeActiveJobEntry(taskId);
      abortRefs.current.get(taskId)?.abort();
      abortRefs.current.delete(taskId);
      setActiveJobs((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
      router.push(`/classroom/${result.classroomId}`);
    },
    [router],
  );

  // ── Map API job status to card phase ──
  const jobStatusToPhase = useCallback((data: ClassroomJobState): JobCardState['phase'] => {
    if (data.status === 'awaiting_review') return 'reviewing';
    if (data.status === 'cancelled' || data.status === 'failed') return 'done';
    if (data.done) return 'done';
    if (data.step === 'generating_outlines') return 'generating_outline';
    return 'generating_slides';
  }, []);

  // ── Poll a single job continuously and update its card state ──
  const startJobPolling = useCallback((jobId: string, topic: string) => {
    // Abort any existing poll for this job
    abortRefs.current.get(jobId)?.abort();
    const abortController = new AbortController();
    abortRefs.current.set(jobId, abortController);

    (async () => {
      try {
        // Set initial card state
        setActiveJobs((prev) => ({
          ...prev,
          [jobId]: { jobId, topic, phase: 'generating_outline', step: '', progress: 0 },
        }));

        // Continuous polling — covers all phases including reviewing
        while (!abortController.signal.aborted) {
          const data = await fetchClassroomJob(jobId);
          if (abortController.signal.aborted) return;

          // Terminal states — remove job
          if (data.status === 'cancelled' || data.status === 'failed') {
            useTaskStore.getState().removeTask(jobId);
            removeActiveJobEntry(jobId);
            abortRefs.current.delete(jobId);
            setActiveJobs((prev) => {
              const next = { ...prev };
              delete next[jobId];
              return next;
            });
            return;
          }

          if (data.done && data.status === 'succeeded' && data.result) {
            handleClassroomComplete(data.result, jobId);
            return;
          }

          // Update card state
          const phase = jobStatusToPhase(data);
          setActiveJobs((prev) => {
            const existing = prev[jobId];
            if (!existing) return prev;
            return {
              ...prev,
              [jobId]: {
                ...existing,
                phase,
                step: data.step,
                progress: data.progress,
                outlines: data.outlines ?? existing.outlines,
                outlinesMeta: data.outlinesMeta ?? existing.outlinesMeta,
              },
            };
          });

          useTaskStore.getState().updateTask(
            useTaskStore.getState().tasks[jobId]?.id ?? '',
            { progress: data.progress, phase: data.message },
          );

          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch (err) {
        if (abortController.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        log.error('Classroom poll error:', err);
        setError(err instanceof Error ? err.message : '课堂生成失败');
        removeActiveJobEntry(jobId);
        abortRefs.current.delete(jobId);
        setActiveJobs((prev) => {
          const next = { ...prev };
          delete next[jobId];
          return next;
        });
      }
    })();
  }, [jobStatusToPhase, handleClassroomComplete]);

  // ── Navigation restoration: restore classroom generation state from task store ──
  useEffect(() => {
    const allSlidesTasks = Object.values(useTaskStore.getState().tasks).filter(
      (t) => t.type === 'slides',
    );

    // Clean up stale non-running tasks
    for (const t of allSlidesTasks) {
      if (t.status !== 'running') {
        useTaskStore.getState().removeTask(t.id);
      }
    }

    const runningTasks = allSlidesTasks.filter((t) => t.status === 'running');
    if (runningTasks.length === 0) return;

    for (const task of runningTasks) {
      if (!task.jobId) continue;
      const topic = task.label?.replace(/^课堂:\s*/, '') || '';
      const isReviewing = task.phase?.includes('审阅');

      setActiveJobs((prev) => ({
        ...prev,
        [task.jobId]: {
          jobId: task.jobId,
          topic,
          phase: isReviewing ? 'reviewing' : task.phase?.includes('大纲') ? 'generating_outline' : 'generating_slides',
          step: task.phase ?? '',
          progress: task.progress ?? 0,
        },
      }));

      startJobPolling(task.jobId, topic);
    }

    return () => {
      for (const ctrl of abortRefs.current.values()) {
        ctrl.abort();
      }
      abortRefs.current.clear();
    };
  }, [startJobPolling]);

  // ── Restore classroom state from sessionStorage (survives refresh) ──
  useEffect(() => {
    const entries = getActiveJobEntries();
    if (entries.length === 0) return;

    for (const entry of entries) {
      const topic = entry.topic;
      (async () => {
        try {
          const data = await fetchClassroomJob(entry.jobId);

          if (data.status === 'cancelled' || data.status === 'failed' || (data.done && data.status === 'succeeded')) {
            removeActiveJobEntry(entry.jobId);
            return;
          }

          // Set initial card state then start continuous polling for ALL jobs
          const phase = data.status === 'awaiting_review'
            ? 'reviewing'
            : data.step === 'generating_outlines'
              ? 'generating_outline'
              : 'generating_slides';

          setActiveJobs((prev) => ({
            ...prev,
            [entry.jobId]: {
              jobId: entry.jobId,
              topic,
              phase: phase as JobCardState['phase'],
              step: data.step,
              progress: data.progress,
              outlines: data.outlines ?? undefined,
              outlinesMeta: data.outlinesMeta ?? undefined,
            },
          }));

          startJobPolling(entry.jobId, topic);
        } catch {
          // Job file may not exist yet — ignore
        }
      })();
    }
  }, [startJobPolling]);

  // 老师和学生选择状态
  const [selectedTeacherId, setSelectedTeacherId] = useState('default-1');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(['default-3', 'default-4', 'default-5']);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | undefined>();
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  const [classrooms, setClassrooms] = useState<StageListItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});
  const thumbnailsRef = useRef<Record<string, Slide>>({});

  const currentModelId = useSettingsStore((s) => s.modelId);
  const { updateCache: updateRequirementCache } =
    useDraftCache<string>({ key: 'requirementDraft' });

  const { importing, fileInputRef, triggerFileSelect, handleFileChange } =
    useImportClassroom(() => loadClassrooms());

  // 每次进入首页清空输入框草稿，避免旧数据残留
  useEffect(() => {
    try {
      localStorage.removeItem('requirementDraft');
      sessionStorage.removeItem('generationSession');
    } catch {
      /* ignore */
    }
  }, []);

  // 加载设置
  useEffect(() => {
    try {
      const savedWebSearch = localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
      const savedInteractiveMode = localStorage.getItem(INTERACTIVE_MODE_STORAGE_KEY);
      if (savedWebSearch === 'true') setWebSearch(true);
      if (savedInteractiveMode === 'true') setInteractiveMode(true);
    } catch {
      /* ignore */
    }
  }, []);

  // 加载课堂列表
  const loadClassrooms = async () => {
    try {
      const list = await listStages();
      // 转换类型
      const typedList: StageListItem[] = list.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        sceneCount: item.sceneCount,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        interactiveMode: item.interactiveMode,
      }));
      setClassrooms(typedList);

      if (typedList.length > 0) {
        const slides = await getFirstSlideByStages(typedList.map((c) => c.id));
        thumbnailsRef.current = slides;
        setThumbnails(slides);
      } else {
        thumbnailsRef.current = {};
        setThumbnails({});
      }
    } catch (err) {
      log.error('Failed to load classrooms:', err);
    }
  };

  useEffect(() => {
    // 清理媒体存储
    useMediaGenerationStore.getState().revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });

    loadClassrooms();

    return () => {
      revokeThumbnailSlideMediaUrls(thumbnailsRef.current);
      thumbnailsRef.current = {};
    };
  }, []);

  // 保存设置
  const handleWebSearchChange = useCallback((value: boolean) => {
    setWebSearch(value);
    try {
      localStorage.setItem(WEB_SEARCH_STORAGE_KEY, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  const handleInteractiveModeChange = useCallback((value: boolean) => {
    setInteractiveMode(value);
    try {
      localStorage.setItem(INTERACTIVE_MODE_STORAGE_KEY, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  const handleRequirementChange = useCallback(
    (value: string) => {
      setRequirement(value);
      updateRequirementCache(value);
    },
    [updateRequirementCache]
  );

  // 生成
  const handleGenerate = async () => {
    if (!currentModelId) {
      setSettingsSection('providers');
      setSettingsOpen(true);
      return;
    }

    if (!requirement.trim()) {
      setError(t('upload.requirementRequired'));
      return;
    }

    setError(null);

    const topic = requirement.trim().length > 40
      ? `${requirement.trim().slice(0, 37)}...`
      : requirement.trim();

    try {
      // Sync agent selections
      useSettingsStore.getState().setSelectedAgentIds([selectedTeacherId, ...selectedStudentIds]);

      // Build job body with model config from client settings
      const settings = useSettingsStore.getState();
      const modelString = settings.providerId && settings.modelId
        ? `${settings.providerId}:${settings.modelId}`
        : settings.modelId || undefined;
      const body: Record<string, unknown> = {
        requirement,
        enableWebSearch: webSearch,
        agentMode: 'default',
        modelString,
      };

      if (pdfFile) {
        const pdfStorageKey = await storePdfBlob(pdfFile);
        body.pdfContent = { storageKey: pdfStorageKey, fileName: pdfFile.name };
      }

      const jobId = await submitClassroomJob(body);

      // Add to sessionStorage and local state (don't cancel existing jobs)
      const entry: StoredJobEntry = { jobId, topic };
      addActiveJobEntry(entry);

      setActiveJobs((prev) => ({
        ...prev,
        [jobId]: { jobId, topic, phase: 'submitting', step: '', progress: 0 },
      }));

      // 生成已提交，清除输入草稿避免下次进入残留
      try {
        localStorage.removeItem('requirementDraft');
      } catch {
        /* ignore */
      }

      // Create background task for multi-task tracking
      useTaskStore.getState().addTask({
        id: jobId,
        type: 'slides',
        label: `课堂: ${topic}`,
        status: 'running',
        progress: 0,
        phase: '正在提交...',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        resultRoute: '/classroom/',
        jobId,
      });

      startJobPolling(jobId, topic);
    } catch (err) {
      log.error('Error preparing generation:', err);
      setError(err instanceof Error ? err.message : t('upload.generateFailed'));
    }
  };

  // 一键生成PPT课件（跳转到 slides 页面）
  const handlePptGenerate = () => {
    if (!requirement.trim()) {
      setError(t('upload.requirementRequired'));
      return;
    }
    setError(null);
    router.push(`/sky/slides?topic=${encodeURIComponent(requirement.trim())}`);
  };

  // 模板选择
  const handleTemplateSelect = (template: CourseTemplate) => {
    setTemplatePickerOpen(false);
    const outline = template.outline
      .map((s, i) => `第${i + 1}幕：${s.title} — ${s.description || ''}`)
      .join('\n');
    const newRequirement = `${resolveLocale(template.name, locale)}\n\n课程目标：${resolveLocale(template.description, locale)}\n\n大纲：\n${outline}`;
    setRequirement(newRequirement);
    updateRequirementCache(newRequirement);
  };

  // 删除课堂
  const handleDelete = async (id: string) => {
    try {
      await deleteStageData(id);
      await loadClassrooms();
      toast.success('课堂已删除');
    } catch (err) {
      log.error('Failed to delete classroom:', err);
      toast.error('删除失败');
    }
  };

  // 重命名
  const handleRename = async (id: string, newName: string) => {
    try {
      await renameStage(id, newName);
      setClassrooms((prev) =>
        prev.map((c) => (c.id === id ? { ...c, name: newName } : c))
      );
      toast.success('重命名成功');
    } catch (err) {
      log.error('Failed to rename classroom:', err);
      toast.error('重命名失败');
    }
  };

  // 格式化日期
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('classroom.today');
    if (diffDays === 1) return t('classroom.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('classroom.daysAgo')}`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const canGenerate = !!requirement.trim();

  if (!introDone) {
    return (
      <IntroSequence onComplete={() => setIntroDone(true)} />
    );
  }

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden">
      {/* 动态天空背景 */}
      <SkyBackground />

      {/* 文件输入（用于导入） */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 悬浮答疑按钮 */}
      <DraggableQaButton />

      {/* 导航栏 */}
      <MinimalNavbar
        userSection={
          <FloatingUserCard
            onSettingsOpen={() => setSettingsOpen(true)}
            onUpgradeOpen={() => setUpgradeDialogOpen(true)}
          />
        }
      />

      {/* 对话框 */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) setSettingsSection(undefined);
        }}
        initialSection={settingsSection}
      />

      <TemplatePicker
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={handleTemplateSelect}
      />

      {user && (
        <UpgradeDialog
          open={upgradeDialogOpen}
          onClose={() => setUpgradeDialogOpen(false)}
          currentPlan={user.planType}
        />
      )}

      {/* 主内容区 */}
      <main className="relative z-10 pt-24 pb-12 px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Hero 区域 */}
          <section className="flex flex-col items-center text-center mb-12">
            {/* 动画Logo */}
            <AnimatedLogo />

            {/* 功能亮点 */}
            <div className="mt-8">
              <FeatureHighlights />
            </div>

            {/* 输入区域 */}
            <div className="mt-10 w-full">
              <HeroInput
                value={requirement}
                onChange={handleRequirementChange}
                onSubmit={handleGenerate}
                onTemplateClick={() => setTemplatePickerOpen(true)}
                pdfFile={pdfFile}
                onPdfChange={setPdfFile}
                interactiveMode={interactiveMode}
                onInteractiveModeChange={handleInteractiveModeChange}
                webSearch={webSearch}
                onWebSearchChange={handleWebSearchChange}
                canSubmit={canGenerate}
                onSettingsOpen={() => {
                  setSettingsSection('providers');
                  setSettingsOpen(true);
                }}
                selectedTeacherId={selectedTeacherId}
                selectedStudentIds={selectedStudentIds}
                onTeacherChange={setSelectedTeacherId}
                onStudentsChange={setSelectedStudentIds}
              />
            </div>

            {/* PPT课件生成入口 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-3 flex items-center justify-center gap-3"
            >
              <span className="text-xs text-slate-400">或</span>
              <button
                onClick={handlePptGenerate}
                disabled={!canGenerate}
                className={
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ' +
                  (canGenerate
                    ? 'text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20'
                    : 'text-slate-400 cursor-not-allowed')
                }
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
                生成PPT课件
              </button>
            </motion.div>

            {/* 错误提示 */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Classroom generation progress (multi-job) ── */}
            <AnimatePresence>
              {Object.values(activeJobs).map((job) => (
                <motion.div
                  key={job.jobId}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 w-full max-w-2xl mx-auto"
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/generation-progress?jobId=${job.jobId}`)}
                    className="w-full text-left rounded-2xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 shadow-lg p-5 hover:shadow-xl hover:border-sky-300 dark:hover:border-sky-700 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative flex-shrink-0">
                        {job.phase === 'reviewing' ? (
                          <div className="h-9 w-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <>
                            <div className="h-9 w-9 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                            <Sparkles className="absolute inset-0 m-auto h-4 w-4 text-sky-500" />
                          </>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-sky-700 dark:text-sky-300 truncate">
                          {job.topic}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {job.phase === 'reviewing'
                            ? `大纲已生成 · ${job.outlinesMeta?.totalScenes ?? job.outlines?.length ?? 0} 个场景 — 点击审阅`
                            : job.phase === 'submitting'
                              ? '正在提交...'
                              : job.phase === 'generating_outline'
                                ? '正在生成大纲...'
                                : job.phase === 'generating_slides'
                                  ? '正在生成幻灯片...'
                                  : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-lg font-bold text-sky-600 tabular-nums">{job.progress}%</span>
                        <svg className="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-sky-100 dark:bg-sky-900 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          job.phase === 'generating_outline' || job.phase === 'generating_slides'
                            ? 'bg-gradient-to-r from-sky-400 via-sky-300 to-sky-400 progress-bar-animated'
                            : 'bg-sky-500'
                        }`}
                        animate={{ width: `${job.progress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* 导入按钮（无课堂时） */}
            {classrooms.length === 0 && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                onClick={triggerFileSelect}
                disabled={importing}
                className="mt-6 flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <span>导入已有课堂</span>
              </motion.button>
            )}
          </section>

          {/* 用量进度（已登录） */}
          {user && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <UsageProgress />
            </motion.div>
          )}

          {/* 最近课堂 */}
          {classrooms.length > 0 && (
            <section className="mt-12">
              <ClassroomGrid
                classrooms={classrooms}
                thumbnails={thumbnails}
                formatDate={formatDate}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            </section>
          )}
        </div>
      </main>

      {/* 底部 */}
      <footer className="relative z-10 py-8 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="text-sm text-slate-400"
        >
          天空课堂 · AI 驱动的智能教学平台
        </motion.p>
      </footer>
    </div>
  );
}
