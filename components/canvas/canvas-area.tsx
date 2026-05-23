'use client';

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SceneRenderer } from '@/components/stage/scene-renderer';
import { SceneProvider } from '@/lib/contexts/scene-context';
import { Whiteboard } from '@/components/whiteboard';
import { CanvasToolbar } from '@/components/canvas/canvas-toolbar';
import type { CanvasToolbarProps } from '@/components/canvas/canvas-toolbar';
import type { Scene, StageMode } from '@/lib/types/stage';
import { useI18n } from '@/lib/hooks/use-i18n';
import { ClassroomCompletePageConnected } from '@/components/scene-renderers/classroom-complete';

interface CanvasAreaProps extends CanvasToolbarProps {
  readonly currentScene: Scene | null;
  readonly mode: StageMode;
  readonly hideToolbar?: boolean;
  readonly isPendingScene?: boolean;
  readonly isCourseComplete?: boolean;
  readonly isGenerationFailed?: boolean;
  readonly onRetryGeneration?: () => void;
}

export function CanvasArea({
  currentScene,
  currentSceneIndex,
  scenesCount,
  mode,
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
  isPresenting,
  onTogglePresentation,
  showStopDiscussion,
  onStopDiscussion,
  hideToolbar,
  isPendingScene,
  isCourseComplete,
  isGenerationFailed,
  onRetryGeneration,
}: CanvasAreaProps) {
  const { t } = useI18n();
  const showControls = mode === 'playback' && !whiteboardOpen;
  const showPlayHint =
    showControls &&
    engineState !== 'playing' &&
    currentScene?.type === 'slide' &&
    !isLiveSession &&
    !isPendingScene;

  const handleSlideClick = useCallback(
    (e: React.MouseEvent) => {
      if (!showControls || isLiveSession || currentScene?.type !== 'slide') return;
      const container = e.currentTarget as HTMLElement;
      const videoEls = container.querySelectorAll('[data-video-element]');
      for (const el of videoEls) {
        const rect = el.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          return;
        }
      }
      onPlayPause();
    },
    [showControls, isLiveSession, onPlayPause, currentScene?.type]
  );

  return (
    <div className="w-full h-full flex flex-col bg-sky-50 dark:bg-slate-950 group/canvas relative overflow-hidden">
      {/* Ambient background glow - lighter in light mode */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-300/20 dark:bg-violet-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-blue-200/30 dark:bg-fuchsia-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-sky-200/25 dark:bg-sky-600/10 rounded-full blur-[80px]" />
      </div>

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Slide area - centered with golden ratio sizing */}
      <div
        className={cn(
          'flex-1 min-h-0 relative overflow-hidden flex items-center justify-center p-4 lg:p-8 transition-colors duration-500',
          currentScene?.type === 'interactive'
            ? 'bg-transparent'
            : 'bg-transparent'
        )}
      >
        {/* Slide container with golden ratio (16:9 ~ 1.78:1, close to golden ratio 1.618:1) */}
        <div
          className={cn(
            'relative aspect-video w-full overflow-hidden transition-all duration-700',
            'flex items-center justify-center',
            showControls && !isLiveSession && currentScene?.type === 'slide' && 'cursor-pointer'
          )}
          onClick={handleSlideClick}
          style={{
            maxWidth: 'min(92vw, 1400px)',
            maxHeight: 'min(75vh, calc(92vw * 9 / 16))',
            minWidth: 'min(60vw, 800px)',
            minHeight: 'min(40vh, calc(60vw * 9 / 16))',
          }}
        >
          {/* Glow border effect */}
          <div
            className={cn(
              'absolute -inset-[1px] rounded-2xl transition-all duration-500',
              'bg-gradient-to-br from-violet-500/20 via-transparent to-fuchsia-500/20',
              currentScene?.type === 'interactive' && 'from-sky-500/20 via-transparent to-cyan-500/20',
            )}
          />

          {/* Inner container */}
          <div
            className={cn(
              'relative w-full h-full rounded-2xl overflow-hidden',
              'bg-white dark:bg-slate-900',
              'border border-sky-200/50 dark:border-white/[0.08]',
              'shadow-[0_25px_80px_-20px_rgba(14,165,233,0.15),inset_0_1px_0_0_rgba(255,255,255,0.8)]',
              'dark:shadow-[0_25px_80px_-20px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.05)]'
            )}
          >
            {/* Top light reflection */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/50 to-transparent dark:via-white/20" />

            {/* Whiteboard Layer */}
            <div className="absolute inset-0 z-[110] pointer-events-none">
              <SceneProvider>
                <Whiteboard isOpen={whiteboardOpen} onClose={onWhiteboardClose} />
              </SceneProvider>
            </div>

            {/* Scene Content */}
            {currentScene && !whiteboardOpen && (
              <div className="absolute inset-0">
                <SceneProvider>
                  <SceneRenderer scene={currentScene} mode={mode} />
                </SceneProvider>
              </div>
            )}

            {/* Pending Scene Loading / Completion Overlay */}
            <AnimatePresence>
              {isPendingScene && !currentScene && isCourseComplete && (
                <motion.div
                  key="course-complete"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="absolute inset-0"
                >
                  <ClassroomCompletePageConnected />
                </motion.div>
              )}
              {isPendingScene && !currentScene && !isCourseComplete && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="absolute inset-0 z-[105] flex flex-col items-center justify-center bg-slate-900"
                >
                  {isGenerationFailed ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/30">
                        <svg
                          className="w-6 h-6 text-red-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                          />
                        </svg>
                      </div>
                      <span className="text-sm text-red-400 font-medium">
                        {t('stage.generationFailed')}
                      </span>
                      {onRetryGeneration && (
                        <button
                          onClick={onRetryGeneration}
                          className="mt-1 px-4 py-1.5 text-xs font-medium rounded-full bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-colors active:scale-95"
                        >
                          {t('generation.retryScene')}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative w-6 h-6">
                        <div className="absolute inset-0 rounded-full border-2 border-slate-700" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
                      </div>
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3 }}
                        className="text-xs text-slate-400 font-medium"
                      >
                        {t('stage.generatingNextPage')}
                      </motion.span>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scene Number Badge */}
            {currentScene && (
              <div className="absolute top-4 right-4 text-sky-600 dark:text-slate-700 font-black text-4xl opacity-20 dark:opacity-30 pointer-events-none select-none">
                {(currentSceneIndex + 1).toString().padStart(2, '0')}
              </div>
            )}

            {/* Play hint */}
            <AnimatePresence>
              {showPlayHint && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 z-[102] flex items-center justify-center pointer-events-none"
                >
                  <motion.div
                    className="opacity-50 group-hover/canvas:opacity-100 transition-opacity duration-300 pointer-events-auto cursor-pointer"
                    exit={{ pointerEvents: 'none' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayPause();
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0.85 }}
                      animate={{ scale: [1, 1.06] }}
                      exit={{ scale: 1.15, opacity: 0 }}
                      transition={{
                        default: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                        scale: {
                          repeat: Infinity,
                          repeatType: 'mirror',
                          duration: 1,
                          ease: 'easeInOut',
                        },
                      }}
                      className="w-20 h-20 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl flex items-center justify-center shadow-[0_4px_30px_rgba(14,165,233,0.3)] dark:shadow-[0_4px_30px_rgba(139,92,246,0.3)] border border-sky-200/50 dark:border-white/10"
                      style={{ willChange: 'transform' }}
                    >
                      <Play className="w-7 h-7 text-sky-500 dark:text-violet-400 fill-sky-500/90 dark:fill-violet-400/90 ml-0.5" />
                    </motion.div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Canvas Toolbar */}
      {!hideToolbar && (
        <CanvasToolbar
          className={cn(
            'shrink-0 h-9 px-2',
            'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl',
            'border-t border-sky-200/50 dark:border-white/5',
          )}
          currentSceneIndex={currentSceneIndex}
          scenesCount={scenesCount}
          engineState={engineState}
          isLiveSession={isLiveSession}
          whiteboardOpen={whiteboardOpen}
          sidebarCollapsed={sidebarCollapsed}
          chatCollapsed={chatCollapsed}
          onToggleSidebar={onToggleSidebar}
          onToggleChat={onToggleChat}
          onPrevSlide={onPrevSlide}
          onNextSlide={onNextSlide}
          onPlayPause={onPlayPause}
          onWhiteboardClose={onWhiteboardClose}
          isPresenting={isPresenting}
          onTogglePresentation={onTogglePresentation}
          showStopDiscussion={showStopDiscussion}
          onStopDiscussion={onStopDiscussion}
        />
      )}
    </div>
  );
}
