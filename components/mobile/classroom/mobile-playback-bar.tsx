'use client';

import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, List, FileText } from 'lucide-react';
import type { EngineMode } from '@/lib/playback/types';

interface MobilePlaybackBarProps {
  mode: EngineMode;
  currentIndex: number;
  totalScenes: number;
  isMuted: boolean;
  onPlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleMute: () => void;
  onOpenScenes: () => void;
  onOpenScript: () => void;
}

export function MobilePlaybackBar({
  mode,
  currentIndex,
  totalScenes,
  isMuted,
  onPlayPause,
  onPrev,
  onNext,
  onToggleMute,
  onOpenScenes,
  onOpenScript,
}: MobilePlaybackBarProps) {
  const isPlaying = mode === 'playing';

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0d1728]/95 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-3 shadow-2xl backdrop-blur-xl">
      <div className="mx-auto flex max-w-screen-sm items-center justify-between px-4">
        <button
          type="button"
          onClick={onToggleMute}
          className="flex size-11 items-center justify-center rounded-full text-slate-300 transition-colors active:bg-white/10"
          aria-label={isMuted ? '取消静音' : '静音'}
        >
          {isMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentIndex <= 0}
            className="flex size-11 items-center justify-center rounded-full text-slate-200 transition-colors active:bg-white/10 disabled:text-slate-600"
            aria-label="上一场景"
          >
            <SkipBack className="size-6" />
          </button>

          <button
            type="button"
            onClick={onPlayPause}
            className="flex size-14 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-lg shadow-sky-500/25 transition-transform active:scale-95"
            aria-label={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <Pause className="size-7 fill-current" />
            ) : (
              <Play className="size-7 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            disabled={currentIndex >= totalScenes - 1}
            className="flex size-11 items-center justify-center rounded-full text-slate-200 transition-colors active:bg-white/10 disabled:text-slate-600"
            aria-label="下一场景"
          >
            <SkipForward className="size-6" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenScript}
            className="flex size-11 items-center justify-center rounded-full text-slate-300 transition-colors active:bg-white/10"
            aria-label="讲稿"
          >
            <FileText className="size-5" />
          </button>
          <button
            type="button"
            onClick={onOpenScenes}
            className="flex size-11 items-center justify-center rounded-full text-slate-300 transition-colors active:bg-white/10"
            aria-label="场景列表"
          >
            <List className="size-5" />
          </button>
        </div>
      </div>

      <div className="mt-2 text-center text-xs text-slate-500">
        {currentIndex + 1} / {totalScenes}
      </div>
    </div>
  );
}
