'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  PencilLine,
  LayoutList,
  MessageSquare,
  Volume1,
  Volume2,
  VolumeX,
  Repeat,
  Maximize2,
  Minimize2,
  Square,
  MessageCircle,
  CircleCheck,
  CircleHelp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store';
import { motion, AnimatePresence } from 'motion/react';

export interface BottomToolbarProps {
  readonly currentSceneIndex: number;
  readonly scenesCount: number;
  readonly engineState: 'idle' | 'playing' | 'paused';
  readonly isLiveSession?: boolean;
  readonly whiteboardOpen: boolean;
  readonly sidebarCollapsed?: boolean;
  readonly chatCollapsed?: boolean;
  readonly onToggleSidebar?: () => void;
  readonly onToggleChat?: () => void;
  readonly onPrevSlide: () => void;
  readonly onNextSlide: () => void;
  readonly onPlayPause: () => void;
  readonly onWhiteboardClose: () => void;
  readonly showStopDiscussion?: boolean;
  readonly onStopDiscussion?: () => void;
  readonly isPresenting?: boolean;
  readonly onTogglePresentation?: () => void;
  readonly className?: string;
  // Audio/playback controls
  readonly ttsEnabled?: boolean;
  readonly ttsMuted?: boolean;
  readonly ttsVolume?: number;
  readonly onToggleMute?: () => void;
  readonly onVolumeChange?: (volume: number) => void;
  readonly autoPlayLecture?: boolean;
  readonly onToggleAutoPlay?: () => void;
  readonly playbackSpeed?: number;
  readonly onCycleSpeed?: () => void;
  // Ask Teacher
  readonly onAskTeacher?: () => void;
  readonly onReportUnderstanding?: (level: 'confused' | 'understood') => void;
}

/* Compact control button */
const ctrlBtn = cn(
  'relative w-8 h-8 rounded-xl flex items-center justify-center',
  'transition-all duration-150 outline-none cursor-pointer',
  'hover:bg-sky-50 dark:hover:bg-slate-700/50 active:scale-95',
  'text-slate-500 dark:text-slate-400',
);

/* Subtle separator */
function CtrlDivider() {
  return <div className="mx-1 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700" />;
}

/* Volume icon based on level */
function VolumeIcon({
  muted,
  volume,
  disabled,
}: {
  muted: boolean;
  volume: number;
  disabled: boolean;
}) {
  const cls = 'w-4 h-4';
  if (disabled || muted || volume === 0) return <VolumeX className={cls} />;
  if (volume < 0.5) return <Volume1 className={cls} />;
  return <Volume2 className={cls} />;
}

