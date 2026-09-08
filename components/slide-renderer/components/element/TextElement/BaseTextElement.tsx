'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PPTTextElement } from '@/lib/types/slides';
import { useElementShadow } from '../hooks/useElementShadow';
import { ElementOutline } from '../ElementOutline';

export interface BaseTextElementProps {
  elementInfo: PPTTextElement;
  target?: string;
  playback?: boolean;
}

const SLIDE_FONT_STACK =
  'Noto Sans SC, Microsoft YaHei, PingFang SC, Source Han Sans SC, Arial, sans-serif';

function normalizeInlineTypography(html: string): string {
  return html
    .replace(/font-family\s*:\s*[^;"]+;?/gi, '')
    .replace(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi, (_match, size) => {
      const numeric = Number(size);
      if (!Number.isFinite(numeric)) return `font-size:${size}px`;
      return `font-size:${Math.max(15, numeric)}px`;
    });
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Base text element component (read-only)
 * Renders static text content with styling
 */
export function BaseTextElement({ elementInfo, target, playback = false }: BaseTextElementProps) {
  const { shadowStyle } = useElementShadow(elementInfo.shadow);
  const textRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [qaStatus, setQaStatus] = useState<'pass' | 'scale-down' | 'overflow'>('pass');
  const displayContent = useMemo(
    () => normalizeInlineTypography(elementInfo.content),
    [elementInfo.content],
  );
  const fontFamily = elementInfo.defaultFontName?.trim() || SLIDE_FONT_STACK;
  const minScale = elementInfo.textType === 'title' ? 0.8 : playback ? 0.82 : 0.62;
  const hasLongText = stripHtml(displayContent).length > 90;

  useLayoutEffect(() => {
    const node = textRef.current;
    if (!node || elementInfo.vertical) return;

    const availableWidth = Math.max(1, elementInfo.width - 20);
    const availableHeight = Math.max(1, elementInfo.height - 20);
    const naturalWidth = Math.max(node.scrollWidth, node.getBoundingClientRect().width);
    const naturalHeight = Math.max(node.scrollHeight, node.getBoundingClientRect().height);

    if (naturalWidth <= 0 || naturalHeight <= 0) return;

    const nextScale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
    const safeScale = Number.isFinite(nextScale) ? Math.max(minScale, nextScale) : 1;
    const hasUnresolvedOverflow =
      nextScale < minScale &&
      (naturalWidth * minScale > availableWidth + 1 ||
        naturalHeight * minScale > availableHeight + 1);
    const hasTinyReadableText = safeScale < 0.78;
    const frame = requestAnimationFrame(() => {
      setScale(safeScale);
      setQaStatus(hasUnresolvedOverflow ? 'overflow' : hasTinyReadableText ? 'scale-down' : 'pass');
    });
    return () => cancelAnimationFrame(frame);
  }, [
    displayContent,
    elementInfo.height,
    elementInfo.lineHeight,
    elementInfo.textType,
    elementInfo.width,
    elementInfo.wordSpace,
    elementInfo.vertical,
    minScale,
  ]);

  return (
    <div
      className="base-element-text relative w-full h-full overflow-hidden"
      data-slide-qa-element-id={elementInfo.id}
      data-slide-qa-element-type="text"
      data-slide-qa-status={qaStatus}
      data-slide-qa-scale={scale.toFixed(3)}
      data-slide-qa-overflow={qaStatus === 'overflow' ? 'true' : 'false'}
    >
      <div
        className="rotate-wrapper w-full h-full"
        style={{ transform: `rotate(${elementInfo.rotate}deg)` }}
      >
        <div
          className="element-content relative p-[10px] leading-[1.5] break-words"
          style={{
            width: elementInfo.vertical ? 'auto' : '100%',
            height: elementInfo.vertical ? `${elementInfo.height}px` : `${elementInfo.height}px`,
            display: 'flex',
            alignItems: hasLongText ? 'flex-start' : 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            backgroundColor: elementInfo.fill,
            opacity: elementInfo.opacity,
            textShadow: shadowStyle,
            lineHeight: elementInfo.lineHeight || 1.5,
            letterSpacing: `${elementInfo.wordSpace || 0}px`,
            color: elementInfo.defaultColor,
            fontFamily,
            writingMode: elementInfo.vertical ? 'vertical-rl' : 'horizontal-tb',
            textRendering: 'optimizeLegibility',
            WebkitFontSmoothing: 'antialiased',
            // @ts-expect-error - CSS custom property
            '--paragraphSpace': `${elementInfo.paragraphSpace === undefined ? 5 : elementInfo.paragraphSpace}px`,
          }}
        >
          <ElementOutline
            width={elementInfo.width}
            height={elementInfo.height}
            outline={elementInfo.outline}
          />
          <div
            ref={textRef}
            className={`text ProseMirror-static relative ${target === 'thumbnail' ? 'pointer-events-none' : ''}`}
            style={{
              transform: `scale(${scale})`,
              // Scale from the center so a shrunken block stays anchored/centered instead of
              // drifting (previously top-left origin + width compensation conflicted with
              // the flex centering of the parent, causing text misalignment).
              transformOrigin: elementInfo.vertical
                ? 'top right'
                : hasLongText
                  ? 'center top'
                  : 'center center',
              width: '100%',
              fontFamily: 'inherit',
              overflowWrap: 'anywhere',
              wordBreak: 'normal',
              maxHeight: '100%',
            }}
            dangerouslySetInnerHTML={{ __html: displayContent }}
          />
        </div>
      </div>
    </div>
  );
}
