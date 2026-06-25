'use client';

import { useCallback, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Cpu,
  MousePointer2,
  PanelLeftClose,
  PieChart,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store';
import { PENDING_SCENE_ID } from '@/lib/store/stage';
import type { SceneType } from '@/lib/types/stage';

interface SceneSidebarProps {
  readonly collapsed: boolean;
  readonly onCollapseChange: (collapsed: boolean) => void;
  readonly onSceneSelect?: (sceneId: string) => void;
  readonly onRetryOutline?: (outlineId: string) => Promise<void>;
  readonly isCourseComplete?: boolean;
}

const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 280;
const MAX_WIDTH = 360;

function getSceneTypeIcon(type: SceneType) {
  const icons = {
    slide: BookOpen,
    quiz: PieChart,
    interactive: MousePointer2,
    pbl: Cpu,
  };
  return icons[type] || BookOpen;
}

export function SceneSidebar({
  collapsed,
  onCollapseChange,
  onSceneSelect,
  onRetryOutline,
  isCourseComplete,
}: SceneSidebarProps) {
  const { scenes, currentSceneId, setCurrentSceneId, generatingOutlines, generationStatus } =
    useStageStore();
  const failedOutlines = useStageStore.use.failedOutlines();

  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [retryingOutlineId, setRetryingOutlineId] = useState<string | null>(null);
  const isDraggingRef = useRef(false);

  const selectScene = useCallback(
    (sceneId: string) => {
      if (onSceneSelect) onSceneSelect(sceneId);
      else setCurrentSceneId(sceneId);
    },
    [onSceneSelect, setCurrentSceneId],
  );

  const handleRetryOutline = async (outlineId: string) => {
    if (!onRetryOutline) return;
    setRetryingOutlineId(outlineId);
    try {
      await onRetryOutline(outlineId);
    } finally {
      setRetryingOutlineId(null);
    }
  };

  const handleDragStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      isDraggingRef.current = true;
      const startX = event.clientX;
      const startWidth = sidebarWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta)));
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [sidebarWidth],
  );

  const displayWidth = collapsed ? 0 : sidebarWidth;
  const currentIndex = scenes.findIndex((scene) => scene.id === currentSceneId);

  return (
    <aside
      style={{
        width: displayWidth,
        transition: isDraggingRef.current ? 'none' : 'width 220ms ease',
      }}
      className={cn(
        'absolute bottom-4 left-4 top-4 z-50 flex shrink-0 flex-col overflow-visible rounded-[26px] border border-white/80 bg-white/76 shadow-[0_24px_70px_rgba(14,116,144,0.18)] backdrop-blur-2xl dark:border-slate-800 dark:bg-slate-950/86',
        collapsed && 'pointer-events-none border-transparent bg-transparent shadow-none',
      )}
    >
      {!collapsed && (
        <div
          onMouseDown={handleDragStart}
          className="group absolute bottom-0 right-0 top-0 z-50 w-1 cursor-col-resize"
        />
      )}

      <div className={cn('flex h-full w-full flex-col overflow-hidden', collapsed && 'hidden')}>
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sky-100/80 px-4 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700/55">
              Slide Map
            </div>
            <div className="mt-0.5 truncate text-sm font-black text-slate-950 dark:text-slate-100">
              幻灯片目录
            </div>
          </div>
          <button
            type="button"
            onClick={() => onCollapseChange(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-sky-700 transition-colors hover:bg-white/80 hover:text-sky-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label="Close slide map"
            title="Close slide map"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pt-4">
          <div className="mx-auto h-1 w-full overflow-hidden rounded-full bg-sky-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-sky-500 transition-all dark:bg-sky-300"
              style={{
                width: `${Math.max(5, ((currentIndex + 1) / Math.max(scenes.length, 1)) * 100)}%`,
              }}
            />
          </div>
          <div className="mt-2 text-center text-[10px] font-semibold text-sky-700/60 dark:text-slate-400">
            {currentIndex >= 0 ? currentIndex + 1 : '-'} / {Math.max(scenes.length, 1)}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 scrollbar-hide">
          <div className="space-y-2">
            {scenes.map((scene, index) => {
              const isActive = currentSceneId === scene.id;
              const Icon = getSceneTypeIcon(scene.type);

              return (
                <button
                  key={scene.id}
                  type="button"
                  data-testid="scene-item"
                  onClick={() => selectScene(scene.id)}
                  title={scene.title}
                  className={cn(
                    'group flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-all duration-200',
                    isActive
                      ? 'bg-sky-500 text-white shadow-sm dark:bg-sky-300 dark:text-slate-950'
                      : 'text-sky-800/70 hover:bg-white/72 hover:text-sky-950 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100',
                  )}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/62 text-[11px] font-bold tabular-nums text-sky-900 group-hover:bg-white dark:bg-slate-900 dark:text-slate-300">
                    <span>{(index + 1).toString().padStart(2, '0')}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      data-testid="scene-title"
                      className="block truncate text-sm font-semibold"
                    >
                      {scene.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] opacity-65">
                      <Icon className="h-3 w-3" />
                      {scene.type}
                    </span>
                  </span>
                </button>
              );
            })}

            {generatingOutlines.length > 0 &&
              (() => {
                const outline = generatingOutlines[0];
                const isFailed = failedOutlines.some((failed) => failed.id === outline.id);
                const isRetrying = retryingOutlineId === outline.id;
                const isPaused = generationStatus === 'paused';
                const isActive = currentSceneId === PENDING_SCENE_ID;

                return (
                  <button
                    key={`generating-${outline.id}`}
                    type="button"
                    title={outline.title}
                    onClick={() => {
                      if (!isFailed) selectScene(PENDING_SCENE_ID);
                    }}
                    className={cn(
                      'flex h-12 w-full items-center justify-center rounded-2xl transition-all duration-200',
                      isFailed
                        ? 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-300'
                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
                      isActive &&
                        !isFailed &&
                        'bg-sky-500 text-white dark:bg-sky-300 dark:text-slate-950',
                    )}
                  >
                    {isFailed && onRetryOutline ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRetryOutline(outline.id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            handleRetryOutline(outline.id);
                          }
                        }}
                        title="Retry"
                      >
                        <RefreshCw className={cn('h-4 w-4', isRetrying && 'animate-spin')} />
                      </span>
                    ) : isFailed ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <RefreshCw className={cn('h-4 w-4', !isPaused && 'animate-spin')} />
                    )}
                  </button>
                );
              })()}

            {isCourseComplete && generatingOutlines.length === 0 && (
              <button
                type="button"
                onClick={() => selectScene(PENDING_SCENE_ID)}
                className={cn(
                  'flex h-12 w-full items-center justify-center rounded-2xl transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/20',
                  currentSceneId === PENDING_SCENE_ID &&
                    'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-200',
                )}
                title="Complete"
              >
                <Trophy className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