export function BottomToolbar({
  currentSceneIndex,
  scenesCount,
  engineState,
  isLiveSession,
  whiteboardOpen,
  sidebarCollapsed,
  chatCollapsed,
  onToggleSidebar,
  onToggleChat,
  onPrevSlide,
  onNextSlide,
  onPlayPause,
  onWhiteboardClose,
  showStopDiscussion,
  onStopDiscussion,
  isPresenting,
  onTogglePresentation,
  className,
  ttsEnabled,
  ttsMuted,
  ttsVolume = 1,
  onToggleMute,
  onVolumeChange,
  autoPlayLecture,
  onToggleAutoPlay,
  playbackSpeed = 1,
  onCycleSpeed,
  onAskTeacher,
  onReportUnderstanding,
}: BottomToolbarProps) {
  const canGoPrev = currentSceneIndex > 0;
  const canGoNext = currentSceneIndex < scenesCount - 1;
  const showPlayPause = !isLiveSession;

  const whiteboardElementCount = useStageStore(
    (s) => s.stage?.whiteboard?.[0]?.elements?.length || 0,
  );

  // Volume slider hover state
  const [volumeHover, setVolumeHover] = useState(false);
  const volumeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const volumeContainerRef = useRef<HTMLDivElement>(null);

  const handleVolumeEnter = useCallback(() => {
    clearTimeout(volumeTimerRef.current);
    setVolumeHover(true);
  }, []);

  const handleVolumeLeave = useCallback(() => {
    volumeTimerRef.current = setTimeout(() => setVolumeHover(false), 300);
  }, []);

  // Cleanup volume hover timer on unmount
  useEffect(() => () => clearTimeout(volumeTimerRef.current), []);

  // Effective volume for display
  const effectiveVolume = ttsMuted ? 0 : ttsVolume;
  const presentationLabel = isPresenting ? '退出全屏' : '全屏';

  // Progress percentage
  const progress = ((currentSceneIndex + 1) / scenesCount) * 100;

  return (
    <div className={cn('pointer-events-none w-full px-4 pb-0', className)}>
      {/* Progress bar */}
      <div className="mx-auto mb-2 h-1 w-full max-w-2xl overflow-hidden rounded-full bg-white/70 dark:bg-slate-800">
        <motion.div
          className="h-full bg-sky-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Toolbar container */}
      <div className="pointer-events-auto mx-auto grid max-w-2xl grid-cols-[1fr_auto_1fr] items-center rounded-[20px] border border-white/80 bg-white/78 px-2.5 py-1.5 shadow-[0_16px_42px_rgba(14,116,144,0.14)] backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/94">
        {/* Left: sidebar toggle + page indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className={cn(
                ctrlBtn,
                sidebarCollapsed ? 'opacity-50' : 'text-sky-700 dark:text-sky-300',
              )}
              aria-label="Toggle sidebar"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 dark:bg-slate-800">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
              {currentSceneIndex + 1}
            </span>
            <span className="text-slate-400">/</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {scenesCount}
            </span>
          </div>
        </div>

        {/* Center: Main controls */}
        <div className="flex items-center gap-1">
          {/* Ask Teacher Button - Most prominent */}
          {onAskTeacher && (
            <button
              onClick={onAskTeacher}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-full px-4',
                'bg-sky-600',
                'text-white text-sm font-medium',
                'hover:bg-sky-500',
                'active:scale-95 transition-all',
                'shadow-lg shadow-sky-500/20',
              )}
            >
              <MessageCircle className="w-4 h-4" />
              <span>提问</span>
            </button>
          )}

          {onReportUnderstanding && (
            <>
              <button
                type="button"
                onClick={() => onReportUnderstanding('confused')}
                className={ctrlBtn}
                aria-label="Report confusion"
                title="还没听懂"
              >
                <CircleHelp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onReportUnderstanding('understood')}
                className={ctrlBtn}
                aria-label="Report understanding"
                title="已经听懂"
              >
                <CircleCheck className="w-4 h-4" />
              </button>
            </>
          )}

          <CtrlDivider />

          {/* Volume with popover */}
          {onToggleMute && (
            <div
              ref={volumeContainerRef}
              className="relative flex items-center"
              onMouseEnter={handleVolumeEnter}
              onMouseLeave={handleVolumeLeave}
            >
              <button
                onClick={onToggleMute}
                disabled={!ttsEnabled}
                className={cn(
                  ctrlBtn,
                  !ttsEnabled && 'opacity-30 cursor-not-allowed',
                  ttsMuted && 'text-red-500',
                )}
                aria-label={ttsMuted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon muted={!!ttsMuted} volume={ttsVolume} disabled={!ttsEnabled} />
              </button>

              {/* Volume slider popup */}
              <AnimatePresence>
                {volumeHover && ttsEnabled && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50"
                  >
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 flex flex-col items-center gap-2">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        {Math.round(effectiveVolume * 100)}%
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={effectiveVolume}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          onVolumeChange?.(v);
                          if (v > 0 && ttsMuted) onToggleMute?.();
                        }}
                        className="w-1.5 h-20 appearance-none cursor-pointer rounded-full bg-slate-200 dark:bg-slate-600"
                        style={{
                          writingMode: 'vertical-lr',
                          direction: 'rtl',
                        }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Speed control */}
          {onCycleSpeed && (
            <button
              onClick={onCycleSpeed}
              className={cn(
                'flex h-8 w-10 items-center justify-center rounded-xl',
                'text-xs font-bold tabular-nums transition-all',
                playbackSpeed !== 1
                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50',
              )}
            >
              {playbackSpeed === 1.25
                ? '1.25x'
                : playbackSpeed === 1.5
                  ? '1.5x'
                  : `${playbackSpeed}x`}
            </button>
          )}

          <CtrlDivider />

          {/* Navigation & Play */}
          {scenesCount > 1 && (
            <button
              onClick={onPrevSlide}
              disabled={!canGoPrev}
              className={cn(ctrlBtn, 'disabled:opacity-20 disabled:cursor-not-allowed')}
              aria-label="Previous scene"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Play/Pause/Stop */}
          {showStopDiscussion && onStopDiscussion ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStopDiscussion();
              }}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-xl px-3',
                'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
                'text-xs font-semibold',
                'hover:bg-red-100 dark:hover:bg-red-500/20',
                'active:scale-95 transition-all',
              )}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>结束</span>
            </button>
          ) : showPlayPause ? (
            <button
              onClick={onPlayPause}
              className={cn(
                'flex h-8 w-10 items-center justify-center rounded-xl transition-all',
                engineState === 'playing'
                  ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/20'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700',
              )}
            >
              {engineState === 'playing' ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </button>
          ) : null}

          {scenesCount > 1 && (
            <button
              onClick={onNextSlide}
              disabled={!canGoNext}
              className={cn(ctrlBtn, 'disabled:opacity-20 disabled:cursor-not-allowed')}
              aria-label="Next scene"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          <CtrlDivider />

          {/* Auto-play */}
          {onToggleAutoPlay && (
            <button
              onClick={onToggleAutoPlay}
              className={cn(
                ctrlBtn,
                autoPlayLecture && 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
              )}
              aria-label="Auto-play"
              title={autoPlayLecture ? '自动播放: 开' : '自动播放: 关'}
            >
              <Repeat className="w-4 h-4" />
            </button>
          )}

          {/* Whiteboard */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onWhiteboardClose();
            }}
            className={cn(
              ctrlBtn,
              'relative',
              whiteboardOpen && 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
            )}
            title={whiteboardOpen ? '关闭白板' : '打开白板'}
          >
            <PencilLine className="w-4 h-4" />
            {!whiteboardOpen && whiteboardElementCount > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sky-500" />
            )}
          </button>
        </div>

        {/* Right: fullscreen + chat toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <CtrlDivider />
          {onTogglePresentation && (
            <button
              onClick={onTogglePresentation}
              className={cn(ctrlBtn, isPresenting && 'text-sky-700 dark:text-sky-300')}
              aria-label={presentationLabel}
              title={presentationLabel}
            >
              {isPresenting ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              className={cn(
                ctrlBtn,
                chatCollapsed ? 'opacity-50' : 'text-sky-700 dark:text-sky-300',
              )}
              aria-label="Toggle chat"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default BottomToolbar;
