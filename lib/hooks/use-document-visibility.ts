'use client';

import { useEffect, useState } from 'react';

/**
 * True when the document is currently visible (tab active, window not
 * minimized/covered). Returns true when not running in a browser so that
 * server-side rendering is unaffected.
 */
export function isDocumentVisible(): boolean {
  return typeof document === 'undefined' || !document.hidden;
}

/** Live subscription for A-visible flag; re-renders on visibility changes. */
export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(isDocumentVisible);

  useEffect(() => {
    const update = () => setVisible(isDocumentVisible());
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return visible;
}
