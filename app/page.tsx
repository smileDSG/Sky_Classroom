'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { resolveLocale } from '@/lib/templates/types';
import { useAuth } from '@/components/auth/auth-provider';
import { useUserProfileStore } from '@/lib/store/user-profile';
import { useSettingsStore } from '@/lib/store/settings';
import { useMediaGenerationStore } from '@/lib/store/media-generation';
import { useTaskStore } from '@/lib/store/use-task-store';
import { useDraftCache } from '@/lib/hooks/use-draft-cache';
import { isDocumentVisible } from '@/lib/hooks/use-document-visibility';
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
import { resolveChatModelSelection } from '@/lib/utils/model-config';
import type { ProviderId } from '@/lib/ai/providers';
import type { Slide } from '@/lib/types/slides';
import type { CourseTemplate } from '@/lib/templates/types';

import dynamic from 'next/dynamic';

import { DraggableQaButton } from '@/components/draggable-qa-button';

// 轻量组件 — 同步导入
import { SkyBackground } from '@/components/sky/home/sky-background';
import { MinimalNavbar } from '@/components/sky/home/minimal-navbar';
import { FloatingUserCard } from '@/components/sky/home/floating-user-card';
import { HeroInput } from '@/components/sky/home/hero-input';
import { GreetingSection } from '@/components/sky/home/greeting-section';
import { PageTour } from '@/components/sky/tour/page-tour';
import { HOME_TOUR_SEEN_KEY } from '@/lib/sky/home-tour';
import type { SettingsSection } from '@/lib/types/settings';

// 折页下方 / 非首屏区块 — 按需加载，加快首屏解析
const LearningPlanPreview = dynamic(() =>
  import('@/components/sky/home/learning-plan-preview').then((m) => ({
    default: m.LearningPlanPreview,
  })),
);
const SkyWorkspacePortals = dynamic(() =>
  import('@/components/sky/home/workspace-portals').then((m) => ({
    default: m.SkyWorkspacePortals,
  })),
);
const FeaturedSection = dynamic(() =>
  import('@/components/sky/home/featured-section').then((m) => ({
    default: m.FeaturedSection,
  })),
);

// 重型组件 — 懒加载
const SettingsDialog = dynamic(() =>
  import('@/components/settings').then((m) => ({ default: m.SettingsDialog })),
);
const TemplatePicker = dynamic(() =>
  import('@/components/templates/template-picker').then((m) => ({ default: m.TemplatePicker })),
);
const UpgradeDialog = dynamic(() =>
  import('@/components/billing/upgrade-dialog').then((m) => ({ default: m.UpgradeDialog })),
);
const ClassroomGrid = dynamic(
  () => import('@/components/sky/home/classroom-grid').then((m) => ({ default: m.ClassroomGrid })),
  {
    ssr: false,
    loading: () => <div className="min-h-48 w-full animate-pulse rounded-2xl bg-white/40" />,
  },
);
const FloatingParticles = dynamic(() =>
  import('@/components/sky/home/floating-particles').then((m) => ({
    default: m.FloatingParticles,
  })),
);

const log = createLogger('Home');

const WEB_SEARCH_STORAGE_KEY = 'webSearchEnabled';
const INTERACTIVE_MODE_STORAGE_KEY = 'interactiveModeEnabled';
const CLASSROOM_POLL_INTERVAL_MS = 1500;
const CLASSROOM_POLL_MAX_RETRY_MS = 8000;

function waitForClassroomPoll(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}

// ── Classroom background job API helpers ──────────────────────────

