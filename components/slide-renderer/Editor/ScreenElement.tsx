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
        fontName: 'Microsoft YaHei',
      };
    },
  );

  if (!CurrentElementComponent) {
    return null;
  }

  const isAnimating = animate;

  const elevationShadow = useMemo(() => {
    switch (elementInfo.type) {
      case ElementTypes.TEXT:
        return '0 1px 3px rgba(0,0,0,0.08)';
      case ElementTypes.IMAGE:
      case ElementTypes.SHAPE:
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

  const gpuTransform = elementInfo.type === ElementTypes.VIDEO || elementInfo.type === ElementTypes.CHART
    ? 'translateZ(0)'
    : undefined;

  return (
    <div
      className={`screen-element absolute ${isAnimating ? 'animate-fade-in-up' : ''}`}
      id={`screen-element-${elementInfo.id}`}
      style={{
        zIndex: elementIndex,
        left: `${elementInfo.left}px`,
        top: `${elementInfo.top}px`,
        width: `${elementInfo.width}px`,
        height: `${'height' in elementInfo ? elementInfo.height : Math.abs((elementInfo as PPTLineElement).end[1] - (elementInfo as PPTLineElement).start[1]) || 24}px`,
        color: theme.fontColor,
        fontFamily: theme.fontName,
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
