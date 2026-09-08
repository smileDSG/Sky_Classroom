/**
 * PPT display panel — slide viewer with switching and fullscreen.
 */

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Maximize, Minimize, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Scene } from '@/lib/types/stage';

interface PptViewerProps {
  scenes: Scene[];
  currentSlideIndex: number;
  onSlideChange: (index: number) => void;
  visible: boolean;
  onClose: () => void;
  onToggleFullscreen?: () => void;
  isFullscreen?: boolean;
}

export function PptViewer({
  scenes,
  currentSlideIndex,
  onSlideChange,
  visible,
  onClose,
  onToggleFullscreen,
  isFullscreen,
}: PptViewerProps) {
  if (!visible) return null;

  const slideScenes = scenes.filter((s) => s.type === 'slide');
  const activeSlide = slideScenes[currentSlideIndex];

  return (
    <div
      className={cn(
        'flex flex-col bg-slate-50 dark:bg-black text-slate-800 dark:text-white transition-all duration-300',
        isFullscreen
          ? 'fixed inset-0 z-[200]'
          : 'w-80 shrink-0 border-l border-sky-200/50 dark:border-slate-700',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sky-200/50 dark:border-white/20">
        <span className="text-sm font-medium">Slides</span>
        <div className="flex items-center gap-1">
          {onToggleFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-slate-600 dark:text-white hover:bg-sky-100 dark:hover:bg-white/10"
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 text-slate-600 dark:text-white hover:bg-sky-100 dark:hover:bg-white/10"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Slide Display */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        {activeSlide ? (
          <div className="w-full aspect-video bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center text-center p-4 shadow-sm border border-sky-200/50 dark:border-slate-700">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-slate-800 dark:text-white">
                {activeSlide.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Slide {currentSlideIndex + 1} of {slideScenes.length}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">No slides in this scene</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-sky-200/50 dark:border-white/20">
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-slate-600 dark:text-white hover:bg-sky-100 dark:hover:bg-white/10"
          disabled={currentSlideIndex === 0}
          onClick={() => onSlideChange(Math.max(0, currentSlideIndex - 1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {currentSlideIndex + 1} / {slideScenes.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="w-8 h-8 text-slate-600 dark:text-white hover:bg-sky-100 dark:hover:bg-white/10"
          disabled={currentSlideIndex >= slideScenes.length - 1}
          onClick={() => onSlideChange(Math.min(slideScenes.length - 1, currentSlideIndex + 1))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Thumbnail Strip */}
      <div className="flex gap-2 px-3 py-2 overflow-x-auto border-t border-sky-200/30 dark:border-white/10 max-h-20 bg-sky-50/50 dark:bg-slate-900">
        {slideScenes.map((scene, i) => (
          <button
            key={scene.id}
            className={cn(
              'w-16 h-10 shrink-0 rounded border-2 transition-colors text-xs flex items-center justify-center',
              i === currentSlideIndex
                ? 'border-sky-500 dark:border-white bg-sky-100 dark:bg-white/20'
                : 'border-sky-200/50 dark:border-white/30 bg-white dark:bg-white/5 hover:bg-sky-50 dark:hover:bg-white/10',
            )}
            onClick={() => onSlideChange(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
