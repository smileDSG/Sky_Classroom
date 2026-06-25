'use client';

import { useMemo, type CSSProperties } from 'react';
import { Play } from 'lucide-react';
import type { PPTElement, PPTVideoElement, Slide } from '@/lib/types/slides';
import type { PPTVideoElement as MaicVideoElement, Slide as MaicSlide } from '@maic/dsl';
import { SlideCanvas } from '@maic/renderer';
import { useMediaStageId } from '@/lib/contexts/media-stage-context';
import { getVideoMediaRefForElement } from '@/lib/media/video-manifest';
import { isMediaPlaceholder, useMediaGenerationStore } from '@/lib/store/media-generation';

interface ThumbnailSlideProps {
  /** Slide data */
  readonly slide: Slide;
  /** Thumbnail width. When omitted, the thumbnail fills its parent. */
  readonly size?: number;
  /** Viewport width base. Kept for call-site compatibility. */
  readonly viewportSize?: number;
  /** Viewport aspect ratio. */
  readonly viewportRatio: number;
  /** Whether visible (for lazy loading optimization) */
  readonly visible?: boolean;
}

function mediaTaskKeyFor(el: PPTElement): string | undefined {
  if (el.type === 'video') return getVideoMediaRefForElement(el);
  if (el.type === 'image' && el.src && isMediaPlaceholder(el.src)) return el.src;
  return undefined;
}

function useResolvedSlide(slide: Slide): Slide {
  const stageId = useMediaStageId();

  const signature = useMediaGenerationStore((s) => {
    if (!stageId) return '';
    let sig = '';
    for (const el of slide.elements) {
      const key = mediaTaskKeyFor(el);
      if (!key) continue;
      const task = s.tasks[key];
      const url =
        task && task.stageId === stageId && task.status === 'done' && task.objectUrl
          ? task.objectUrl
          : '';
      sig += `${key}|${url}|`;
    }
    return sig;
  });

  return useMemo(() => {
    if (!stageId || !signature) return slide;
    const { tasks } = useMediaGenerationStore.getState();
    const elements = slide.elements.map((el) => {
      const key = mediaTaskKeyFor(el);
      if (!key) return el;
      const task = tasks[key];
      if (task && task.stageId === stageId && task.status === 'done' && task.objectUrl) {
        return el.type === 'video'
          ? ({ ...el, src: task.objectUrl, poster: task.poster ?? el.poster } as PPTVideoElement)
          : { ...el, src: task.objectUrl };
      }
      if ((el.type === 'image' || el.type === 'video') && el.src && isMediaPlaceholder(el.src)) {
        return { ...el, src: '' };
      }
      return el;
    });
    return { ...slide, elements };
  }, [slide, stageId, signature]);
}

function renderThumbnailVideo(element: MaicVideoElement) {
  const src = element.src && !isMediaPlaceholder(element.src) ? element.src : undefined;
  return (
    <>
      {src ? (
        <video
          className="h-full w-full"
          style={{ objectFit: 'contain' }}
          src={src}
          poster={element.poster}
          preload="metadata"
          muted
          playsInline
        />
      ) : (
        <div className="h-full w-full rounded bg-black/10" />
      )}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        data-testid="thumbnail-video-indicator"
      >
        <div className="flex size-28 items-center justify-center rounded-full bg-black/45 shadow-lg ring-2 ring-white/85">
          <Play className="ml-1 size-14 fill-white text-white" />
        </div>
      </div>
    </>
  );
}

export function ThumbnailSlide({ slide, size, viewportRatio, visible = true }: ThumbnailSlideProps) {
  const resolvedSlide = useResolvedSlide(slide);
  const autoSize = size === undefined;

  const containerClass = autoSize
    ? 'thumbnail-slide relative h-full w-full overflow-hidden bg-white select-none pointer-events-none'
    : 'thumbnail-slide relative overflow-hidden bg-white select-none pointer-events-none';
  const containerStyle: CSSProperties | undefined = autoSize
    ? undefined
    : { width: `${size}px`, height: `${size * viewportRatio}px` };

  if (!visible) {
    return (
      <div className={containerClass} style={containerStyle}>
        <div className="placeholder flex h-full w-full items-center justify-center text-sm text-gray-400">
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass} style={containerStyle}>
      <SlideCanvas
        slide={resolvedSlide as unknown as MaicSlide}
        chrome={false}
        renderVideo={renderThumbnailVideo}
      />
    </div>
  );
}
