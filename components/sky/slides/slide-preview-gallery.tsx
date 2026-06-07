'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface SlidePreviewGalleryProps {
  slideImages: string[];
  initialIndex?: number;
  onClose: () => void;
}

export function SlidePreviewGallery({
  slideImages,
  initialIndex = 0,
  onClose,
}: SlidePreviewGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);

  const total = slideImages.length;

  const goNext = useCallback(() => {
    setActiveIndex((i) => Math.min(total - 1, i + 1));
    setScale(1);
  }, [total]);

  const goPrev = useCallback(() => {
    setActiveIndex((i) => Math.max(0, i - 1));
    setScale(1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  const currentImage = slideImages[activeIndex];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950/95">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-white">
            {activeIndex + 1}
          </span>
          <span className="text-sm text-gray-400">
            / {total} 页
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="inline-flex items-center gap-1 rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
            title="缩小"
          >
            <ZoomOut size={16} />
          </button>
          <span className="w-10 text-center text-xs text-gray-500 tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2, s + 0.25))}
            className="inline-flex items-center gap-1 rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
            title="放大"
          >
            <ZoomIn size={16} />
          </button>
          <div className="mx-2 h-5 w-px bg-gray-700" />
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200 transition-colors"
            title="关闭 (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
        <button
          onClick={goPrev}
          disabled={activeIndex === 0}
          className="absolute left-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-gray-700 bg-gray-800/90 text-white shadow-lg transition-all hover:bg-gray-700 disabled:opacity-0 disabled:pointer-events-none"
          aria-label="上一页"
        >
          <ChevronLeft size={22} />
        </button>

        {currentImage && (
          <img
            src={currentImage}
            alt={`第 ${activeIndex + 1} 页`}
            className="max-h-full max-w-full rounded-lg shadow-2xl object-contain"
            style={{ transform: `scale(${scale})` }}
            draggable={false}
          />
        )}

        <button
          onClick={goNext}
          disabled={activeIndex === total - 1}
          className="absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-gray-700 bg-gray-800/90 text-white shadow-lg transition-all hover:bg-gray-700 disabled:opacity-0 disabled:pointer-events-none"
          aria-label="下一页"
        >
          <ChevronRight size={22} />
        </button>
      </div>

      {/* Thumbnail strip */}
      <div className="flex-shrink-0 border-t border-gray-800 bg-gray-900/80 px-4 py-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {slideImages.map((src, i) => (
            <button
              key={i}
              onClick={() => {
                setActiveIndex(i);
                setScale(1);
              }}
              className={`relative flex-shrink-0 overflow-hidden rounded-md transition-all duration-150 ${
                i === activeIndex
                  ? 'ring-2 ring-primary shadow-md'
                  : 'opacity-50 hover:opacity-100'
              }`}
            >
              <img
                src={src}
                alt={`第 ${i + 1} 页`}
                className="h-12 w-20 object-cover"
                draggable={false}
              />
              <span
                className={`absolute bottom-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold ${
                  i === activeIndex ? 'bg-primary text-white' : 'bg-black/60 text-white'
                }`}
              >
                {i + 1}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
