'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { useI18n } from '@/lib/hooks/use-i18n';
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
  pollClassroomJob,
} from '@/lib/classroom/classroom-job-client';

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
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useAuth();

  // 状态
  const [requirement, setRequirement] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [webSearch, setWebSearch] = useState(false);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Classroom background generation state ──
  const [classroomJobId, setClassroomJobId] = useState<string | null>(null);
  const [classroomPhase, setClassroomPhase] = useState<'idle' | 'submitting' | 'generating_outline' | 'reviewing' | 'generating_slides' | 'done'>('idle');
  const [classroomStep, setClassroomStep] = useState('');
  const [classroomProgress, setClassroomProgress] = useState(0);
  const [classroomOutlines, setClassroomOutlines] = useState<ClassroomJobState['outlines']>(undefined);
  const [classroomOutlinesMeta, setClassroomOutlinesMeta] = useState<ClassroomJobState['outlinesMeta']>(undefined);
  const classroomAbortRef = useRef<AbortController | null>(null);
  const outlineToastShownRef = useRef(false);

  const activeSolveTaskId = useTaskStore((s) => s.activeSolveTaskId);
  const tasks = useTaskStore((s) => s.tasks);
  const setActiveSolveTask = useTaskStore((s) => s.setActiveSolveTask);

  // ── Navigation restoration: restore classroom generation state ──
  useEffect(() => {
    const allSlidesTasks = Object.values(useTaskStore.getState().tasks).filter(
      (t) => t.type === 'slides',
    );
    const runningTasks = allSlidesTasks.filter((t) => t.status === 'running');

    // Clean up stale non-running tasks
    for (const t of allSlidesTasks) {
      if (t.status !== 'running') {
        useTaskStore.getState().removeTask(t.id);
      }
    }

    if (runningTasks.length === 0) return;

    const activeTask = runningTasks[0];
    setClassroomJobId(activeTask.jobId ?? null);

    if (activeTask.phase?.includes('审阅')) {
      setClassroomPhase('reviewing');
    } else if (activeTask.phase?.includes('大纲')) {
      setClassroomPhase('generating_outline');
    } else {
      setClassroomPhase('generating_slides');
    }
    setClassroomStep(activeTask.phase ?? '');
    setClassroomProgress(activeTask.progress ?? 0);

    // Resume polling
    if (activeTask.jobId) {
      startClassroomPoll(activeTask.jobId);
    }

    return () => {
      classroomAbortRef.current?.abort();
      classroomAbortRef.current = null;
    };
  }, []);

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

  // ── Classroom background generation ─────────────────────────────

  const startClassroomPoll = useCallback((jobId: string) => {
    // Abort any existing poll
    classroomAbortRef.current?.abort();
    const abortController = new AbortController();
    classroomAbortRef.current = abortController;

    (async () => {
      try {
        // Phase 1: generating outline
        setClassroomPhase('generating_outline');

        await pollClassroomJob(
          jobId,
          (data) => {
            // Handle cancelled
            if (data.status === 'cancelled') {
              useTaskStore.getState().removeTask(jobId);
              setClassroomPhase('idle');
              setClassroomJobId(null);
              setClassroomProgress(0);
              abortController.abort();
              return;
            }

            setClassroomStep(data.step);
            setClassroomProgress(data.progress);

            useTaskStore.getState().updateTask(
              useTaskStore.getState().tasks[jobId]?.id ?? '',
              { progress: data.progress, phase: data.message },
            );
          },
          abortController.signal,
        );

        // Check if awaiting review (poll stopped because status === 'awaiting_review')
        const statusData = await fetchClassroomJob(jobId);

        if (statusData.status === 'cancelled') {
          useTaskStore.getState().removeTask(jobId);
          setClassroomPhase('idle');
          setClassroomJobId(null);
          setClassroomProgress(0);
          return;
        }

        if (statusData.status === 'awaiting_review') {
          setClassroomOutlines(statusData.outlines ?? undefined);
          setClassroomOutlinesMeta(statusData.outlinesMeta ?? undefined);
          setClassroomPhase('reviewing');

          // Show toast only once per generation session
          if (!outlineToastShownRef.current) {
            outlineToastShownRef.current = true;
            toast.success('大纲已生成！', {
              description: `共 ${statusData.outlines?.length ?? 0} 个场景，点击查看`,
              action: {
                label: '查看大纲',
                onClick: () => router.push(`/generation-progress?jobId=${jobId}`),
              },
              duration: 10000,
            });
          }
          return;
        }

        // Or done
        if (statusData.done && statusData.result) {
          setClassroomPhase('done');
          handleClassroomComplete(statusData.result, jobId);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        log.error('Classroom poll error:', err);
        setError(err instanceof Error ? err.message : '课堂生成失败');
        setClassroomPhase('idle');
        setClassroomJobId(null);
      }
    })();
  }, []);

  const handleClassroomComplete = useCallback(
    (result: NonNullable<ClassroomJobState['result']>, taskId: string) => {
      useTaskStore.getState().updateTask(taskId, {
        status: 'completed',
        progress: 100,
        phase: '课堂生成完成',
        result,
      });
      router.push(`/classroom/${result.classroomId}`);
    },
    [router],
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

    try {
      // Cancel previous classroom generation if any
      if (classroomAbortRef.current) {
        classroomAbortRef.current.abort();
        classroomAbortRef.current = null;
      }

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

      setClassroomPhase('submitting');
      outlineToastShownRef.current = false;

      const jobId = await submitClassroomJob(body);
      setClassroomJobId(jobId);

      // Create background task for multi-task tracking
      const taskId = jobId;
      useTaskStore.getState().addTask({
        id: taskId,
        type: 'slides',
        label: `课堂: ${requirement.slice(0, 20)}${requirement.length > 20 ? '...' : ''}`,
        status: 'running',
        progress: 0,
        phase: '正在提交...',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        resultRoute: '/classroom/',
        jobId,
      });

      startClassroomPoll(jobId);
    } catch (err) {
      log.error('Error preparing generation:', err);
      setError(err instanceof Error ? err.message : t('upload.generateFailed'));
      setClassroomPhase('idle');
    }
  };

  // 模板选择
  const handleTemplateSelect = (template: CourseTemplate) => {
    setTemplatePickerOpen(false);
    const outline = template.outline
      .map((s, i) => `第${i + 1}幕：${s.title} — ${s.description || ''}`)
      .join('\n');
    const newRequirement = `${template.nameZh}\n\n课程目标：${template.description}\n\n大纲：\n${outline}`;
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

            {/* ── Classroom generation progress ── */}
            <AnimatePresence>
              {classroomPhase !== 'idle' && classroomPhase !== 'done' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-6 w-full max-w-2xl mx-auto"
                >
                  <button
                    type="button"
                    onClick={() => classroomJobId && router.push(`/generation-progress?jobId=${classroomJobId}`)}
                    className="w-full text-left rounded-2xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 shadow-lg p-6 hover:shadow-xl hover:border-sky-300 dark:hover:border-sky-700 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
                        <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-sky-500" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sky-700 dark:text-sky-300">
                          {classroomPhase === 'reviewing'
                            ? '大纲已生成，点击查看'
                            : classroomPhase === 'submitting'
                              ? '正在提交...'
                              : classroomPhase === 'generating_outline'
                                ? '正在生成大纲...'
                                : '正在生成幻灯片...'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {classroomPhase === 'reviewing'
                            ? `共 ${classroomOutlinesMeta?.totalScenes ?? classroomOutlines?.length ?? 0} 个场景 — 点击进入审阅`
                            : classroomStep || '后台处理中，可自由切换页面 — 点击查看详情'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-sky-600">{classroomProgress}%</span>
                        <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="mt-4 h-1.5 rounded-full bg-sky-100 dark:bg-sky-900 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-sky-500"
                        animate={{ width: `${classroomProgress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </button>
                </motion.div>
              )}
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
