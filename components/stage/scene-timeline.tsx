'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Trophy,
  AlertCircle,
  RefreshCw,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThumbnailSlide } from '@/components/slide-renderer/components/ThumbnailSlide';
import { ThumbnailInteractive } from '@/components/slide-renderer/components/ThumbnailInteractive';
import { useStageStore, useCanvasStore } from '@/lib/store';
import { PENDING_SCENE_ID } from '@/lib/store/stage';
import type { SceneType, SlideContent, InteractiveContent } from '@/lib/types/stage';

interface SceneTimelineProps {
  readonly collapsed: boolean;
  readonly onCollapseChange: (collapsed: boolean) => void;
  readonly onSceneSelect?: (sceneId: string) => void;
  readonly onRetryOutline?: (outlineId: string) => Promise<void>;
  readonly isCourseComplete?: boolean;
}

const THUMBNAIL_WIDTH = 120;
const THUMBNAIL_HEIGHT = 68;
const GAP = 12;
const COMPACT_GAP = 8;
const CONTAINER_HEIGHT = 90; // 增加高度容纳标题+缩略图+padding
const COMPACT_HEIGHT = 40; // 紧凑模式也稍微高一点
const DOT_SIZE = 20; // w-5 h-5 = 20px

export function SceneTimeline({
  collapsed,
  onCollapseChange,
  onSceneSelect,
  onRetryOutline,
  isCourseComplete,
}: SceneTimelineProps) {
  const { scenes, currentSceneId, setCurrentSceneId, generatingOutlines, generationStatus } =
    useStageStore();
  const failedOutlines = useStageStore.use.failedOutlines();
  const viewportSize = useCanvasStore.use.viewportSize();
  const viewportRatio = useCanvasStore.use.viewportRatio();

  const [retryingOutlineId, setRetryingOutlineId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRetryOutline = async (outlineId: string) => {
    if (!onRetryOutline) return;
    setRetryingOutlineId(outlineId);
    try {
      await onRetryOutline(outlineId);
    } finally {
      setRetryingOutlineId(null);
    }
  };

  // Wheel scroll handler - converts vertical wheel to horizontal scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!containerRef.current) return;
    // Prevent default vertical scroll
    e.preventDefault();
    // Scroll horizontally by the delta (use deltaY for natural feel)
    containerRef.current.scrollLeft += e.deltaY;
  }, []);

  // Calculate widths based on mode
  const compactItemWidth = DOT_SIZE + COMPACT_GAP; // 20 + 6 = 26px per item (including connector)
  const fullItemWidth = useState(() => {
    const allTitles = [
      ...scenes.map((s) => s.title),
      ...generatingOutlines.map((o) => o.title),
    ];
    if (isCourseComplete && generatingOutlines.length === 0) {
      allTitles.push('课程完成');
    }
    if (allTitles.length === 0) return 100;
    const longest = allTitles.reduce((a, b) => (a.length >= b.length ? a : b));
    let width = 0;
    for (const ch of longest) {
      width += /[一-鿿　-〿＀-￯]/.test(ch) ? 10 : 6;
    }
    return Math.max(width + 28, THUMBNAIL_WIDTH);
  })[0];

  const itemWidth = collapsed ? compactItemWidth : fullItemWidth;
  const totalItems =
    scenes.length +
    generatingOutlines.length +
    (isCourseComplete && generatingOutlines.length === 0 ? 1 : 0);
  const containerWidth = totalItems * itemWidth + (collapsed ? 0 : 16); // padding

  const renderThumbnail = (scene: { type: SceneType; content?: unknown }) => {
    const isSlide = scene.type === 'slide';
    const isInteractive = scene.type === 'interactive';
    const slideContent = isSlide ? (scene.content as SlideContent) : null;
    const interactiveContent = isInteractive ? (scene.content as InteractiveContent) : null;

    if (isSlide && slideContent) {
      return (
        <ThumbnailSlide
          slide={slideContent.canvas}
          viewportSize={viewportSize}
          viewportRatio={viewportRatio}
          size={THUMBNAIL_WIDTH}
        />
      );
    }

    if (scene.type === 'quiz') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 p-1.5 flex flex-col">
          <div className="h-1 w-3/5 bg-orange-200/70 dark:bg-orange-700/30 rounded-full mb-1" />
          <div className="flex-1 grid grid-cols-2 gap-0.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  'rounded flex items-center gap-0.5 px-0.5',
                  i === 1
                    ? 'bg-orange-400/20 dark:bg-orange-500/20 border border-orange-300/50 dark:border-orange-600/30'
                    : 'bg-white/60 dark:bg-white/5 border border-orange-100/60 dark:border-orange-800/20',
                )}
              >
                <div
                  className={cn(
                    'w-1 h-1 rounded-full shrink-0',
                    i === 1
                      ? 'bg-orange-400 dark:bg-orange-500'
                      : 'bg-orange-200 dark:bg-orange-700/50',
                  )}
                />
                <div
                  className={cn(
                    'h-0.5 rounded-full flex-1',
                    i === 1
                      ? 'bg-orange-300/60 dark:bg-orange-600/40'
                      : 'bg-orange-100/80 dark:bg-orange-800/30',
                  )}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (isInteractive && interactiveContent?.html) {
      return <ThumbnailInteractive content={interactiveContent} size={THUMBNAIL_WIDTH} />;
    }

    if (scene.type === 'interactive') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 p-1 flex flex-col">
          <div className="flex items-center gap-0.5 mb-0.5 pb-0.5 border-b border-emerald-200/40 dark:border-emerald-700/20">
            <div className="flex gap-0.5">
              <div className="w-0.5 h-0.5 rounded-full bg-red-300 dark:bg-red-500/60" />
              <div className="w-0.5 h-0.5 rounded-full bg-amber-300 dark:bg-amber-500/60" />
              <div className="w-0.5 h-0.5 rounded-full bg-green-300 dark:bg-green-500/60" />
            </div>
            <div className="h-1 flex-1 bg-emerald-200/40 dark:bg-emerald-700/30 rounded-full ml-0.5" />
          </div>
          <div className="flex-1 flex gap-1">
            <div className="flex-1 bg-emerald-100/40 dark:bg-emerald-800/20 rounded flex items-center justify-center border border-emerald-200/40 dark:border-emerald-700/20">
              <Globe className="w-3 h-3 text-emerald-300/80 dark:text-emerald-600/50" />
            </div>
          </div>
        </div>
      );
    }

    if (scene.type === 'pbl') {
      return (
        <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 p-1 flex">
          {[0, 1, 2].map((col) => (
            <div
              key={col}
              className="flex-1 bg-white/50 dark:bg-white/5 rounded p-0.5 flex flex-col gap-0.5 mx-0.5"
            >
              {Array.from({ length: col === 0 ? 2 : col === 1 ? 1 : 1 }).map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 w-full bg-blue-100/60 dark:bg-blue-800/20 rounded border border-blue-200/30 dark:border-blue-700/20"
                />
              ))}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-500">
        <span className="text-[8px] font-bold uppercase tracking-wider opacity-80">{scene.type}</span>
      </div>
    );
  };

  // Compact mode: numbered dots with fixed absolute positions
  if (collapsed) {
    return (
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="relative overflow-x-auto overflow-y-hidden timeline-scroll"
        style={{ height: '100%' }}
        data-testid="scene-timeline-compact"
      >
        {scenes.map((scene, index) => {
          const isActive = currentSceneId === scene.id;
          const left = index * (DOT_SIZE + COMPACT_GAP);

          return (
            <button
              key={scene.id}
              onClick={() => {
                if (onSceneSelect) onSceneSelect(scene.id);
                else setCurrentSceneId(scene.id);
              }}
              style={{ position: 'absolute', left, top: '50%', transform: 'translateY(-50%)' }}
              className="flex items-center group"
            >
              {index > 0 && (
                <div
                  className={cn(
                    'absolute -left-[5px] w-[5px] h-0.5 rounded-full',
                    isActive ? 'bg-sky-400 dark:bg-sky-500' : 'bg-sky-200 dark:bg-slate-700',
                  )}
                />
              )}
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black transition-all',
                  isActive
                    ? 'bg-sky-500 dark:bg-sky-400 text-white shadow-sm shadow-sky-500/30'
                    : 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 group-hover:bg-sky-200 dark:group-hover:bg-sky-800',
                )}
              >
                {index + 1}
              </div>
            </button>
          );
        })}

        {/* Generating dots — one per pending outline */}
        {generatingOutlines.map((outline, idx) => (
          <button
            key={`generating-${outline.id}`}
            style={{ position: 'absolute', left: (scenes.length + idx) * (DOT_SIZE + COMPACT_GAP), top: '50%', transform: 'translateY(-50%)' }}
            className="flex items-center opacity-60 cursor-default"
          >
            <div
              className="absolute -left-[5px] w-[5px] h-0.5 rounded-full bg-gray-300 dark:bg-gray-600"
            />
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500">
              {scenes.length + idx + 1}
            </div>
          </button>
        ))}

        {/* Course complete */}
        {isCourseComplete && generatingOutlines.length === 0 && (
          <div
            key="course-complete"
            style={{ position: 'absolute', left: scenes.length * (DOT_SIZE + COMPACT_GAP), top: '50%', transform: 'translateY(-50%)' }}
            className="flex items-center"
          >
            <div
              className="absolute -left-[5px] w-[5px] h-0.5 rounded-full bg-amber-300 dark:bg-amber-600"
            />
            <Trophy className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          </div>
        )}

        {/* Spacer for scroll width */}
        <div style={{ width: containerWidth, height: 1 }} aria-hidden />
      </div>
    );
  }

  // Full mode: thumbnails with titles — absolute positioning
  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className="relative overflow-x-auto scrollbar-hide"
      style={{ height: CONTAINER_HEIGHT }}
      data-testid="scene-timeline"
    >
      {scenes.map((scene, index) => {
        const isActive = currentSceneId === scene.id;
        const left = index * (fullItemWidth + GAP);

        return (
          <button
            key={scene.id}
            data-testid="scene-item"
            onClick={() => {
              if (onSceneSelect) onSceneSelect(scene.id);
              else setCurrentSceneId(scene.id);
            }}
            style={{ position: 'absolute', left, top: '50%', transform: 'translateY(-50%)', width: fullItemWidth }}
            className={cn(
              'flex flex-col items-center gap-0.5 rounded-lg p-1 transition-colors duration-200 ring-1',
              isActive
                ? 'bg-sky-50 dark:bg-sky-900/20 ring-sky-200 dark:ring-sky-700'
                : 'ring-transparent hover:bg-sky-50/50 dark:hover:bg-sky-900/10',
            )}
          >
            <div className="flex items-center gap-1 w-full">
              <span
                className={cn(
                  'text-[9px] font-black w-4 h-3.5 rounded-full flex items-center justify-center shrink-0',
                  isActive
                    ? 'bg-sky-500 dark:bg-sky-400 text-white'
                    : 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400',
                )}
              >
                {index + 1}
              </span>
              <span
                data-testid="scene-title"
                className={cn(
                  'text-[10px] font-bold truncate flex-1 text-left transition-colors',
                  isActive
                    ? 'text-sky-700 dark:text-sky-300'
                    : 'text-slate-600 dark:text-slate-300',
                )}
              >
                {scene.title}
              </span>
            </div>
            <div
              className={cn(
                'rounded overflow-hidden ring-1',
                isActive
                  ? 'ring-sky-300 dark:ring-sky-600'
                  : 'ring-sky-200/50 dark:ring-sky-700/30',
              )}
              style={{ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}
            >
              {renderThumbnail(scene)}
            </div>
          </button>
        );
      })}

      {/* Generating placeholders — one per pending outline */}
      {generatingOutlines.map((outline, idx) => {
          const isFailed = failedOutlines.some((f) => f.id === outline.id);
          const isRetrying = retryingOutlineId === outline.id;
          const isPaused = generationStatus === 'paused';
          const isFirst = idx === 0;
          const isActive = isFirst && currentSceneId === PENDING_SCENE_ID;
          const left = (scenes.length + idx) * (fullItemWidth + GAP);

          return (
            <div
              key={`generating-${outline.id}`}
              role="button"
              tabIndex={isFailed || !isFirst ? -1 : 0}
              onClick={() => {
                if (isFailed || !isFirst) return;
                if (onSceneSelect) onSceneSelect(PENDING_SCENE_ID);
                else setCurrentSceneId(PENDING_SCENE_ID);
              }}
              onKeyDown={(e) => {
                if (isFailed || !isFirst) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (onSceneSelect) onSceneSelect(PENDING_SCENE_ID);
                  else setCurrentSceneId(PENDING_SCENE_ID);
                }
              }}
              style={{ position: 'absolute', left, top: '50%', transform: 'translateY(-50%)', width: fullItemWidth }}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg p-1 transition-colors duration-200 ring-1',
                isFailed
                  ? 'cursor-default ring-transparent'
                  : isActive
                    ? 'bg-purple-50 dark:bg-purple-900/20'
                    : 'opacity-60 hover:bg-gray-50/80 dark:hover:bg-gray-800/50',
              )}
            >
              <div className="flex items-center gap-1 w-full">
                <span className="text-[9px] font-black w-4 h-3.5 rounded-full flex items-center justify-center shrink-0 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500">
                  {scenes.length + idx + 1}
                </span>
                <span className="text-[10px] font-bold truncate flex-1 text-left text-gray-400 dark:text-gray-500">
                  {outline.title}
                </span>
              </div>
              <div
                className={cn(
                  'rounded overflow-hidden ring-1 ring-black/5 dark:ring-white/5',
                  isFailed
                    ? 'bg-red-50/30 dark:bg-red-950/10'
                    : 'bg-gray-100 dark:bg-gray-800',
                )}
                style={{ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}
              >
                <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                  {isFailed ? (
                    <div className="flex items-center gap-1 text-[10px] font-medium text-red-500/90 dark:text-red-400">
                      {onRetryOutline ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRetryOutline(outline.id);
                          }}
                          disabled={isRetrying}
                          className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95 disabled:opacity-50"
                        >
                          <RefreshCw className={cn('w-3 h-3', isRetrying && 'animate-spin')} />
                        </button>
                      ) : (
                        <AlertCircle className="w-3 h-3" />
                      )}
                    </div>
                  ) : (
                    <>
                      <div className={cn('h-1 w-3/5 bg-gray-200 dark:bg-gray-700 rounded', !isPaused && 'animate-pulse')} />
                      <div className={cn('h-0.5 w-2/5 bg-gray-200 dark:bg-gray-700 rounded', !isPaused && 'animate-pulse')} />
                    </>
                  )}
                </div>
                {!isFailed && !isPaused && (
                  <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
                )}
              </div>
            </div>
          );
        })}

      {/* Course complete */}
      {isCourseComplete && generatingOutlines.length === 0 && (
        <button
          key="course-complete"
          onClick={() => {
            if (onSceneSelect) onSceneSelect(PENDING_SCENE_ID);
            else setCurrentSceneId(PENDING_SCENE_ID);
          }}
          style={{ position: 'absolute', left: scenes.length * (fullItemWidth + GAP), top: 0, width: fullItemWidth }}
          className={cn(
            'flex flex-col items-center gap-0.5 rounded-lg p-1 transition-colors duration-200 ring-1',
            currentSceneId === PENDING_SCENE_ID
              ? 'bg-amber-50 dark:bg-amber-900/20 ring-amber-200 dark:ring-amber-700'
              : 'opacity-80 ring-transparent hover:bg-amber-50/60 dark:hover:bg-amber-900/10',
          )}
        >
          <div className="flex items-center gap-1 w-full justify-center">
            <span className="text-[9px] font-black w-4 h-3.5 rounded-full flex items-center justify-center bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
              {scenes.length + 1}
            </span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
              课程完成
            </span>
          </div>
          <div
            className="bg-amber-50/80 dark:bg-amber-950/20 rounded overflow-hidden ring-1 ring-amber-100 dark:ring-amber-900/40 flex items-center justify-center"
            style={{ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}
          >
            <Trophy className="w-6 h-6 text-amber-500 dark:text-amber-400" />
          </div>
        </button>
      )}

      {/* Spacer for scroll width */}
      <div style={{ width: containerWidth, height: 1 }} aria-hidden />
    </div>
  );
}
