'use client';

import { ElementTypes, type PPTElement, type PPTLineElement } from '@/lib/types/slides';
import { useMemo } from 'react';

import { BaseImageElement } from '../components/element/ImageElement/BaseImageElement';
import { BaseTextElement } from '../components/element/TextElement/BaseTextElement';
import { BaseShapeElement } from '../components/element/ShapeElement/BaseShapeElement';
import { BaseLineElement } from '../components/element/LineElement/BaseLineElement';
import { BaseChartElement } from '../components/element/ChartElement/BaseChartElement';
import { BaseLatexElement } from '../components/element/LatexElement/BaseLatexElement';
import { BaseTableElement } from '../components/element/TableElement/BaseTableElement';
import { BaseVideoElement } from '../components/element/VideoElement/BaseVideoElement';
import { BaseCodeElement } from '../components/element/CodeElement/BaseCodeElement';
import { useSceneSelector } from '@/lib/contexts/scene-context';
import type { SceneContent } from '@/lib/types/stage';

interface ScreenElementProps {
  readonly elementInfo: PPTElement;
  readonly elementIndex: number;
  readonly animate?: boolean;
}

const SLIDE_FONT_STACK =
  'Noto Sans SC, Microsoft YaHei, PingFang SC, Source Han Sans SC, Arial, sans-serif';

function hasShapeText(elementInfo: PPTElement): boolean {
  if (elementInfo.type !== ElementTypes.SHAPE) return false;
  const text = (elementInfo as { text?: { content?: string } }).text;
  return !!text?.content?.replace(/<[^>]+>/g, '').trim();
}

function getElementLayer(elementInfo: PPTElement, elementIndex: number): number {
  const order = elementIndex;
  switch (elementInfo.type) {
    case ElementTypes.LINE:
      return 1000 + order;
    case ElementTypes.SHAPE:
      return (hasShapeText(elementInfo) ? 7200 : 2000) + order;
    case ElementTypes.IMAGE:
    case ElementTypes.VIDEO:
    case ElementTypes.CHART:
      return 4000 + order;
    case ElementTypes.TABLE:
      return 6200 + order;
    case ElementTypes.TEXT:
    case ElementTypes.LATEX:
    case ElementTypes.CODE:
      return 8000 + order;
    default:
      return 5000 + order;
  }
}

export function ScreenElement({ elementInfo, elementIndex, animate }: ScreenElementProps) {
  const CurrentElementComponent = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- element components have varying prop signatures
    const elementTypeMap: Record<string, any> = {
      [ElementTypes.IMAGE]: BaseImageElement,
      [ElementTypes.TEXT]: BaseTextElement,
      [ElementTypes.SHAPE]: BaseShapeElement,
      [ElementTypes.LINE]: BaseLineElement,
      [ElementTypes.CHART]: BaseChartElement,
      [ElementTypes.LATEX]: BaseLatexElement,
      [ElementTypes.TABLE]: BaseTableElement,
      [ElementTypes.VIDEO]: BaseVideoElement,
      [ElementTypes.CODE]: BaseCodeElement,
      // TODO: Add other element types
      // [ElementTypes.AUDIO]: BaseAudioElement,
    };
    return elementTypeMap[elementInfo.type] || null;
  }, [elementInfo.type]);

  const theme = useSceneSelector<SceneContent, { fontColor: string; fontName: string }>(
    (content) => {
      if (content.type === 'slide') {
        return content.canvas.theme;
      }
      return {
        fontColor: '#333333',
        fontName: SLIDE_FONT_STACK,
      };
    },
  );

  const isAnimating = animate;

  const elevationShadow = useMemo(() => {
    switch (elementInfo.type) {
      case ElementTypes.IMAGE:
      case ElementTypes.CHART:
      case ElementTypes.TABLE:
        return '0 4px 12px rgba(0,0,0,0.12)';
      case ElementTypes.VIDEO:
        return '0 8px 24px rgba(0,0,0,0.16)';
      case ElementTypes.LINE:
        return undefined;
      default:
        return undefined;
    }
  }, [elementInfo.type]);

  const gpuTransform =
    elementInfo.type === ElementTypes.VIDEO || elementInfo.type === ElementTypes.CHART
      ? 'translateZ(0)'
      : undefined;

  if (!CurrentElementComponent) {
    return null;
  }

  return (
    <div
      className={`screen-element absolute ${isAnimating ? 'animate-fade-in-up' : ''}`}
      id={`screen-element-${elementInfo.id}`}
      style={{
        zIndex: getElementLayer(elementInfo, elementIndex),
        left: `${elementInfo.left}px`,
        top: `${elementInfo.top}px`,
        width: `${elementInfo.width}px`,
        height: `${'height' in elementInfo ? elementInfo.height : Math.abs((elementInfo as PPTLineElement).end[1] - (elementInfo as PPTLineElement).start[1]) || 24}px`,
        color: theme.fontColor,
        fontFamily:
          theme.fontName === 'SimSun' ? SLIDE_FONT_STACK : theme.fontName || SLIDE_FONT_STACK,
        animationDelay: isAnimating ? `${elementIndex * 80}ms` : undefined,
        boxShadow: elevationShadow,
        willChange: isAnimating ? 'transform' : undefined,
        transform: gpuTransform,
      }}
    >
      <CurrentElementComponent elementInfo={elementInfo} animate={animate} />
    </div>
  );
}
