'use client';

import { useRef, useEffect, useState } from 'react';
import type { Slide, PPTElement } from '@/lib/types/slides';
import { BaseTextElement } from '@/components/slide-renderer/components/element/TextElement/BaseTextElement';
import { BaseShapeElement } from '@/components/slide-renderer/components/element/ShapeElement/BaseShapeElement';
import { BaseLineElement } from '@/components/slide-renderer/components/element/LineElement/BaseLineElement';
import { BaseLatexElement } from '@/components/slide-renderer/components/element/LatexElement/BaseLatexElement';

export interface SlideViewerProps {
  slide: Slide | null;
}

function renderElement(el: PPTElement) {
  switch (el.type) {
    case 'text':
      return <BaseTextElement key={el.id} elementInfo={el} />;
    case 'shape':
      return <BaseShapeElement key={el.id} elementInfo={el} />;
    case 'line':
      return <BaseLineElement key={el.id} elementInfo={el} />;
    case 'latex':
      return <BaseLatexElement key={el.id} elementInfo={el} />;
    default:
      return null;
  }
}

export function SlideViewer({ slide }: SlideViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [visible, setVisible] = useState(false);
  const [prevSlideId, setPrevSlideId] = useState<string | null>(null);

  useEffect(() => {
    if (slide && slide.id !== prevSlideId) {
      setVisible(false);
      const id = setTimeout(() => setVisible(true), 50);
      setPrevSlideId(slide.id);
      return () => clearTimeout(id);
    } else if (slide) {
      setVisible(true);
    }
  }, [slide, prevSlideId]);

  useEffect(() => {
    if (!containerRef.current || !slide) return;
    const resize = () => {
      if (!containerRef.current) return;
      setScale((containerRef.current.clientWidth - 64) / slide.viewportSize);
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [slide]);

  if (!slide) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/80 shadow-sm ring-1 ring-slate-200/50">
            <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-400">输入主题并点击生成，开始创建幻灯片</p>
        </div>
      </div>
    );
  }

  const bg = slide.background;
  const bgStyle = bg?.type === 'solid' && bg.color
    ? { backgroundColor: bg.color }
    : { backgroundColor: slide.theme?.backgroundColor || '#ffffff' };

  return (
    <div ref={containerRef} className="flex h-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200/50 p-8">
      <div
        className="transition-all duration-500 ease-out"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          width: slide.viewportSize * scale,
          height: slide.viewportSize * slide.viewportRatio * scale,
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: `${4 * scale}px`,
            boxShadow: '0 4px 24px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
            ...bgStyle,
          }}
        >
          {slide.elements.map((el) => {
            const { left, top, width, height, rotate = 0 } = el as PPTElement & { height: number; rotate: number };
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
                {renderElement(el)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
