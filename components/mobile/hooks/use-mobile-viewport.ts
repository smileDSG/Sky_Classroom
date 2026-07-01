'use client';

import { useEffect, useState } from 'react';

export interface MobileViewportState {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
}

function readViewport(): MobileViewportState {
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    width,
    height,
    orientation: width > height ? 'landscape' : 'portrait',
  };
}

export function useMobileViewport(): MobileViewportState {
  const [viewport, setViewport] = useState<MobileViewportState>({
    width: 0,
    height: 0,
    orientation: 'portrait',
  });

  useEffect(() => {
    const update = () => setViewport(readViewport());
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return viewport;
}
