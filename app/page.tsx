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

import dynamic from 'next/dynamic';

import { DraggableQaButton } from '@/components/draggable-qa-button';

// 轻量组件 — 同步导入
import { SkyBackground } from '@/components/sky/home/sky-background';
import { MinimalNavbar } from '@/components/sky/home/minimal-navbar';
import { FloatingUserCard } from '@/components/sky/home/floating-user-card';
import { HeroInput } from '@/components/sky/home/hero-input';
import { ClassroomGrid } from '@/components/sky/home/classroom-grid';
import { GreetingSection } from '@/components/sky/home/greeting-section';
import { QuickAccessGrid } from '@/components/sky/home/quick-access-grid';
import { FeaturedSection } from '@/components/sky/home/featured-section';
import type { SettingsSection } from '@/lib/types/settings';

// 重型组件 — 懒加载
const SettingsDialog = dynamic(() => import('@/components/settings').then(m => ({ default: m.SettingsDialog })));
const TemplatePicker = dynamic(() => import('@/components/templates/template-picker').then(m => ({ default: m.TemplatePicker })));
const UpgradeDialog = dynamic(() => import('@/components/billing/upgrade-dialog').then(m => ({ default: m.UpgradeDialog })));
const IntroSequence = dynamic(() => import('@/components/sky/home/intro-sequence').then(m => ({ default: m.IntroSequence })));
const FloatingParticles = dynamic(() => import('@/components/sky/home/floating-particles').then(m => ({ default: m.FloatingParticles })));

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
  const [introDone, setIntroDone] = useState<boolean>(false);

  useEffect(() => {
    if (sessionStorage.getItem('introDone') === 'true') {
      setIntroDone(true);
    }
  }, []);

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
  const startJobPolling = useCallback((jobId: string, topic: string) => {
    abortRefs.current.get(jobId)?.abort();
    const abortController = new AbortController();
    abortRefs.current.set(jobId, abortController);

    (async () => {
      try {
        setActiveJobs((prev) => ({
          ...prev,
          [jobId]: { jobId, topic, phase: 'generating_outline', step: '', progress: 0 },
        }));

        while (!abortController.signal.aborted) {
          const data = await fetchClassroomJob(jobId);
          if (!data) {
            // Job no longer exists (404) — clean up silently
            removeActiveJobEntry(jobId);
            abortRefs.current.delete(jobId);
            setActiveJobs((prev) => {
              const next = { ...prev };
              delete next[jobId];
              return next;
            });
            return;
          }
          if (abortController.signal.aborted) return;

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
      const topic = task.label?.replace(/^课堂:\s*/, '') || '';
      const isReviewing = task.phase?.includes('审阅');

      setActiveJobs((prev) => ({
        ...prev,
        [jobId]: {
          jobId,
          topic,
          phase: isReviewing ? 'reviewing' : task.phase?.includes('大纲') ? 'generating_outline' : 'generating_slides',
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
          if (!data) {
            removeActiveJobEntry(entry.jobId);
            return;
          }

          if (data.status === 'cancelled' || data.status === 'failed' || (data.done && data.status === 'succeeded')) {
            removeActiveJobEntry(entry.jobId);
            return;
          }

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
              topicSummary: data.topicSummary,
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
  const { cachedValue: cachedRequirement, updateCache: updateRequirementCache } =
    useDraftCache<string>({ key: 'requirementDraft' });

  const { importing, fileInputRef, triggerFileSelect, handleFileChange } =
    useImportClassroom(() => loadClassrooms());

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
        resultRoute: '/classroom/',
        jobId,
      });

      startJobPolling(jobId, topic);
    } catch (err) {
      log.error('Error preparing generation:', err);
      setError(err instanceof Error ? err.message : t('upload.generateFailed'));
    }
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
  const formatDate = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('classroom.today');
    if (diffDays === 1) return t('classroom.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('classroom.daysAgo')}`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }, [t]);

  const canGenerate = !!requirement.trim();

  if (!introDone) {
    return (
      <IntroSequence onComplete={() => {
        sessionStorage.setItem('introDone', 'true');
        setIntroDone(true);
      }} />
    );
  }

  return (
    <div suppressHydrationWarning className="min-h-screen w-full relative overflow-x-hidden">
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
      <main className="relative z-10 pt-20 pb-12 px-4 md:px-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* 问候语 */}
          <GreetingSection />

          {/* 天穹讲课标题 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="relative flex flex-col items-center py-3"
          >
            {/* 背景光晕 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-24 rounded-full bg-gradient-to-r from-sky-400/8 via-blue-500/12 to-indigo-400/8 blur-3xl" />
            </div>

            <div className="relative flex items-center gap-4">
              {/* 左侧装饰 */}
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-1.5 h-1.5 rounded-full bg-sky-400"
                />
                <div className="w-10 h-px bg-gradient-to-r from-transparent to-sky-300 dark:to-sky-600" />
                <svg className="w-5 h-5 text-sky-400/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>

              {/* 标题主体 */}
              <div className="flex flex-col items-center">
                <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 dark:from-sky-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent tracking-wider">
                  天穹讲课
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-6 h-px bg-gradient-to-r from-transparent to-sky-300 dark:to-sky-700" />
                  <Sparkles className="w-3 h-3 text-sky-400/60" />
                  <div className="w-6 h-px bg-gradient-to-l from-transparent to-sky-300 dark:to-sky-700" />
                </div>
              </div>

              {/* 右侧装饰 */}
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-400/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
                </svg>
                <div className="w-10 h-px bg-gradient-to-l from-transparent to-indigo-300 dark:to-indigo-600" />
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 3, repeat: Infinity, delay: 1.5 }}
                  className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                />
              </div>
            </div>

            <p className="relative text-xs text-slate-400 dark:text-slate-500 mt-2 tracking-widest">
              AI 驱动 · 智能教学 · 无限可能
            </p>
          </motion.div>

          {/* 输入区域 */}
          <div className="w-full">
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

          {/* 快捷入口 */}
          <div className="w-full">
            <QuickAccessGrid />
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



          {/* 最近课堂 */}
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
            天空课堂
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            AI 驱动的智能教学平台 · 让学习更有趣
          </p>
          <p className="text-[11px] text-slate-300 dark:text-slate-600">
            &copy; {new Date().getFullYear()} Sky Classroom. All rights reserved.
          </p>
          <button
            onClick={() => {
              sessionStorage.removeItem('introDone');
              setIntroDone(false);
            }}
            className="text-[10px] text-slate-400/50 hover:text-slate-500 dark:hover:text-slate-400 transition-colors mt-1"
          >
            重置开场动画
          </button>
        </motion.div>
      </footer>
    </div>
  );
}
