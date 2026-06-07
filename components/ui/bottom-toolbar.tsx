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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStageStore } from '@/lib/store';
import { useI18n } from '@/lib/hooks/use-i18n';
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
}

/* Compact control button */
const ctrlBtn = cn(
  'relative w-8 h-8 rounded-lg flex items-center justify-center',
  'transition-all duration-150 outline-none cursor-pointer',
  'hover:bg-slate-100 dark:hover:bg-slate-700/50 active:scale-95',
  'text-slate-500 dark:text-slate-400',
);

/* Subtle separator */
function CtrlDivider() {
  return <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />;
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
}: BottomToolbarProps) {
  const { t } = useI18n();
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
  const presentationLabel = isPresenting ? t('stage.exitFullscreen') : t('stage.fullscreen');

  // Progress percentage
  const progress = ((currentSceneIndex + 1) / scenesCount) * 100;

  return (
    <div className={cn('w-full', className)}>
      {/* Progress bar */}
      <div className="w-full h-1 bg-slate-100 dark:bg-slate-800">
        <motion.div
          className="h-full bg-gradient-to-r from-sky-400 to-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Toolbar container */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-700/50">
        {/* Left: sidebar toggle + page indicator */}
        <div className="flex items-center gap-2 shrink-0">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className={cn(
                ctrlBtn,
                sidebarCollapsed ? 'opacity-50' : 'text-sky-500 dark:text-sky-400'
              )}
              aria-label="Toggle sidebar"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          )}
          <div className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
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
                'flex items-center gap-1.5 h-8 px-4 rounded-full',
                'bg-gradient-to-r from-sky-500 to-blue-500',
                'text-white text-sm font-medium',
                'hover:from-sky-400 hover:to-blue-400',
                'active:scale-95 transition-all',
                'shadow-lg shadow-sky-500/25'
              )}
            >
              <MessageCircle className="w-4 h-4" />
              <span>提问</span>
            </button>
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
                  ttsMuted && 'text-red-500'
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
                'w-10 h-8 rounded-lg flex items-center justify-center',
                'text-xs font-bold tabular-nums transition-all',
                playbackSpeed !== 1
                  ? 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              )}
            >
              {playbackSpeed === 1.25 ? '1.25x' : playbackSpeed === 1.5 ? '1.5x' : `${playbackSpeed}x`}
            </button>
          )}

          <CtrlDivider />

          {/* Navigation & Play */}
          {scenesCount > 1 && (
            <button
              onClick={onPrevSlide}
              disabled={!canGoPrev}
              className={cn(
                ctrlBtn,
                'disabled:opacity-20 disabled:cursor-not-allowed'
              )}
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
                'flex items-center gap-1.5 h-8 px-3 rounded-lg',
                'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400',
                'text-xs font-semibold',
                'hover:bg-red-100 dark:hover:bg-red-500/20',
                'active:scale-95 transition-all'
              )}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>结束</span>
            </button>
          ) : showPlayPause ? (
            <button
              onClick={onPlayPause}
              className={cn(
                'w-10 h-8 rounded-lg flex items-center justify-center transition-all',
                engineState === 'playing'
                  ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/25'
                  : 'bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
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
              className={cn(
                ctrlBtn,
                'disabled:opacity-20 disabled:cursor-not-allowed'
              )}
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
                autoPlayLecture && 'text-sky-500 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10'
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
              whiteboardOpen && 'text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10'
            )}
            title={whiteboardOpen ? '关闭白板' : '打开白板'}
          >
            <PencilLine className="w-4 h-4" />
            {!whiteboardOpen && whiteboardElementCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-violet-500 rounded-full" />
            )}
          </button>
        </div>

        {/* Right: fullscreen + chat toggle */}
        <div className="flex items-center gap-1 shrink-0">
          <CtrlDivider />
          {onTogglePresentation && (
            <button
              onClick={onTogglePresentation}
              className={cn(
                ctrlBtn,
                isPresenting && 'text-sky-500 dark:text-sky-400'
              )}
              aria-label={presentationLabel}
              title={presentationLabel}
            >
              {isPresenting ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          )}
          {onToggleChat && (
            <button
              onClick={onToggleChat}
              className={cn(
                ctrlBtn,
                chatCollapsed ? 'opacity-50' : 'text-sky-500 dark:text-sky-400'
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
