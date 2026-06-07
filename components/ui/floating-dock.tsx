'use client';

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  PanelLeft,
  PanelRight,
  Square,
  Settings2,
  Maximize,
  Minimize,
  Mic,
  Volume2,
  VolumeX,
  Repeat,
  PencilLine,
  Volume1,
} from 'lucide-react';
import { useState } from 'react';

type EngineState = 'idle' | 'playing' | 'paused';

interface FloatingDockProps {
  // Playback controls
  engineState: EngineState;
  onPlayPause: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onRestart?: () => void;

  // Progress
  progress?: number; // 0-100
  currentSceneIndex?: number;
  totalScenes?: number;

  // Panel toggles
  sidebarCollapsed?: boolean;
  chatCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onToggleChat?: () => void;

  // Session controls
  isLiveSession?: boolean;
  showStopDiscussion?: boolean;
  onStopDiscussion?: () => void;

  // Audio
  isMuted?: boolean;
  onToggleMute?: () => void;
  volume?: number;
  onVolumeChange?: (v: number) => void;
  ttsEnabled?: boolean;

  // Whiteboard
  whiteboardOpen?: boolean;
  onToggleWhiteboard?: () => void;
  whiteboardElementCount?: number;

  // Playback speed
  playbackSpeed?: number;
  onCycleSpeed?: () => void;

  // Auto-play
  autoPlayLecture?: boolean;
  onToggleAutoPlay?: () => void;

  // Presentation
  isPresenting?: boolean;
  onTogglePresentation?: () => void;

  // Ask Teacher
  onAskTeacher?: () => void;

  // Additional
  className?: string;
}

