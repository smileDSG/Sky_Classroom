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
  }, [total]);

  const goPrev = useCallback(() => {
    setActiveIndex((i) => Math.max(0, i - 1));
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="text-sm text-gray-400">
          第 {activeIndex + 1} / {total} 页
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"
            title="缩小"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-xs text-gray-500 w-12 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(2, s + 0.25))}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"
            title="放大"
          >
            <ZoomIn size={18} />
          </button>
          <div className="w-px h-5 bg-gray-700 mx-1" />
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"
            title="关闭"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        <button
          onClick={goPrev}
          disabled={activeIndex === 0}
          className="absolute left-4 z-10 p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronLeft size={24} />
        </button>

        {currentImage && (
          <img
            src={currentImage}
            alt={`Slide ${activeIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-transform duration-200"
            style={{
              transform: `scale(${scale})`,
              aspectRatio: '16 / 9',
            }}
            draggable={false}
          />
        )}

        <button
          onClick={goNext}
          disabled={activeIndex === total - 1}
          className="absolute right-4 z-10 p-3 rounded-full bg-gray-800/80 hover:bg-gray-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Thumbnail strip */}
      <div className="border-t border-gray-800 bg-gray-900/80 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto justify-center">
          {slideImages.map((src, i) => (
            <button
              key={i}
              onClick={() => {
                setActiveIndex(i);
                setScale(1);
              }}
              className={`flex-shrink-0 rounded-md overflow-hidden border-2 transition ${
                i === activeIndex
                  ? 'border-emerald-500 ring-1 ring-emerald-500/30'
                  : 'border-transparent hover:border-gray-600'
              }`}
            >
              <img
                src={src}
                alt={`Thumb ${i + 1}`}
                className="w-24 h-14 object-cover"
                draggable={false}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
