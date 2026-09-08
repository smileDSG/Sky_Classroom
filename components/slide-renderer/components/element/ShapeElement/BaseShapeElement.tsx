'use client';

import type { PPTShapeElement, ShapeText } from '@/lib/types/slides';
import { useElementOutline } from '../hooks/useElementOutline';
import { useElementShadow } from '../hooks/useElementShadow';
import { useElementFlip } from '../hooks/useElementFlip';
import { useElementFill } from '../hooks/useElementFill';
import { GradientDefs } from './GradientDefs';
import { PatternDefs } from './PatternDefs';

export interface BaseShapeElementProps {
  elementInfo: PPTShapeElement;
}

const SLIDE_FONT_STACK =
  'Noto Sans SC, Microsoft YaHei, PingFang SC, Source Han Sans SC, Arial, sans-serif';

/**
 * Base shape element for read-only/playback mode
 */
export function BaseShapeElement({ elementInfo }: BaseShapeElementProps) {
  const { fill } = useElementFill(elementInfo, 'base');
  const { outlineWidth, outlineColor, strokeDashArray } = useElementOutline(elementInfo.outline);
  const { shadowStyle } = useElementShadow(elementInfo.shadow);
  const { flipStyle } = useElementFlip(elementInfo.flipH, elementInfo.flipV);

  const text: ShapeText = elementInfo.text || {
    content: '',
    align: 'middle',
    defaultFontName: SLIDE_FONT_STACK,
    defaultColor: '#333333',
  };
  const fontFamily = text.defaultFontName?.trim() || SLIDE_FONT_STACK;

  return (
    <div className="base-element-shape relative w-full h-full">
      <div
        className="rotate-wrapper w-full h-full"
        style={{ transform: `rotate(${elementInfo.rotate}deg)` }}
      >
        <div
          className="element-content relative w-full h-full overflow-hidden"
          style={{
            borderRadius: '8px',
            opacity: elementInfo.opacity,
            filter: shadowStyle ? `drop-shadow(${shadowStyle})` : '',
            transform: flipStyle,
            color: text.defaultColor,
            fontFamily,
          }}
        >
          <svg
            overflow="visible"
            width={elementInfo.width}
            height={elementInfo.height}
            className="transform-origin-[0_0] overflow-visible block"
          >
            <defs>
              {elementInfo.pattern && (
                <PatternDefs id={`base-pattern-${elementInfo.id}`} src={elementInfo.pattern} />
              )}
              {elementInfo.gradient && (
                <GradientDefs
                  id={`base-gradient-${elementInfo.id}`}
                  type={elementInfo.gradient.type}
                  colors={elementInfo.gradient.colors}
                  rotate={elementInfo.gradient.rotate}
                />
              )}
            </defs>
            <g
              transform={`scale(${elementInfo.width / (typeof elementInfo.viewBox === 'string' ? elementInfo.viewBox.split(' ').map(Number)[2] || 1 : Array.isArray(elementInfo.viewBox) ? elementInfo.viewBox[0] : 1)}, ${
                elementInfo.height /
                (typeof elementInfo.viewBox === 'string'
                  ? elementInfo.viewBox.split(' ').map(Number)[3] || 1
                  : Array.isArray(elementInfo.viewBox)
                    ? elementInfo.viewBox[1]
                    : 1)
              }) translate(0,0) matrix(1,0,0,1,0,0)`}
            >
              <path
                vectorEffect="non-scaling-stroke"
                strokeLinecap="butt"
                strokeMiterlimit="8"
                d={elementInfo.path}
                fill={fill}
                stroke={outlineColor}
                strokeWidth={outlineWidth}
                strokeDasharray={strokeDashArray}
              />
            </g>
          </svg>

          <div
            className={`shape-text flex flex-col px-2.5 py-2.5 leading-relaxed break-words absolute inset-0 ${
              text.align === 'top'
                ? 'justify-start'
                : text.align === 'bottom'
                  ? 'justify-end'
                  : 'justify-center'
            }`}
            style={{
              lineHeight: text.lineHeight,
              letterSpacing: `${text.wordSpace || 0}px`,
            }}
          >
            <div
              className="ProseMirror-static [&_p]:mb-[var(--paragraphSpace)]"
              style={{
                // @ts-expect-error CSS custom properties
                '--paragraphSpace': `${text.paragraphSpace === undefined ? 5 : text.paragraphSpace}px`,
              }}
              dangerouslySetInnerHTML={{ __html: text.content }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
