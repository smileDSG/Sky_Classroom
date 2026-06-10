'use client';

import type { PPTChartElement } from '@/lib/types/slides';
import { ElementOutline } from '../ElementOutline';
import { Chart } from './Chart';

export interface BaseChartElementProps {
  elementInfo: PPTChartElement;
  target?: string;
}

/**
 * Base chart element for read-only/playback mode
 */
export function BaseChartElement({ elementInfo, target }: BaseChartElementProps) {
  return (
    <div
      className={`base-element-chart w-full h-full ${target === 'thumbnail' ? 'pointer-events-none' : ''}`}
      style={{
        width: `${elementInfo.width}px`,
        height: `${elementInfo.height}px`,
      }}
    >
      <div
        className="rotate-wrapper w-full h-full"
        style={{ transform: `rotate(${elementInfo.rotate}deg)` }}
      >
        <div
          className="element-content w-full h-full overflow-hidden"
          style={{
            backgroundColor: elementInfo.fill,
            borderRadius: '8px',
          }}
        >
          <ElementOutline
            width={elementInfo.width}
            height={elementInfo.height}
            outline={elementInfo.outline}
          />
          <Chart
            width={elementInfo.width}
            height={elementInfo.height}
            type={elementInfo.chartType}
            data={elementInfo.data}
            themeColors={elementInfo.themeColors}
            textColor={elementInfo.textColor}
            lineColor={elementInfo.lineColor}
            options={elementInfo.options}
          />
        </div>
      </div>
    </div>
  );
}
