'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import type { Slide, PPTElement, PPTTextElement } from '@/lib/types/slides';
import type { PptxThemeId, ThemeToken } from '@/lib/slides/types';
import { getTheme } from '@/lib/slides/pptx-themes';
import { getAllThemes } from '@/lib/slides/themes/modern-editor';
import { getLuminance, isDarkBg } from '@/lib/slides/color-utils';
import { useTheme } from '@/lib/hooks/use-theme';

export interface SlideViewerProps {
  slide: Slide | null;
  theme?: PptxThemeId;
}

// ── Constants ──────────────────────────────────────────────────────

const CANVAS_W = 1000;
const CANVAS_H = 562.5;

// ── Color utils (imported from color-utils.ts) ───────────────────

// ── Text Renderer ──────────────────────────────────────────────────

// Lazy-init DOMParser (SSR-safe: only created on client)
let DOM_PARSER: DOMParser | null = null;
function getDOMParser(): DOMParser {
  if (!DOM_PARSER) DOM_PARSER = new DOMParser();
  return DOM_PARSER;
}

function renderTextElement(el: PPTTextElement, scale: number, ctx?: ThemeRenderContext): React.ReactNode {
  const { content, defaultColor, defaultFontName } = el;
  // Parse inline styles from HTML content
  const doc = getDOMParser().parseFromString(`<div>${content}</div>`, 'text/html');
  const paragraphs = Array.from(doc.body.querySelectorAll('p'));

  // Resolve text color: bidirectional override for readability
  const textColorOverride = ctx?.textColorOverride;
  const isDark = ctx?.isDark ?? false;

  function resolveColor(parsed: string): string {
    if (!textColorOverride) return parsed;
    const lum = getLuminance(parsed);
    // Dark background + dark text → light override
    if (isDark && lum < 0.5) return textColorOverride;
    // Light background + light text → dark override
    if (!isDark && lum > 0.6) return textColorOverride;
    return parsed;
  }

  const containerColor = textColorOverride
    ? resolveColor(defaultColor || '#333')
    : defaultColor || '#333';

  return (
    <div
      className="flex flex-col justify-center"
      style={{
        width: '100%',
        height: '100%',
        fontFamily: defaultFontName || 'Microsoft YaHei',
        color: containerColor,
        overflow: 'hidden',
        wordBreak: 'break-word',
      }}
    >
      {paragraphs.map((p, i) => {
        const fontSize = parseInt(p.style.fontSize) || 16;
        const parsedColor = p.style.color || defaultColor || '#333';
        const color = resolveColor(parsedColor);
        const textAlign = (p.style.textAlign as React.CSSProperties['textAlign']) || 'left';
        const fontWeight = p.style.fontWeight;
        const fontStyle = p.style.fontStyle;
        const lineHeight = parseFloat(p.style.lineHeight) || 1.5;

        return (
          <div
            key={i}
            style={{
              fontSize: `${fontSize * scale}px`,
              color,
              textAlign,
              fontWeight: fontWeight === 'bold' ? 'bold' : 'normal',
              fontStyle: fontStyle === 'italic' ? 'italic' : 'normal',
              lineHeight,
              marginBottom: i < paragraphs.length - 1 ? `${4 * scale}px` : 0,
            }}
          >
            {p.textContent}
          </div>
        );
      })}
    </div>
  );
}

// ── Shape Renderer ─────────────────────────────────────────────────

function renderShapeElement(el: PPTElement & Record<string, unknown>, scale: number, ctx?: ThemeRenderContext): React.ReactNode {
  const fill = (el.fill as string) || '#5b9bd5';
  const opacity = (el.opacity as number) || 1;
  const outline = el.outline as { color?: string; width?: number } | undefined;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: fill,
        opacity,
        borderRadius:
          el.path && (el.path as string).includes('roundRect')
            ? `${8 * scale}px`
            : el.path && (el.path as string).includes('ellipse')
              ? '50%'
              : 0,
        border: outline
          ? `${outline.width || 1}px solid ${outline.color || (ctx?.isDark ? 'rgba(255,255,255,0.15)' : '#ccc')}`
          : undefined,
      }}
    />
  );
}

// ── Line Renderer ──────────────────────────────────────────────────

