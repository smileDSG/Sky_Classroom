'use client';

import { SceneRenderer } from '@/components/stage/scene-renderer';
import type { Scene } from '@/lib/types/stage';

interface MobileSlideViewportProps {
  scene: Scene | null;
  onTap?: () => void;
  fillScreen?: boolean;
}

export function MobileSlideViewport({ scene, onTap, fillScreen }: MobileSlideViewportProps) {
  if (!scene) {
    return (
      <div
        className={`flex w-full items-center justify-center rounded-2xl border border-white/10 bg-[#0d1728] ${
          fillScreen ? 'h-full' : 'aspect-[16/9]'
        }`}
      >
        <p className="text-sm text-slate-500">暂无场景</p>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#020817] ${
        fillScreen
          ? 'h-full rounded-none border-0 shadow-none'
          : 'rounded-2xl border border-white/10 shadow-2xl'
      }`}
      onClick={onTap}
      role="button"
      tabIndex={0}
      aria-label="点击播放或暂停"
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onTap?.();
        }
      }}
    >
      <div className={`w-full ${fillScreen ? 'h-full' : 'aspect-[16/9]'}`}>
        <SceneRenderer scene={scene} mode="playback" />
      </div>
    </div>
  );
}
