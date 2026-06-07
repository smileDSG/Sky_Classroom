'use client';

import { useMemo } from 'react';
import type { Slide, PPTElement, PPTTextElement } from '@/lib/types/slides';
import type { PptxThemeId } from '@/lib/slides/types';
import { getTheme } from '@/lib/slides/pptx-themes';

export interface SlideThumbnailProps {
  slide: Slide;
  theme?: PptxThemeId;
  width?: number;
}

const THUMB_W = 240;
const THUMB_H = 135;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function extractTextContent(el: PPTElement): string {
  if (el.type === 'text') {
    return stripHtml((el as PPTTextElement).content || '');
  }
  return '';
}

export function SlideThumbnail({ slide, theme, width = THUMB_W }: SlideThumbnailProps) {
  const scale = width / 1000;
  const h = width * 0.5625;

  const pptxTheme = useMemo(() => (theme ? getTheme(theme) : null), [theme]);

  // Background
  const bg = slide.background;
  const slideBg =
    bg?.type === 'solid' && bg.color
      ? bg.color
      : slide.theme?.backgroundColor || '#ffffff';

  const isThemeCover = slide.type === 'cover' || slide.type === 'end';
  const effectiveBg = pptxTheme
    ? isThemeCover
      ? pptxTheme.coverBg
      : pptxTheme.contentBg
    : slideBg || '#ffffff';

  // Find title
  const titleEl = slide.elements?.find((el) => el.type === 'text');
  const title = titleEl ? extractTextContent(titleEl).slice(0, 24) : '';

  // Find subtitle (second text)
  const textEls = slide.elements?.filter((el) => el.type === 'text') || [];
  const subtitle = textEls[1] ? extractTextContent(textEls[1]).slice(0, 30) : '';

  // Check if has image
  const hasImage = slide.elements?.some((el) => el.type === 'image') || false;

  // Gradient bg for cover if theme has it
  const coverBgStyle = useMemo(() => {
    if (!pptxTheme || !isThemeCover) return {};
    if (pptxTheme.coverBgGradient) {
      return {
        background: `linear-gradient(${pptxTheme.coverBgGradient.angle}deg, ${pptxTheme.coverBgGradient.from}, ${pptxTheme.coverBgGradient.to})`,
      };
    }
    return {};
  }, [pptxTheme, isThemeCover]);

  return (
    <div
      style={{
        width,
        height: h,
        borderRadius: 6 * scale,
        backgroundColor: effectiveBg,
        ...coverBgStyle,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `
          0 1px 2px rgba(0,0,0,0.06),
          0 2px 4px rgba(0,0,0,0.04)
        `,
        flexShrink: 0,
      }}
    >
      {/* Subtle inner highlight */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Cover / end slides: show title prominently */}
      {(slide.type === 'cover' || slide.type === 'end') && (
        <div
          className="flex flex-col items-center justify-center"
          style={{
            width: '100%',
            height: '100%',
            padding: `${12 * scale}px ${16 * scale}px`,
          }}
        >
          {/* Decorative top accent */}
          <div
            style={{
              width: `${24 * scale}px`,
              height: `${3 * scale}px`,
              borderRadius: `${2 * scale}px`,
              backgroundColor: pptxTheme?.accent || '#5b9bd5',
              opacity: 0.4,
              marginBottom: `${8 * scale}px`,
            }}
          />
          <div
            style={{
              fontSize: `${Math.min(14, 18 * scale)}px`,
              fontWeight: 'bold',
              color: pptxTheme?.coverTitleColor || '#1a1a1a',
              textAlign: 'center',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {title || (slide.type === 'end' ? '封底' : '封面')}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: `${Math.min(10, 12 * scale)}px`,
                color: pptxTheme?.coverSubColor || '#666',
                marginTop: `${4 * scale}px`,
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              {subtitle}
            </div>
          )}
          {/* Decorative dots */}
          <div className="flex items-center gap-1" style={{ marginTop: `${8 * scale}px` }}>
            <div
              style={{
                width: `${4 * scale}px`,
                height: `${4 * scale}px`,
                borderRadius: '50%',
                backgroundColor: pptxTheme?.accent || '#5b9bd5',
                opacity: 0.3,
              }}
            />
            <div
              style={{
                width: `${4 * scale}px`,
                height: `${4 * scale}px`,
                borderRadius: '50%',
                backgroundColor: pptxTheme?.accentSecondary || '#ed7d31',
                opacity: 0.3,
              }}
            />
          </div>
        </div>
      )}

      {/* Content slides: mini layout */}
      {slide.type === 'content' && (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          {/* Title bar */}
          {title && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: `${32 * scale}px`,
                padding: `${8 * scale}px ${12 * scale}px`,
                borderBottom: `1px solid ${pptxTheme?.dividerColor || '#e2e8f0'}`,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {/* Mini accent bar */}
              <div
                style={{
                  width: `${3 * scale}px`,
                  height: `${12 * scale}px`,
                  borderRadius: `${2 * scale}px`,
                  backgroundColor: pptxTheme?.accent || '#5b9bd5',
                  marginRight: `${6 * scale}px`,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  fontSize: `${Math.min(11, 14 * scale)}px`,
                  fontWeight: 'bold',
                  color: pptxTheme?.bodyColor || '#333',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title}
              </div>
            </div>
          )}

          {/* Content preview */}
          <div
            style={{
              position: 'absolute',
              top: `${32 * scale}px`,
              left: 0,
              right: 0,
              bottom: 0,
              padding: `${8 * scale}px ${12 * scale}px`,
            }}
          >
            {/* Show bullet indicators or image placeholder */}
            {hasImage ? (
              <div className="flex gap-1.5" style={{ height: '100%' }}>
                <div
                  style={{
                    width: '45%',
                    height: '65%',
                    backgroundColor: pptxTheme?.accentLight || '#f1f5f9',
                    borderRadius: `${3 * scale}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: `${Math.min(8, 10 * scale)}px`,
                    color: pptxTheme?.bodyMutedColor || '#94a3b8',
                    border: `1px dashed ${pptxTheme?.dividerColor || '#e2e8f0'}`,
                  }}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex flex-1 flex-col gap-1 pt-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <div
                        style={{
                          width: `${3 * scale}px`,
                          height: `${3 * scale}px`,
                          borderRadius: '50%',
                          backgroundColor: pptxTheme?.accent || '#5b9bd5',
                          opacity: 0.4,
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          height: `${5 * scale}px`,
                          backgroundColor: pptxTheme?.dividerColor || '#e2e8f0',
                          borderRadius: `${1 * scale}px`,
                          width: `${50 + ((slide.id ? slide.id.charCodeAt(0) + i * 7 : 0) % 30)}%`,
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {Array.from({ length: Math.min(4, Math.max(1, textEls.length - 1)) }).map(
                  (_, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div
                        style={{
                          width: `${4 * scale}px`,
                          height: `${4 * scale}px`,
                          borderRadius: '50%',
                          backgroundColor: pptxTheme?.accent || '#5b9bd5',
                          opacity: 0.5,
                          flexShrink: 0,
                        }}
                      />
                      <div
                        style={{
                          height: `${6 * scale}px`,
                          backgroundColor: pptxTheme?.dividerColor || '#e2e8f0',
                          borderRadius: `${2 * scale}px`,
                          width: `${60 + ((slide.id ? slide.id.charCodeAt(0) + i * 7 : 0) % 30)}%`,
                        }}
                      />
                    </div>
                  ),
                )}
              </div>
            )}
          </div>

          {/* Bottom accent line */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: `${2 * scale}px`,
              background: pptxTheme?.accent
                ? `linear-gradient(90deg, ${pptxTheme.accent}, ${pptxTheme.accentSecondary || pptxTheme.accent})`
                : '#5b9bd5',
              opacity: 0.4,
            }}
          />
        </div>
      )}
    </div>
  );
}