function renderLineElement(el: PPTElement & Record<string, unknown>): React.ReactNode {
  const color = (el.color as string) || '#333';
  const width = (el.width as number) || 2;
  const start = (el.start as [number, number]) || [0, 0];
  const end = (el.end as [number, number]) || [el.width, 0];

  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${length}px`,
        height: `${width}px`,
        backgroundColor: color,
        transformOrigin: '0 50%',
        transform: `rotate(${angle}deg)`,
      }}
    />
  );
}

// ── LaTeX Renderer ─────────────────────────────────────────────────

function renderLatexElement(el: PPTElement & Record<string, unknown>, scale: number, ctx?: ThemeRenderContext): React.ReactNode {
  const latex = (el.latex as string) || '';
  const rawColor = (el.color as string) || '#333';
  const color = ctx?.isDark && getLuminance(rawColor) > 0.6
    ? (ctx.bodyColor || '#e2e8f0')
    : rawColor;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: (el.align as string) || 'center',
        fontSize: `${18 * scale}px`,
        color,
        fontFamily: 'KaTeX_Main, Times New Roman, serif',
        overflow: 'hidden',
      }}
    >
      {latex}
    </div>
  );
}

// ── Image Renderer ─────────────────────────────────────────────────

function renderImageElement(el: PPTElement & Record<string, unknown>, ctx?: ThemeRenderContext): React.ReactNode {
  const src = (el.src as string) || '';

  if (!src) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ctx?.isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
          color: ctx?.isDark ? '#64748b' : '#94a3b8',
          fontSize: '14px',
          borderRadius: '4px',
        }}
      >
        [图片]
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
      }}
      draggable={false}
    />
  );
}

// ── Table Renderer ─────────────────────────────────────────────────

function renderTableElement(el: PPTElement & Record<string, unknown>, scale: number, ctx?: ThemeRenderContext): React.ReactNode {
  const headers = (el.headers as string[]) || [];
  const rows = (el.rows as string[][]) || [];
  const borderColor = ctx?.isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0';
  const headerBg = ctx?.isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9';
  const rowBgAlt = ctx?.isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc';
  const textColor = ctx?.isDark ? '#e2e8f0' : undefined;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        fontSize: `${14 * scale}px`,
        color: textColor,
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: `${14 * scale}px`,
        }}
      >
        {headers.length > 0 && (
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={i}
                  style={{
                    border: `1px solid ${borderColor}`,
                    padding: `${8 * scale}px`,
                    backgroundColor: headerBg,
                    fontWeight: 'bold',
                    textAlign: 'center',
                    color: textColor,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ backgroundColor: ri % 2 === 1 ? rowBgAlt : undefined }}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    border: `1px solid ${borderColor}`,
                    padding: `${8 * scale}px`,
                    textAlign: 'center',
                    color: textColor,
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Theme Render Context ─────────────────────────────────────────

interface ThemeRenderContext {
  isDark: boolean;
  accent: string;
  accentLight: string;
  dividerColor: string;
  bodyMutedColor: string;
  bodyColor: string;
  coverTitleColor: string;
  textColorOverride?: string;
}

// ── Theme Color Adaptation ─────────────────────────────────────────

/**
 * Infer the original theme from slide.theme metadata.
 * slide.theme.themeColors order: [accent, accentSecondary, dividerColor, bodyMutedColor, coverSubColor]
 */
function inferThemeFromSlide(slide: Slide): ThemeToken | null {
  const st = slide.theme;
  if (!st) return null;
  const tc = st.themeColors;
  if (!tc || tc.length < 3) return null;

  for (const t of getAllThemes()) {
    if (
      (t.coverBg === st.backgroundColor || t.contentBg === st.backgroundColor) &&
      t.accent === tc[0] &&
      t.accentSecondary === tc[1] &&
      t.dividerColor === tc[2]
    ) {
      return t;
    }
  }
  return null;
}

/** Build a color map from old theme to new theme */
function buildColorMap(oldTheme: ThemeToken, newTheme: ThemeToken): Map<string, string> {
  const map = new Map<string, string>();
  const pairs: [string, string][] = [
    [oldTheme.coverBg, newTheme.coverBg],
    [oldTheme.contentBg, newTheme.contentBg],
    [oldTheme.accent, newTheme.accent],
    [oldTheme.accentSecondary, newTheme.accentSecondary],
    [oldTheme.accentLight, newTheme.accentLight],
    [oldTheme.coverTitleColor, newTheme.coverTitleColor],
    [oldTheme.coverSubColor, newTheme.coverSubColor],
    [oldTheme.bodyColor, newTheme.bodyColor],
    [oldTheme.bodyMutedColor, newTheme.bodyMutedColor],
    [oldTheme.dividerColor, newTheme.dividerColor],
    [oldTheme.pageNumColor, newTheme.pageNumColor],
    [oldTheme.shapeOutlineColor, newTheme.shapeOutlineColor],
  ];
  for (const [old, neo] of pairs) {
    if (old && old !== neo) map.set(old, neo);
  }
  // Also map rgba versions of accentLight if they share the same base color
  // (e.g. tech-dark accentLight is rgba(56,189,248,0.15))
  return map;
}

/** Replace colors inside HTML string using the color map */
function adaptHtmlColors(html: string, colorMap: Map<string, string>): string {
  if (colorMap.size === 0) return html;
  let result = html;
  for (const [old, neo] of colorMap.entries()) {
    // Replace exact color values in style attributes (with or without space, ending with ; or ")
    const hexEsc = old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const colorRe = new RegExp(`color:\\s*${hexEsc}(?=[;"'])`, 'g');
    result = result.replace(colorRe, `color:${neo}`);
    // Also handle rgba variants by matching the base hex inside rgba()
    if (old.startsWith('#') && old.length === 7) {
      const r = parseInt(old.slice(1, 3), 16);
      const g = parseInt(old.slice(3, 5), 16);
      const b = parseInt(old.slice(5, 7), 16);
      const rgbaRe = new RegExp(`rgba\\(${r},\\s*${g},\\s*${b}`, 'g');
      const nr = parseInt(neo.slice(1, 3), 16);
      const ng = parseInt(neo.slice(3, 5), 16);
      const nb = parseInt(neo.slice(5, 7), 16);
      result = result.replace(rgbaRe, `rgba(${nr},${ng},${nb}`);
    }
  }
  return result;
}

/** Adapt element colors from old theme to new theme */
function adaptElementColors(el: PPTElement, colorMap: Map<string, unknown>): PPTElement {
  const map = colorMap as Map<string, string>;
  const newEl = { ...el } as PPTElement & Record<string, unknown>;

  // Text element
  if (newEl.type === 'text') {
    const te = newEl as PPTElement & {
      defaultColor?: string;
      fill?: string;
      content?: string;
    };
    if (te.defaultColor) {
      const neo = map.get(te.defaultColor);
      if (neo) te.defaultColor = neo;
    }
    if (te.fill) {
      const neo = map.get(te.fill as string);
      if (neo) te.fill = neo;
    }
    if (typeof te.content === 'string') {
      te.content = adaptHtmlColors(te.content, map);
    }
  }

  // Shape element
  if (newEl.type === 'shape') {
    const se = newEl as PPTElement & {
      fill?: string;
      outline?: { color?: string };
    };
    if (se.fill) {
      const neo = map.get(se.fill as string);
      if (neo) se.fill = neo;
    }
    if (se.outline?.color) {
      const neo = map.get(se.outline.color);
      if (neo) se.outline = { ...se.outline, color: neo };
    }
  }

  // Line element
  if (newEl.type === 'line') {
    const le = newEl as PPTElement & { color?: string };
    if (le.color) {
      const neo = map.get(le.color);
      if (neo) le.color = neo;
    }
  }

  // LaTeX element
  if (newEl.type === 'latex') {
    const le = newEl as PPTElement & { color?: string };
    if (le.color) {
      const neo = map.get(le.color);
      if (neo) le.color = neo;
    }
  }

  return newEl;
}

/** Create a slide with colors adapted to the preview theme */
function adaptSlideColors(slide: Slide, newTheme: ThemeToken): Slide {
  const oldTheme = inferThemeFromSlide(slide);
  if (!oldTheme || oldTheme.id === newTheme.id) return slide;

  const colorMap = buildColorMap(oldTheme, newTheme);
  if (colorMap.size === 0) return slide;

  const newSlide = { ...slide };

  // Adapt elements
  newSlide.elements = (slide.elements || []).map((el) => adaptElementColors(el, colorMap));

  // Adapt background
  if (newSlide.background) {
    newSlide.background = { ...newSlide.background };
    if (newSlide.background.color) {
      const neo = colorMap.get(newSlide.background.color);
      if (neo) newSlide.background.color = neo;
    }
    if (newSlide.background.gradient) {
      const g = { ...newSlide.background.gradient };
      g.colors = g.colors.map((gc) => {
        const neo = colorMap.get(gc.color);
        return neo ? { ...gc, color: neo } : gc;
      });
      newSlide.background.gradient = g;
    }
  }

  // Adapt slide.theme metadata
  if (newSlide.theme) {
    newSlide.theme = { ...newSlide.theme };
    if (newSlide.theme.backgroundColor) {
      const neo = colorMap.get(newSlide.theme.backgroundColor);
      if (neo) newSlide.theme.backgroundColor = neo;
    }
    if (newSlide.theme.fontColor) {
      const neo = colorMap.get(newSlide.theme.fontColor);
      if (neo) newSlide.theme.fontColor = neo;
    }
    if (newSlide.theme.themeColors) {
      newSlide.theme.themeColors = newSlide.theme.themeColors.map((c) =>
        colorMap.get(c) || c,
      );
    }
  }

  return newSlide;
}

// ── Element Dispatcher ─────────────────────────────────────────────

function renderElement(el: PPTElement, scale: number, ctx?: ThemeRenderContext): React.ReactNode {
  switch (el.type) {
    case 'text':
      return renderTextElement(el as PPTTextElement, scale, ctx);
    case 'shape':
      return renderShapeElement(el as PPTElement & Record<string, unknown>, scale, ctx);
    case 'line':
      return renderLineElement(el as PPTElement & Record<string, unknown>);
    case 'latex':
      return renderLatexElement(el as PPTElement & Record<string, unknown>, scale, ctx);
    case 'image':
      return renderImageElement(el as PPTElement & Record<string, unknown>, ctx);
    case 'table':
      return renderTableElement(el as PPTElement & Record<string, unknown>, scale, ctx);
    default:
      return null;
  }
}

// ── Main Component ─────────────────────────────────────────────────

export function SlideViewer({ slide, theme }: SlideViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [visible, setVisible] = useState(false);
  const [prevSlideId, setPrevSlideId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';

  const pptxTheme = useMemo(() => (theme ? getTheme(theme) : null), [theme]);

  // Adapt slide colors to preview theme
  const adaptedSlide = useMemo(() => {
    if (!slide || !pptxTheme) return slide;
    return adaptSlideColors(slide, pptxTheme);
  }, [slide, pptxTheme]);

  // Use adapted slide for rendering (fallback to original if no adaptation)
  const renderSlide = adaptedSlide || slide;

  // Slide transition animation
  useEffect(() => {
    if (slide && slide.id !== prevSlideId) {
      setIsTransitioning(true);
      setVisible(false);
      const id = setTimeout(() => {
        setVisible(true);
        setIsTransitioning(false);
      }, 200);
      setPrevSlideId(slide.id);
      return () => clearTimeout(id);
    } else if (slide) {
      setVisible(true);
      setIsTransitioning(false);
    }
  }, [slide, prevSlideId]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current || !slide?.viewportSize) return;

    const resize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w <= 64 || h <= 64 || !slide.viewportSize) return;

      const targetW = slide.viewportSize;
      const targetH = targetW * (slide.viewportRatio || 0.5625);
      const scaleX = (w - 64) / targetW;
      const scaleY = (h - 64) / targetH;
      setScale(Math.min(scaleX, scaleY, 1.2));
    };

    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [slide]);

  // Empty state
  if (!slide) {
    return (
      <div
        ref={containerRef}
        className="flex h-full items-center justify-center"
        style={{
          backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
          backgroundImage: isDarkMode
            ? undefined
            : `
            radial-gradient(circle at 20% 50%, rgba(96,165,250,0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 50%, rgba(167,139,250,0.06) 0%, transparent 50%)
          `,
        }}
      >
        <div className="text-center">
          {/* Animated illustration */}
          <div className="relative mx-auto mb-6" style={{ width: 120, height: 120 }}>
            <div className={`absolute inset-0 rounded-3xl ${isDarkMode ? 'bg-blue-900/30' : 'bg-gradient-to-br from-blue-100 to-indigo-100 opacity-60'}`} />
            <div className={`absolute inset-2 rounded-2xl shadow-lg ring-1 ${isDarkMode ? 'bg-gray-800/80 shadow-blue-900/20 ring-white/5' : 'bg-white/80 backdrop-blur-sm shadow-blue-100/50 ring-white/50'}`} />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className={`h-12 w-12 ${isDarkMode ? 'text-blue-300' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            {/* Floating dots */}
            <div className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-gradient-to-br from-amber-300 to-orange-300 shadow-md animate-bounce" style={{ animationDuration: '2s' }} />
            <div className="absolute -bottom-1 -left-1 h-3 w-3 rounded-full bg-gradient-to-br from-emerald-300 to-teal-300 shadow-sm animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
            <div className="absolute -right-2 bottom-4 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-rose-300 to-pink-300 shadow-sm animate-bounce" style={{ animationDuration: '3s', animationDelay: '1s' }} />
          </div>
          <h3 className={`mb-1 text-base font-bold ${isDarkMode ? 'text-gray-200' : 'text-slate-700'}`}>准备就绪</h3>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`}>
            输入教学主题，AI 将为您生成精美课件
          </p>
          <div className={`mt-4 flex items-center justify-center gap-2 text-xs ${isDarkMode ? 'text-gray-500' : 'text-slate-300'}`}>
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI 生成
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              虚拟讲解
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              PPTX 导出
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Background
  const bg = slide.background;
  const hasBgImage = bg?.type === 'image' && bg.image?.src;
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

  // Build theme render context for element-aware coloring
  const themeCtx: ThemeRenderContext | undefined = pptxTheme
    ? {
        isDark: isDarkBg(effectiveBg),
        accent: pptxTheme.accent,
        accentLight: pptxTheme.accentLight,
        dividerColor: pptxTheme.dividerColor,
        bodyMutedColor: pptxTheme.bodyMutedColor,
        bodyColor: pptxTheme.bodyColor,
        coverTitleColor: pptxTheme.coverTitleColor,
        textColorOverride: isThemeCover
          ? pptxTheme.coverTitleColor
          : pptxTheme.bodyColor,
      }
    : undefined;

  // Slide dimensions
  const slideW = (slide.viewportSize || CANVAS_W) * scale;
  const slideH = (slide.viewportSize || CANVAS_W) * (slide.viewportRatio || 0.5625) * scale;

  return (
    <div
      ref={containerRef}
      className="flex h-full items-center justify-center overflow-hidden"
      style={{
        backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc',
        backgroundImage: isDarkMode
          ? undefined
          : `
          radial-gradient(ellipse 80% 50% at 20% 40%, rgba(96, 165, 250, 0.07) 0%, transparent 50%),
          radial-gradient(ellipse 60% 40% at 80% 60%, rgba(167, 139, 250, 0.05) 0%, transparent 50%),
          radial-gradient(ellipse 50% 30% at 50% 100%, rgba(99, 102, 241, 0.03) 0%, transparent 50%)
        `,
      }}
    >
      {/* Slide container with physical projection effect */}
      <div
        className="relative"
        style={{
          width: slideW,
          height: slideH,
          opacity: visible ? 1 : 0,
          transform: visible
            ? isTransitioning
              ? `scale(0.96) translateY(4px)`
              : `scale(1) translateY(0)`
            : `scale(0.98) translateY(8px)`,
          transition: isTransitioning
            ? 'opacity 200ms ease-out, transform 200ms ease-out'
            : 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Shadow layers for physical depth */}
        <div
          className="absolute"
          style={{
            left: -2 * scale,
            top: 2 * scale,
            width: slideW + 4 * scale,
            height: slideH,
            borderRadius: `${8 * scale}px`,
            backgroundColor: 'rgba(0,0,0,0.08)',
            filter: 'blur(8px)',
            transform: 'translateY(4px)',
            zIndex: 0,
          }}
        />
        <div
          className="absolute"
          style={{
            left: -1 * scale,
            top: 1 * scale,
            width: slideW + 2 * scale,
            height: slideH,
            borderRadius: `${6 * scale}px`,
            backgroundColor: 'rgba(0,0,0,0.15)',
            filter: 'blur(2px)',
            transform: 'translateY(2px)',
            zIndex: 0,
          }}
        />

        {/* Reflection */}
        <div
          className="absolute"
          style={{
            left: 0,
            top: slideH + 4 * scale,
            width: slideW,
            height: slideH * 0.3,
            borderRadius: `${6 * scale}px`,
            background: `linear-gradient(to bottom, ${effectiveBg} 0%, transparent 100%)`,
            opacity: 0.06,
            transform: 'scaleY(-1)',
            filter: 'blur(2px)',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Main slide */}
        <div
          className="relative overflow-hidden"
          style={{
            width: slideW,
            height: slideH,
            borderRadius: `${6 * scale}px`,
            backgroundColor: hasBgImage ? undefined : effectiveBg,
            backgroundImage: hasBgImage ? `url(${bg!.image!.src})` : undefined,
            backgroundSize: hasBgImage ? 'cover' : undefined,
            backgroundPosition: hasBgImage ? 'center' : undefined,
            boxShadow: `
              0 1px 2px rgba(0,0,0,0.05),
              0 4px 8px rgba(0,0,0,0.06),
              0 16px 32px rgba(0,0,0,0.08),
              inset 0 0 0 1px rgba(255,255,255,0.1)
            `,
            zIndex: 1,
          }}
        >
          {renderSlide!.elements.map((el) => {
            const { left, top, width, height, rotate = 0 } = el as PPTElement & {
              height: number;
              rotate: number;
            };

            return (
              <div
                key={el.id}
                className="absolute"
                style={{
                  left: left * scale,
                  top: top * scale,
                  width: width * scale,
                  height: height * scale,
                  transform: rotate ? `rotate(${rotate}deg)` : undefined,
                }}
              >
                {renderElement(el, scale, themeCtx)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