import {
  type ClassroomJobState,
  submitClassroomJob,
  fetchClassroomJob,
  isClassroomPollAbort,
  isTransientClassroomPollError,
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

import { SkyLandingPage } from '@/components/sky/auth/sky-landing-page';

export default function HomePage() {
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (!user || user.role === 'guest') {
    return <SkyLandingPage />;
  }

  return <HomeApp />;
}

function HomeApp() {
  const router = useRouter();
  const { user } = useAuth();

  // 状态
  const [requirement, setRequirement] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Classroom background generation state (multi-job) ──
  interface JobCardState {
    jobId: string;
    topic: string;
    topicSummary?: string;
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
  const startJobPolling = useCallback(
    (jobId: string, topic: string) => {
      abortRefs.current.get(jobId)?.abort();
      const abortController = new AbortController();
      abortRefs.current.set(jobId, abortController);

      (async () => {
        try {
          setActiveJobs((prev) => ({
            ...prev,
            [jobId]: { jobId, topic, phase: 'generating_outline', step: '', progress: 0 },
          }));

          let transientPollFailures = 0;
          while (!abortController.signal.aborted) {
            // Pause network polling while the tab is hidden/backgrounded.
            if (!isDocumentVisible()) {
              await waitForClassroomPoll(1000, abortController.signal);
              continue;
            }
            let data: ClassroomJobState | null;
            try {
              data = await fetchClassroomJob(jobId, abortController.signal);
              transientPollFailures = 0;
            } catch (err) {
              if (abortController.signal.aborted || isClassroomPollAbort(err)) return;

              if (isTransientClassroomPollError(err)) {
                transientPollFailures += 1;
                if (transientPollFailures === 1 || transientPollFailures % 5 === 0) {
                  log.warn(
                    'Classroom poll temporarily failed; retrying:',
                    err instanceof Error ? err.message : err,
                  );
                }
                await waitForClassroomPoll(
                  Math.min(CLASSROOM_POLL_MAX_RETRY_MS, 1000 + transientPollFailures * 1000),
                  abortController.signal,
                );
                continue;
              }

              throw err;
            }
            if (abortController.signal.aborted) return;
            if (!data) return;

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
                  topicSummary: data.topicSummary ?? existing.topicSummary,
                },
              };
            });

            useTaskStore.getState().updateTask(useTaskStore.getState().tasks[jobId]?.id ?? '', {
              progress: data.progress,
              phase: data.message,
              ...(data.status === 'awaiting_review'
                ? { status: 'completed' as const, progress: 100 }
                : {}),
            });

            await waitForClassroomPoll(CLASSROOM_POLL_INTERVAL_MS, abortController.signal);
          }
        } catch (err) {
          if (abortController.signal.aborted) return;
          if (isClassroomPollAbort(err)) return;

          // If job not found (404), silently clean up
          const isNotFound = err instanceof Error && err.message.includes('not found');
          if (isNotFound) {
            log.info('Classroom job not found, cleaning up:', jobId);
          } else {
            log.error('Classroom poll error:', err);
            setError(err instanceof Error ? err.message : '课堂生成失败');
          }

          removeActiveJobEntry(jobId);
          useTaskStore.getState().removeTask(jobId);
          abortRefs.current.delete(jobId);
          setActiveJobs((prev) => {
            const next = { ...prev };
            delete next[jobId];
            return next;
          });
        }
      })();
    },
    [jobStatusToPhase, handleClassroomComplete],
  );

  // ── Navigation restoration: restore classroom generation state from task store ──
  useEffect(() => {
    const allSlidesTasks = Object.values(useTaskStore.getState().tasks).filter(
      (t) => t.type === 'slides',
    );

    for (const t of allSlidesTasks) {
      if (t.status !== 'running') {
        useTaskStore.getState().removeTask(t.id);
      }
    }

    const runningTasks = allSlidesTasks.filter((t) => t.status === 'running');
    if (runningTasks.length === 0) return;

    for (const task of runningTasks) {
      if (!task.jobId) continue;
      const jobId = task.jobId;
      const topic = task.label?.replace(/^(?:课堂|讲解):\s*/, '') || '';
      const isReviewing = task.phase?.includes('审阅');

      setActiveJobs((prev) => ({
        ...prev,
        [jobId]: {
          jobId,
          topic,
          phase: isReviewing
            ? 'reviewing'
            : task.phase?.includes('大纲')
              ? 'generating_outline'
              : 'generating_slides',
          step: task.phase ?? '',
          progress: task.progress ?? 0,
        },
      }));

      startJobPolling(jobId, topic);
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
          if (!data) return;

          if (data.status === 'cancelled' || data.status === 'failed') {
            removeActiveJobEntry(entry.jobId);
            return;
          }
          // Don't remove completed entries here — let ClassroomJobPoller
          // show a dialog on other pages. Home page handles via startJobPolling.

          const phase =
            data.status === 'awaiting_review'
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
              topicSummary: data.topicSummary,
            },
          }));

          useTaskStore.getState().updateTask(entry.jobId, {
            progress: data.status === 'awaiting_review' ? 100 : data.progress,
            phase: data.message,
            ...(data.status === 'awaiting_review' ? { status: 'completed' as const } : {}),
          });

          startJobPolling(entry.jobId, topic);
        } catch {
          // Job file may not exist yet — ignore
        }
      })();
    }
  }, [startJobPolling]);

  // 老师和学生选择状态
  const [selectedTeacherId, setSelectedTeacherId] = useState('default-1');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([
    'default-3',
    'default-4',
    'default-5',
  ]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection | undefined>();
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  const [classrooms, setClassrooms] = useState<StageListItem[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, Slide>>({});
  const thumbnailsRef = useRef<Record<string, Slide>>({});

  const { cachedValue: cachedRequirement, updateCache: updateRequirementCache } =
    useDraftCache<string>({ key: 'requirementDraft' });

  // 草稿恢复
  const draftRestoredRef = useRef(false);
  useEffect(() => {
    if (draftRestoredRef.current) return;
    if (!cachedRequirement) return;
    draftRestoredRef.current = true;
    setRequirement(cachedRequirement);
  }, [cachedRequirement]);

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
  const loadClassrooms = useCallback(async () => {
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
  }, []);

  const { importing, fileInputRef, triggerFileSelect, handleFileChange } = useImportClassroom(() =>
    loadClassrooms(),
  );

  useEffect(() => {
    // 清理媒体存储
    useMediaGenerationStore.getState().revokeObjectUrls();
    useMediaGenerationStore.setState({ tasks: {} });

    loadClassrooms();

    return () => {
      revokeThumbnailSlideMediaUrls(thumbnailsRef.current);
      thumbnailsRef.current = {};
    };
  }, [loadClassrooms]);

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
    [updateRequirementCache],
  );

  // 生成
  const handleGenerate = async () => {
    if (!requirement.trim()) {
      setError('请输入课程内容或想学习的知识点');
      return;
    }

    setError(null);

    const topic =
      requirement.trim().length > 40 ? `${requirement.trim().slice(0, 37)}...` : requirement.trim();

    try {
      // Sync agent selections
      useSettingsStore.getState().setSelectedAgentIds([selectedTeacherId, ...selectedStudentIds]);

      // Build job body with model config from client settings
      const settings = useSettingsStore.getState();
      const selection = resolveChatModelSelection(
        (settings.providerId || 'openai') as ProviderId,
        settings.modelId || 'gpt-5.5',
      );
      const modelString = `${selection.providerId}:${selection.modelId}`;
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

      // Clear input draft after submission
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
        resultRoute: `/generation-progress?jobId=${jobId}`,
        jobId,
      });

      startJobPolling(jobId, topic);
    } catch (err) {
      log.error('Error preparing generation:', err);
      const msg = err instanceof Error ? err.message : '生成讲解失败，请重试';
      // If user not found in DB (stale JWT after DB reset), redirect to login
      if (msg === 'User not found' || msg.includes('Not authenticated')) {
        toast.error('登录已过期，请重新登录');
        router.push('/auth/login');
        return;
      }
      setError(msg);
    }
  };

  // 模板选择
  const handleTemplateSelect = (template: CourseTemplate) => {
    setTemplatePickerOpen(false);
    const outline = template.outline
      .map((s, i) => `第${i + 1}幕：${s.title} — ${s.description || ''}`)
      .join('\n');
    const newRequirement = `${resolveLocale(template.name, 'zh-CN')}\n\n课程目标：${resolveLocale(template.description, 'zh-CN')}\n\n大纲：\n${outline}`;
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
      setClassrooms((prev) => prev.map((c) => (c.id === id ? { ...c, name: newName } : c)));
      toast.success('重命名成功');
    } catch (err) {
      log.error('Failed to rename classroom:', err);
      toast.error('重命名失败');
    }
  };

  // 格式化日期
  const formatDate = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} ${'天前'}`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }, []);

  const canGenerate = !!requirement.trim();

  return (
    <div suppressHydrationWarning className="min-h-screen w-full relative overflow-x-hidden">
      {/* 动态天空背景 */}
      <SkyBackground />

      {/* 首次进入的分步高亮引导 */}
      <PageTour id="home" />

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
        userSection={<FloatingUserCard onUpgradeOpen={() => setUpgradeDialogOpen(true)} />}
      />

      {/* 对话框 */}
      {settingsOpen && (
        <SettingsDialog
          open
          onOpenChange={(open) => {
            setSettingsOpen(open);
            if (!open) setSettingsSection(undefined);
          }}
          initialSection={settingsSection}
        />
      )}

      {templatePickerOpen && (
        <TemplatePicker
          open
          onClose={() => setTemplatePickerOpen(false)}
          onSelect={handleTemplateSelect}
        />
      )}

      {user && upgradeDialogOpen && (
        <UpgradeDialog
          open
          onClose={() => setUpgradeDialogOpen(false)}
          currentPlan={user.planType}
        />
      )}

      {/* 主内容区 */}
      <main className="relative z-10 pt-20 pb-12 px-4 md:px-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* 问候语 */}
          <GreetingSection />

          <div className="flex items-center gap-2 px-1 py-1 sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
              <motion.span
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400"
              />
              <span
                className="h-px w-8 bg-gradient-to-r from-transparent to-sky-300 dark:to-sky-600 sm:w-10"
                aria-hidden="true"
              />
              <svg
                className="h-5 w-5 shrink-0 text-sky-400/70"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-400/15 dark:text-sky-200">
                <GraduationCap className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h2 className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 bg-clip-text text-center text-xl font-bold tracking-tight text-transparent dark:from-sky-300 dark:via-blue-300 dark:to-indigo-300">
                  智眸无界
                </h2>
                <p className="mt-0.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
                  输入知识点，生成专属互动课堂
                </p>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <svg
                className="h-5 w-5 shrink-0 text-indigo-400/70"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
              </svg>
              <span
                className="h-px w-8 bg-gradient-to-l from-transparent to-indigo-300 dark:to-indigo-600 sm:w-10"
                aria-hidden="true"
              />
              <motion.span
                animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400"
              />
            </div>
          </div>

          {/* 输入区域 */}
          <div className="w-full" data-tour-step="hero-input">
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

          {/* ── Classroom generation progress (multi-job) ── */}
          <AnimatePresence>
            {Object.values(activeJobs).map((job) => (
              <motion.div
                key={job.jobId}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full max-w-2xl mx-auto"
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
                          <svg
                            className="h-5 w-5 text-green-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
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
                        {job.topicSummary || job.topic}
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
                      <span className="text-lg font-bold text-sky-600 tabular-nums">
                        {job.progress}%
                      </span>
                      <svg
                        className="h-4 w-4 text-sky-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
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

          {/* 个性化计划预览：不抢占知识点讲解主入口，只承接已有学习记录。 */}
          <LearningPlanPreview />

          {/* 三大工作区入口 */}
          <div data-tour-step="workspace-portals">
            <SkyWorkspacePortals />
          </div>

          {/* 精选推荐 + 趣味内容 */}
          <FeaturedSection />

          {/* 错误提示 */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div data-tour-step="classroom-grid">
            {/* 导入按钮（无课堂时） */}
            {classrooms.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-center"
              >
                <button
                  onClick={triggerFileSelect}
                  disabled={importing}
                  className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <span>导入已有课堂</span>
                </button>
              </motion.div>
            )}

            {/* 最近讲解 */}
            {classrooms.length > 0 && (
              <section>
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
        </div>
      </main>

      {/* 装饰粒子 */}
      <FloatingParticles />

      {/* 底部 */}
      <footer className="relative z-10 py-10 text-center">
        {/* 分隔线 */}
        <div className="max-w-xs mx-auto mb-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-700" />
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400/50" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-700" />
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="space-y-2"
        >
          <p className="text-sm font-medium bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 bg-clip-text text-transparent">
            智眸无界
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            AI 驱动的互动课堂 · 让学习更有趣
          </p>
          <p className="text-[11px] text-slate-300 dark:text-slate-600">
            &copy; 2026 Sky Classroom. All rights reserved.
          </p>
        </motion.div>
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.removeItem(HOME_TOUR_SEEN_KEY);
              window.location.reload();
            } catch {
              /* ignore */
            }
          }}
          className="mt-6 text-[10px] text-slate-400/50 transition-colors hover:text-slate-500 dark:hover:text-slate-400"
        >
          重新播放引导
        </button>
      </footer>
    </div>
  );
}
