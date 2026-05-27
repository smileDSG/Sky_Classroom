'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { AvatarConfig, AvatarSpeech } from '@/lib/slides/types';

export interface AvatarSpeechPlayerProps {
  avatar: AvatarConfig | null;
  speech: AvatarSpeech | null;
  activeSlideIndex: number;
  totalSlides: number;
}

export function AvatarSpeechPlayer({
  avatar,
  speech,
  activeSlideIndex,
  totalSlides,
}: AvatarSpeechPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSegmentIdx, setCurrentSegmentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filter segments for current slide
  const slideSegments =
    speech?.segments.filter((s) => s.slideIndex === activeSlideIndex) || [];

  const currentSegment = slideSegments[currentSegmentIdx] || null;
  const hasSpeech = slideSegments.length > 0;

  // Reset when slide changes
  useEffect(() => {
    setCurrentSegmentIdx(0);
    setProgress(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [activeSlideIndex]);

  // Play/pause handling
  const togglePlay = useCallback(() => {
    if (!hasSpeech) return;
    setIsPlaying((prev) => !prev);
  }, [hasSpeech]);

  // Auto-advance segments
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
        // Move to next segment
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
        <div
          className="flex max-w-[300px] flex-col gap-2 rounded-2xl rounded-br-md border px-4 py-3 shadow-2xl backdrop-blur-xl"
          style={{
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderColor: 'rgba(255,255,255,0.3)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-blue-600">
                {avatar.name}
              </span>
              {isPlaying && (
                <span className="flex h-1.5 w-1.5 rounded-full bg-green-500">
                  <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-green-400 opacity-75" />
                </span>
              )}
            </div>
            <span className="text-[9px] text-slate-400 dark:text-gray-500">
              {currentSegmentIdx + 1} / {slideSegments.length}
            </span>
          </div>

          {/* Text content with highlight */}
          <div className="max-h-[120px] overflow-y-auto">
            {slideSegments.map((seg, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed transition-colors duration-300"
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
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm transition-colors hover:bg-blue-600"
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

            {/* Audio waveform bars */}
            {isPlaying && (
              <div className="flex items-center gap-0.5">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-0.5 rounded-full bg-blue-400/60"
                    style={{
                      height: `${6 + Math.sin(Date.now() / 200 + i) * 6}px`,
                      transition: 'height 150ms ease',
                    }}
                  />
                ))}
              </div>
            )}

            <span className="text-[10px] text-slate-400 dark:text-gray-500">
              {isPlaying ? '讲解中' : hasSpeech ? '点击播放' : '无讲解'}
            </span>
          </div>
        </div>
      )}

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {isPlaying && (
          <div className="absolute inset-0 animate-ping rounded-full bg-blue-400/20" />
        )}
        <img
          src={avatar.avatarUrl}
          alt={avatar.name}
          className="relative h-14 w-14 rounded-full border-2 border-white object-cover shadow-xl"
          style={{
            transform: isPlaying ? 'scale(1.05)' : 'scale(1)',
            transition: 'transform 300ms ease',
          }}
        />
        {isPlaying && (
          <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 shadow-sm">
            <div className="h-1.5 w-1.5 rounded-full bg-white dark:bg-gray-700" />
          </div>
        )}
      </div>
    </div>
  );
}
