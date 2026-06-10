'use client';

import type { PPTTableElement } from '@/lib/types/slides';
import { StaticTable } from './StaticTable';

export interface BaseTableElementProps {
  elementInfo: PPTTableElement;
  target?: string;
}

/**
 * Base table element for read-only / playback / thumbnail mode
 */
export function BaseTableElement({ elementInfo, target }: BaseTableElementProps) {
  return (
    <div
      className={`base-element-table w-full h-full ${target === 'thumbnail' ? 'pointer-events-none' : ''}`}
      style={{
        width: `${elementInfo.width}px`,
        height: `${elementInfo.height}px`,
      }}
    >
      <div
        className="rotate-wrapper w-full h-full"
        style={{ transform: `rotate(${elementInfo.rotate}deg)` }}
      >
        <div className="element-content w-full h-full overflow-hidden" style={{ borderRadius: '8px' }}>
          <StaticTable elementInfo={elementInfo} />
        </div>
      </div>
    </div>
  );
}
