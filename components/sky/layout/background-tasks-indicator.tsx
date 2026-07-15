'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  X,
  ChevronUp,
  ChevronDown,
  Zap,
  Camera,
  Presentation,
  FileQuestion,
  PenTool,
  Languages,
  Brain,
} from 'lucide-react';
import { useTaskStore, type BackgroundTask, type TaskType } from '@/lib/store/use-task-store';

const TASK_ICONS: Record<TaskType, React.ComponentType<{ className?: string }>> = {
  solve: Camera,
  slides: Presentation,
  pptx: Presentation,
  quiz: FileQuestion,
  write: PenTool,
  translate: Languages,
  memory: Brain,
  teaching: Brain,
  general: Zap,
};

const TASK_COLORS: Record<TaskType, string> = {
  solve: 'text-violet-500',
  slides: 'text-cyan-500',
  pptx: 'text-cyan-500',
  quiz: 'text-amber-500',
  write: 'text-emerald-500',
  translate: 'text-indigo-500',
  memory: 'text-rose-500',
  teaching: 'text-purple-500',
  general: 'text-sky-500',
};

const TASK_ROUTES: Record<TaskType, string> = {
  solve: '/sky/cloud-mind/solve',
  slides: '/sky/cloud-mind',
  pptx: '/sky/cloud-mind',
  quiz: '/sky/cloud-mind/quiz',
  write: '/sky/cloud-mind',
  translate: '/sky/cloud-mind',
  memory: '/sky/cloud-mind/memory',
  teaching: '/sky/teaching',
  general: '/sky/cloud-mind',
};

function TaskItem({ task }: { task: BackgroundTask }) {
  const router = useRouter();
  const removeTask = useTaskStore((s) => s.removeTask);
  const dismissTask = useTaskStore((s) => s.dismissTask);
  const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  const Icon = TASK_ICONS[task.type] || Zap;
  const color = TASK_COLORS[task.type] || 'text-slate-500';
  const isRunning = task.status === 'running';
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';

  // Auto-dismiss completed tasks after 10 seconds
  // Timer starts when the component mounts (when user sees the notification)
  useEffect(() => {
    if (isCompleted) {
      autoDismissTimerRef.current = setTimeout(() => {
        dismissTask(task.id);
      }, 10000); // 10 seconds

      return () => {
        if (autoDismissTimerRef.current) {
          clearTimeout(autoDismissTimerRef.current);
        }
      };
    }
  }, [isCompleted, task.id, dismissTask]);

  const handleClick = () => {
    if (isCompleted) {
      const route = task.resultRoute || TASK_ROUTES[task.type];
      router.push(route);
      dismissTask(task.id);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Clear auto-dismiss timer if manually dismissed
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
    removeTask(task.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      layout
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
        isCompleted
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 cursor-pointer hover:bg-emerald-100/50 dark:hover:bg-emerald-900/20'
          : isFailed
            ? 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20'
            : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80'
      }`}
      onClick={handleClick}
    >
      <div className={`shrink-0 ${color}`}>
        {isRunning ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isCompleted ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : isFailed ? (
          <XCircle className="h-4 w-4 text-rose-500" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
          {task.label}
        </p>
        {isRunning && (
          <div className="mt-1.5">
            <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600"
                animate={{ width: `${task.progress}%` }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">{task.phase}</p>
          </div>
        )}
        {isCompleted && <p className="text-[10px] text-emerald-500 mt-0.5">点击查看详情</p>}
        {isFailed && <p className="text-[10px] text-rose-500 mt-0.5">{task.error || '任务失败'}</p>}
      </div>

      <button
        onClick={handleDismiss}
        className="shrink-0 flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-600/50 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}

export function BackgroundTasksIndicator() {
  const [expanded, setExpanded] = useState(true);
  const tasks = useTaskStore((s) => s.tasks);
  const dismissedIds = useTaskStore((s) => s.dismissedIds);
  const dismissCompletedTasks = useTaskStore((s) => s.dismissCompletedTasks);
  const pathname = usePathname();

  // Hide tasks whose resultRoute matches the current page —
  // those already have their own inline progress UI.
  const visibleTasks = Object.values(tasks).filter(
    (t) => !dismissedIds.has(t.id) && t.resultRoute !== pathname,
  );

  if (visibleTasks.length === 0) return null;

  const runningCount = visibleTasks.filter((t) => t.status === 'running').length;
  const completedCount = visibleTasks.filter(
    (t) => t.status === 'completed' || t.status === 'failed',
  ).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="fixed bottom-20 right-4 z-50 w-72"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between rounded-t-xl border border-b-0 border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl px-3 py-2"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-sky-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">后台任务</span>
          {runningCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-900/30 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              {runningCount}
            </span>
          )}
          {completedCount > 0 && (
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              {completedCount} 完成
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {completedCount > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                dismissCompletedTasks();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  dismissCompletedTasks();
                }
              }}
              className="cursor-pointer rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-600/50 transition-colors"
            >
              清除已完成
            </span>
          )}
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Task List */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden rounded-b-xl border border-t-0 border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl"
          >
            <div className="max-h-64 overflow-y-auto p-2 space-y-1.5">
              <AnimatePresence mode="popLayout">
                {visibleTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
