'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AvatarConfig, AvatarSpeech } from '@/lib/slides/types';

export interface AvatarSpeechPlayerProps {
  avatar: AvatarConfig | null;
  speech: AvatarSpeech | null;
  activeSlideIndex: number;
  totalSlides: number;
}

export function AvatarSpeechPlayer({ avatar, speech, activeSlideIndex }: AvatarSpeechPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIdx, setCurrentSegmentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const slideSegments = speech?.segments.filter((s) => s.slideIndex === activeSlideIndex) || [];

  const currentSegment = slideSegments[currentSegmentIdx] || null;
  const hasSpeech = slideSegments.length > 0;

  useEffect(() => {
    setCurrentSegmentIdx(0);
    setProgress(0);
    setIsPlaying(false);
  }, [activeSlideIndex]);

  const togglePlay = useCallback(() => {
    if (!hasSpeech) return;
    setIsPlaying((prev) => !prev);
  }, [hasSpeech]);

  useEffect(() => {
    if (!isPlaying || !currentSegment) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    const duration = currentSegment.duration || 3000;
    const startTime = Date.now();

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);

      if (pct >= 100) {
        setCurrentSegmentIdx((prev) => {
          const next = prev + 1;
          if (next >= slideSegments.length) {
            setIsPlaying(false);
            return prev;
          }
          return next;
        });
        setProgress(0);
      }
    }, 50);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, currentSegment, slideSegments.length]);

  if (!avatar) return null;

  return (
    <div className="absolute bottom-24 right-6 z-20 flex items-end gap-3">
      {/* Speech bubble */}
      {hasSpeech && (
        <div className="flex max-w-[300px] flex-col gap-2 rounded-lg rounded-br-md border px-4 py-3 shadow-lg bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-primary">{avatar.name}</span>
              {isPlaying && <span className="flex h-2 w-2 rounded-full bg-green-500" />}
            </div>
            <span className="text-xs text-slate-400 dark:text-gray-500">
              {currentSegmentIdx + 1} / {slideSegments.length}
            </span>
          </div>

          {/* Text content */}
          <div className="max-h-[120px] overflow-y-auto">
            {slideSegments.map((seg, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed transition-colors"
                style={{
                  color: i === currentSegmentIdx ? '#1e293b' : '#94a3b8',
                  fontWeight: i === currentSegmentIdx ? 500 : 400,
                }}
              >
                {seg.text}
              </p>
            ))}
          </div>

          {/* Progress bar */}
          {isPlaying && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white transition-colors hover:bg-primary/90"
            >
              {isPlaying ? (
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <span className="text-xs text-slate-400 dark:text-gray-500">
              {isPlaying ? '讲解中' : hasSpeech ? '点击播放' : '无讲解'}
            </span>
          </div>
        </div>
      )}

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <img
          src={avatar.avatarUrl}
          alt={avatar.name}
          className="relative h-14 w-14 rounded-full border-2 border-white dark:border-gray-700 object-cover shadow-lg"
        />
        {isPlaying && (
          <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 shadow-sm">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
        )}
      </div>
    </div>
  );
}
