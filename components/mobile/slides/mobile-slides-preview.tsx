'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Download, ChevronLeft, ChevronRight, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';

interface OrientationAPI {
  lock?: (orientation: string) => Promise<void>;
  unlock?: () => void;
}

interface MobileSlidesPreviewProps {
  images: string[];
  fileName?: string;
  onDownload: () => void;
  onRegenerate: () => void;
}

export function MobileSlidesPreview({
  images,
  fileName,
  onDownload,
  onRegenerate,
}: MobileSlidesPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);
  const [immersive, setImmersive] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const total = images.length;

  // Listen for orientation changes
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const handleChange = () => setIsLandscape(mq.matches);
    handleChange();
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // Auto-enter immersive mode when rotating to landscape
  useEffect(() => {
    if (isLandscape) {
      setImmersive(true);
    }
  }, [isLandscape]);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= total) return;
      setActiveIndex(index);
    },
    [total]
  );

  const goNext = useCallback(() => {
    if (activeIndex < total - 1) setActiveIndex(activeIndex + 1);
  }, [activeIndex, total]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) setActiveIndex(activeIndex - 1);
  }, [activeIndex]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) {
        diff > 0 ? goNext() : goPrev();
      }
      touchStartX.current = null;
    },
    [goNext, goPrev]
  );

  const toggleImmersive = useCallback(async () => {
    try {
      if (!immersive) {
        // Try to lock to landscape when entering immersive
        const orientation = screen.orientation as OrientationAPI | undefined;
        if (orientation && 'lock' in orientation && typeof orientation.lock === 'function') {
          await orientation.lock('landscape').catch(() => {
            // ignore unsupported
          });
        }
        setImmersive(true);
      } else {
        const orientation = screen.orientation as OrientationAPI | undefined;
        if (orientation && 'unlock' in orientation && typeof orientation.unlock === 'function') {
          try {
            orientation.unlock();
          } catch {
            // ignore
          }
        }
        setImmersive(false);
      }
    } catch {
      setImmersive((v) => !v);
    }
  }, [immersive]);

  const showImmersive = immersive || isLandscape;

  return (
    <div
      className={`
        flex flex-col
        ${showImmersive ? 'fixed inset-0 z-[100] bg-black' : 'min-h-full'}
      `}
    >
      {/* Carousel */}
      <div
        className={`
          relative flex flex-1 items-center justify-center overflow-hidden
          ${showImmersive ? 'bg-black px-0' : 'px-4'}
        `}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <button
          type="button"
          onClick={goPrev}
          disabled={activeIndex === 0}
          className={`
            absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full
            border border-white/10 bg-[#0d1728]/80 text-white/60 backdrop-blur-sm transition-all
            disabled:opacity-0
            ${showImmersive ? 'top-1/2 -translate-y-1/2 bg-black/60' : ''}
          `}
          aria-label="上一页"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className={`relative ${showImmersive ? 'h-full w-full' : 'w-full max-w-2xl'}`}>
          <div
            className={`
              overflow-hidden bg-[#020817]
              ${showImmersive ? 'h-full w-full rounded-none border-0' : 'rounded-xl border border-white/10 shadow-2xl'}
            `}
            style={showImmersive ? undefined : { aspectRatio: '16/9' }}
          >
            <img
              src={images[activeIndex]}
              alt={`幻灯片 ${activeIndex + 1}`}
              className="h-full w-full object-contain"
              draggable={false}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={activeIndex === total - 1}
          className={`
            absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full
            border border-white/10 bg-[#0d1728]/80 text-white/60 backdrop-blur-sm transition-all
            disabled:opacity-0
            ${showImmersive ? 'top-1/2 -translate-y-1/2 bg-black/60' : ''}
          `}
          aria-label="下一页"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Immersive top-right controls */}
        {showImmersive && (
          <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/80"
              aria-label="下载 PPT"
            >
              <Download className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={toggleImmersive}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/80"
              aria-label="退出全屏"
            >
              <Minimize2 className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className={`
          ${
            showImmersive
              ? 'absolute bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-black/70 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-md'
              : 'border-t border-white/10 bg-[#0d1728]/95 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-2xl backdrop-blur-xl'
          }
        `}
      >
        <div className="mx-auto w-full max-w-md px-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="truncate text-sm font-medium text-white">
              {fileName || '课件预览'}
            </span>
            <span className="text-xs text-slate-400">
              {activeIndex + 1} / {total}
            </span>
          </div>

          {!showImmersive && (
            <div className="mb-4 flex items-center gap-1.5 overflow-x-auto px-1 pb-1">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  className={`
                    relative flex-shrink-0 overflow-hidden rounded transition-all
                    ${i === activeIndex ? 'ring-2 ring-sky-400' : 'opacity-50 hover:opacity-80'}
                  `}
                  style={{ width: i === activeIndex ? 56 : 40, height: i === activeIndex ? 32 : 24 }}
                  aria-label={`跳转到第 ${i + 1} 页`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onRegenerate}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors active:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
              重新生成
            </button>
            {!showImmersive && (
              <button
                type="button"
                onClick={toggleImmersive}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors active:bg-white/10"
              >
                <Maximize2 className="h-4 w-4" />
                横屏全屏
              </button>
            )}
            {showImmersive && (
              <button
                type="button"
                onClick={onDownload}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-sky-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-all active:scale-[0.98]"
              >
                <Download className="h-4 w-4" />
                下载 PPT
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
