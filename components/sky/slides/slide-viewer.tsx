'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Maximize2, Minimize2, ChevronLeft, ChevronRight, Download, RotateCcw, FileCheck, Presentation } from 'lucide-react';

/* Celestial action button */
function ActionButton({
  onClick,
  icon,
  label,
  primary,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium transition-all whitespace-nowrap ${
        primary
          ? 'border border-[var(--celestial-starlight)]/15 bg-[var(--celestial-starlight)]/5 text-[var(--celestial-starlight)]/80 hover:border-[var(--celestial-starlight)]/30 hover:text-[var(--celestial-starlight)]'
          : 'text-[var(--celestial-starlight)]/40 hover:bg-[var(--celestial-starlight)]/[0.03] hover:text-[var(--celestial-starlight)]/70'
      }`}
      title={label}
    >
      {icon}
      <span className="hidden lg:inline">{label}</span>
      <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--celestial-horizon)] px-2 py-1 text-[10px] text-[var(--celestial-starlight)]/80 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block lg:hidden border border-[var(--celestial-haze)]/30">
        {label}
      </span>
    </button>
  );
}

interface SlideViewerProps {
  images: string[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  fileName?: string;
  onDownload?: () => void;
  onRegenerate?: () => void;
  onShowQaReport?: () => void;
  hasQaReport?: boolean;
}

/* ─── Celestial SlideViewer ───
 * Enhanced 3D tilt with dynamic shadow
 * Observatory-style controls
 */

export function SlideViewer({
  images,
  activeIndex,
  onIndexChange,
  fileName,
  onDownload,
  onRegenerate,
  onShowQaReport,
  hasQaReport,
}: SlideViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const total = images.length;
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
    setTilt({ x, y });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= total) return;
      onIndexChange(index);
    },
    [total, onIndexChange]
  );

  const goNext = useCallback(() => {
    if (activeIndex < total - 1) onIndexChange(activeIndex + 1);
  }, [activeIndex, total, onIndexChange]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) onIndexChange(activeIndex - 1);
  }, [activeIndex, onIndexChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        goNext();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      }
      if (e.key === 'End') {
        e.preventDefault();
        goTo(total - 1);
      }
      if (e.key === 'f' || e.key === 'F') {
        setIsFullscreen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, goTo, total]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch { /* ignore */ }
  }, []);

  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      const diff = touchStartX.current - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 50) {
        diff > 0 ? goNext() : goPrev();
      }
      touchStartX.current = null;
    },
    [goNext, goPrev]
  );

  const prevIndex = activeIndex > 0 ? activeIndex - 1 : null;
  const nextIndex = activeIndex < total - 1 ? activeIndex + 1 : null;

  // Dynamic shadow based on tilt direction
  const shadowX = -tilt.x * 1.5;
  const shadowY = tilt.y * 1.5;

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{ background: 'linear-gradient(180deg, var(--celestial-void) 0%, var(--celestial-horizon) 100%)' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onDoubleClick={toggleFullscreen}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%]"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.04), transparent 70%)' }}
        />
      </div>

      {/* Main stage */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden" style={{ perspective: '1200px' }}>

        {/* Left preview */}
        {prevIndex !== null && (
          <button
            onClick={goPrev}
            className="absolute left-[3%] z-[1] hidden md:block transition-all duration-500 ease-out opacity-15 hover:opacity-40"
            style={{
              transform: 'translateX(0) rotateY(28deg) scale(0.65)',
              transformOrigin: 'right center',
              width: 'clamp(200px, 38vw, 640px)',
            }}
          >
            <img
              src={images[prevIndex]}
              alt=""
              className="w-full rounded-xl object-contain"
              style={{ aspectRatio: '16/9', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              draggable={false}
              loading="lazy"
            />
          </button>
        )}

        {/* Right preview */}
        {nextIndex !== null && (
          <button
            onClick={goNext}
            className="absolute right-[3%] z-[1] hidden md:block transition-all duration-500 ease-out opacity-15 hover:opacity-40"
            style={{
              transform: 'translateX(0) rotateY(-28deg) scale(0.65)',
              transformOrigin: 'left center',
              width: 'clamp(200px, 38vw, 640px)',
            }}
          >
            <img
              src={images[nextIndex]}
              alt=""
              className="w-full rounded-xl object-contain"
              style={{ aspectRatio: '16/9', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
              draggable={false}
              loading="lazy"
            />
          </button>
        )}

        {/* Current slide — enhanced 3D tilt */}
        <div
          className="relative z-10 transition-transform duration-200 ease-out will-change-transform cursor-grab active:cursor-grabbing select-none"
          style={{
            transform: `rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) translateZ(30px)`,
            width: 'clamp(300px, 56vw, 920px)',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Dynamic shadow */}
          <div
            className="absolute -inset-4 rounded-2xl opacity-60 blur-2xl pointer-events-none transition-all duration-200"
            style={{
              background: 'rgba(0,0,0,0.3)',
              transform: `translate(${shadowX}px, ${shadowY}px)`,
            }}
          />

          {/* Rim light */}
          <div
            className="absolute -inset-[1px] rounded-xl pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(245,230,200,0.08), transparent, rgba(139,92,246,0.06))',
            }}
          />

          <div
            className="relative overflow-hidden rounded-xl border border-[var(--celestial-starlight)]/8"
            style={{
              background: 'var(--celestial-horizon)',
              boxShadow: '0 24px 48px -12px rgba(0,0,0,0.5), inset 0 1px 0 0 rgba(245,230,200,0.05)',
            }}
          >
            <img
              src={images[activeIndex]}
              alt={`Slide ${activeIndex + 1}`}
              className="w-full object-contain"
              draggable={false}
              style={{ aspectRatio: '16/9' }}
            />
          </div>
        </div>

        {/* Navigation arrows — celestial dial style */}
        <button
          onClick={goPrev}
          disabled={activeIndex === 0}
          className="absolute left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--celestial-starlight)]/10 bg-[var(--celestial-void)]/60 text-[var(--celestial-starlight)]/40 backdrop-blur-md transition-all hover:text-[var(--celestial-starlight)]/80 hover:border-[var(--celestial-starlight)]/20 hover:scale-110 disabled:opacity-0 disabled:pointer-events-none"
          style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          aria-label="上一页"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={goNext}
          disabled={activeIndex === total - 1}
          className="absolute right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--celestial-starlight)]/10 bg-[var(--celestial-void)]/60 text-[var(--celestial-starlight)]/40 backdrop-blur-md transition-all hover:text-[var(--celestial-starlight)]/80 hover:border-[var(--celestial-starlight)]/20 hover:scale-110 disabled:opacity-0 disabled:pointer-events-none"
          style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          aria-label="下一页"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Bottom control bar */}
      <div className="relative z-20">
        {/* Progress bar */}
        <div className="mx-auto w-full max-w-xl px-6">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-[var(--celestial-starlight)]/30 tabular-nums w-8 text-right">
              {String(activeIndex + 1).padStart(2, '0')}
            </span>
            <div className="flex-1 h-[2px] overflow-hidden rounded-full bg-[var(--celestial-haze)]/20">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${((activeIndex + 1) / total) * 100}%`,
                  background: 'linear-gradient(90deg, var(--celestial-nebula), var(--celestial-dawn))',
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-[var(--celestial-starlight)]/30 tabular-nums w-8">
              {String(total).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Control panel */}
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-2.5">
          {/* Left: file info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-[var(--celestial-starlight)]/10 bg-[var(--celestial-starlight)]/[0.03]">
              <Presentation size={13} className="text-[var(--celestial-starlight)]/40" />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-[11px] font-mono text-[var(--celestial-starlight)]/60 truncate max-w-[120px]">
                {fileName || '课件预览'}
              </span>
            </div>
          </div>

          {/* Center: thumbnail strip with star indicators */}
          <div className="flex-1 mx-4 overflow-hidden">
            <div className="flex items-center gap-1 justify-center">
              {images.map((src, i) => {
                const isActive = i === activeIndex;
                const dist = Math.abs(i - activeIndex);
                if (dist > 6) return null;
                return (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    className={`relative flex-shrink-0 overflow-hidden rounded transition-all duration-200 ${
                      isActive ? 'opacity-100' : 'opacity-25 hover:opacity-60'
                    }`}
                    style={{
                      width: isActive ? 44 : 28,
                      height: isActive ? 25 : 16,
                      transform: isActive ? 'scale(1.1)' : `scale(${Math.max(0.7, 1 - dist * 0.05)})`,
                    }}
                  >
                    <img src={src} alt="" className="h-full w-full object-cover" draggable={false} loading="lazy" />
                    {isActive && (
                      <div className="absolute inset-0 border border-[var(--celestial-dawn)]/40 rounded" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {hasQaReport && onShowQaReport && (
              <ActionButton onClick={onShowQaReport} icon={<FileCheck size={13} />} label="质检报告" />
            )}
            {onRegenerate && (
              <ActionButton onClick={onRegenerate} icon={<RotateCcw size={13} />} label="重新生成" />
            )}
            {onDownload && (
              <ActionButton onClick={onDownload} icon={<Download size={13} />} label="导出 PPT" primary />
            )}
            <ActionButton onClick={toggleFullscreen} icon={isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />} label={isFullscreen ? '退出全屏' : '全屏'} />
          </div>
        </div>
      </div>
    </div>
  );
}