export function FloatingDock({
  engineState,
  onPlayPause,
  onPrev,
  onNext,
  onRestart,
  progress = 0,
  currentSceneIndex = 0,
  totalScenes = 1,
  sidebarCollapsed,
  chatCollapsed,
  onToggleSidebar,
  onToggleChat,
  isLiveSession,
  showStopDiscussion,
  onStopDiscussion,
  isMuted,
  onToggleMute,
  volume = 1,
  onVolumeChange,
  ttsEnabled = true,
  whiteboardOpen,
  onToggleWhiteboard,
  whiteboardElementCount = 0,
  playbackSpeed = 1,
  onCycleSpeed,
  autoPlayLecture,
  onToggleAutoPlay,
  isPresenting,
  onTogglePresentation,
  onAskTeacher,
  className,
}: FloatingDockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const isPlaying = engineState === 'playing';
  const isPaused = engineState === 'paused';
  const isIdle = engineState === 'idle';

  // Volume icon based on level
  const VolumeIcon = () => {
    if (!ttsEnabled || isMuted || volume === 0) return <VolumeX className="w-4 h-4" />;
    if (volume < 0.5) return <Volume1 className="w-4 h-4" />;
    return <Volume2 className="w-4 h-4" />;
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-1',
        'px-3 py-2',
        'bg-slate-900/80 backdrop-blur-2xl',
        'border border-white/10',
        'rounded-full',
        'shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)]',
        'transition-all duration-300',
        isExpanded && 'gap-2 px-4',
        className
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => {
        setIsExpanded(false);
        setShowVolumeSlider(false);
      }}
    >
      {/* Sidebar Toggle */}
      {onToggleSidebar && (
        <DockButton
          onClick={onToggleSidebar}
          icon={<PanelLeft className="w-4 h-4" />}
          label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          active={!sidebarCollapsed}
        />
      )}

      {/* Page indicator */}
      <div className="flex items-center gap-1 px-1">
        <span className="text-[11px] text-slate-400 tabular-nums select-none font-medium">
          {currentSceneIndex + 1}
          <span className="opacity-50 mx-px">/</span>
          {totalScenes}
        </span>
      </div>

      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* Navigation */}
      <DockButton
        onClick={onPrev}
        disabled={currentSceneIndex === 0}
        icon={<ChevronLeft className="w-4 h-4" />}
        label="上一页"
      />

      {/* Ask Teacher Button - Most prominent */}
      {onAskTeacher && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAskTeacher}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
            'bg-gradient-to-r from-sky-500 to-blue-500',
            'text-white text-xs font-medium',
            'shadow-lg shadow-sky-500/30',
            'hover:from-sky-400 hover:to-blue-400',
            'transition-all duration-200'
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>提问</span>
        </motion.button>
      )}

      {/* Play/Pause/Restart */}
      {isIdle && progress === 100 && onRestart ? (
        <DockButton
          onClick={onRestart}
          icon={<Repeat className="w-4 h-4" />}
          label="重新开始"
          variant="primary"
        />
      ) : (
        <DockButton
          onClick={onPlayPause}
          icon={
            isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )
          }
          label={isPlaying ? '暂停' : isPaused ? '继续' : '播放'}
          variant="primary"
          className="w-10 h-10"
        />
      )}

      <DockButton
        onClick={onNext}
        disabled={currentSceneIndex >= totalScenes - 1}
        icon={<ChevronRight className="w-4 h-4" />}
        label="下一页"
      />

      {/* Divider */}
      <div className="w-px h-5 bg-white/10 mx-1" />

      {/* Volume with slider */}
      {onToggleMute && (
        <div className="relative flex items-center">
          <DockButton
            onClick={() => {
              onToggleMute();
              if (volume === 0 && onVolumeChange) onVolumeChange(0.5);
            }}
            icon={<VolumeIcon />}
            label={isMuted ? '取消静音' : '静音'}
            active={!isMuted && ttsEnabled}
          />

          {/* Volume slider */}
          <AnimatePresence>
            {isExpanded && onVolumeChange && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 60 }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center ml-1"
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    onVolumeChange(v);
                  }}
                  className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Speed control */}
      {onCycleSpeed && (
        <DockButton
          onClick={onCycleSpeed}
          icon={<span className="text-[10px] font-semibold">{playbackSpeed === 1.5 ? '1.5x' : `${playbackSpeed}x`}</span>}
          label="播放速度"
          active={playbackSpeed !== 1}
        />
      )}

      {/* Auto-play */}
      {onToggleAutoPlay && (
        <DockButton
          onClick={onToggleAutoPlay}
          icon={<Repeat className="w-4 h-4" />}
          label={autoPlayLecture ? '自动播放: 开' : '自动播放: 关'}
          active={autoPlayLecture}
        />
      )}

      {/* Whiteboard */}
      {onToggleWhiteboard && (
        <DockButton
          onClick={onToggleWhiteboard}
          icon={<PencilLine className="w-4 h-4" />}
          label="白板"
          active={whiteboardOpen}
        >
          {!whiteboardOpen && whiteboardElementCount > 0 && (
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-violet-500 rounded-full" />
          )}
        </DockButton>
      )}

      {/* Expanded controls */}
      <AnimatePresence>
        {isExpanded && (
          <>
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-1"
            >
              {/* Divider */}
              <div className="w-px h-5 bg-white/10 mx-1" />

              {/* Stop discussion */}
              {showStopDiscussion && onStopDiscussion && (
                <DockButton
                  onClick={onStopDiscussion}
                  icon={<Square className="w-4 h-4" />}
                  label="结束讨论"
                  variant="danger"
                />
              )}

              {/* Presentation */}
              {onTogglePresentation && (
                <DockButton
                  onClick={onTogglePresentation}
                  icon={
                    isPresenting ? (
                      <Minimize className="w-4 h-4" />
                    ) : (
                      <Maximize className="w-4 h-4" />
                    )
                  }
                  label={isPresenting ? '退出演示' : '演示模式'}
                />
              )}

              {/* Chat toggle */}
              {onToggleChat && (
                <DockButton
                  onClick={onToggleChat}
                  icon={<PanelRight className="w-4 h-4" />}
                  label={chatCollapsed ? '展开聊天' : '收起聊天'}
                  active={!chatCollapsed}
                />
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Individual dock button
interface DockButtonProps {
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'default' | 'primary' | 'danger';
  active?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

function DockButton({
  onClick,
  icon,
  label,
  variant = 'default',
  active,
  disabled,
  className,
  children,
}: DockButtonProps) {
  const variants = {
    default: cn(
      'text-slate-300 hover:text-white hover:bg-white/10',
      active && 'text-white bg-white/10'
    ),
    primary: 'text-white bg-violet-600 hover:bg-violet-500 shadow-lg shadow-violet-600/30',
    danger: 'text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/30',
  };

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={cn(
        'relative flex items-center justify-center',
        'w-9 h-9 rounded-full',
        'transition-colors duration-200',
        'disabled:opacity-30 disabled:cursor-not-allowed',
        variants[variant],
        className
      )}
    >
      {icon}
      {children}
    </motion.button>
  );
}

export default FloatingDock;
