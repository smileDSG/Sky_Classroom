'use client';

import { useCallback, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

interface SlideViewerProps {
  images: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onOpenGallery?: () => void;
}

export function SlideViewer({ images, activeIndex, onSelect, onOpenGallery }: SlideViewerProps) {
  const [hoveredThumb, setHoveredThumb] = useState<number | null>(null);

  const handlePrev = useCallback(() => {
    onSelect(Math.max(0, activeIndex - 1));
  }, [activeIndex, onSelect]);

  const handleNext = useCallback(() => {
    onSelect(Math.min(images.length - 1, activeIndex + 1));
  }, [activeIndex, images.length, onSelect]);

  const currentImage = images[activeIndex];

  return (
    <div className="flex h-full flex-col">
      {/* Top toolbar */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
            {activeIndex + 1}
          </span>
          <span className="text-xs text-slate-400 dark:text-gray-500">/ {images.length}</span>
        </div>

        {onOpenGallery && (
          <button
            onClick={onOpenGallery}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-all duration-200 hover:-translate-y-px"
          >
            <Maximize2 className="h-3 w-3" />
            全屏预览
          </button>
        )}
      </div>

      {/* Main image area */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center bg-slate-50/50 dark:bg-gray-950/50 p-4">
        {currentImage && (
          <button
            onClick={onOpenGallery}
            className="relative flex h-full w-full items-center justify-center"
          >
            <img
              key={activeIndex}
              src={currentImage}
              alt={`Slide ${activeIndex + 1}`}
              className="max-h-full max-w-full rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-slate-900 shadow-xl object-contain animate-fade-in-scale"
              draggable={false}
            />
          </button>
        )}

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              disabled={activeIndex === 0}
              className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 text-slate-600 dark:text-gray-300 shadow-lg hover:border-primary/40 hover:text-primary hover:shadow-xl hover:scale-105 disabled:opacity-0 disabled:pointer-events-none transition-all duration-200"
              aria-label="上一页"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={handleNext}
              disabled={activeIndex === images.length - 1}
              className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 text-slate-600 dark:text-gray-300 shadow-lg hover:border-primary/40 hover:text-primary hover:shadow-xl hover:scale-105 disabled:opacity-0 disabled:pointer-events-none transition-all duration-200"
              aria-label="下一页"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>

      {/* Bottom thumbnail strip */}
      {images.length > 1 && (
        <div className="flex-shrink-0 border-t border-slate-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 scrollbar-hide">
            {images.map((src, i) => (
              <button
                key={i}
                onClick={() => onSelect(i)}
                onMouseEnter={() => setHoveredThumb(i)}
                onMouseLeave={() => setHoveredThumb(null)}
                className={`relative flex-shrink-0 rounded-lg overflow-hidden transition-all duration-200 ${
                  i === activeIndex
                    ? 'ring-2 ring-primary shadow-md'
                    : hoveredThumb === i
                      ? 'opacity-100 scale-105 shadow-sm'
                      : 'opacity-50 hover:opacity-80'
                }`}
              >
                <img
                  src={src}
                  alt={`第 ${i + 1} 页`}
                  className="h-11 w-[72px] object-cover"
                  draggable={false}
                />
                <span
                  className={`absolute bottom-0.5 right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold transition-colors ${
                    i === activeIndex ? 'bg-primary text-white' : 'bg-black/50 text-white'
                  }`}
                >
                  {i + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
