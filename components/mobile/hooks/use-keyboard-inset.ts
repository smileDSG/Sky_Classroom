'use client';

import { useEffect, useState } from 'react';

export function useKeyboardInset() {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const update = () => {
      const inset = Math.max(0, window.innerHeight - visualViewport.height - visualViewport.offsetTop);
      setKeyboardInset(Math.round(inset));
    };

    update();
    visualViewport.addEventListener('resize', update);
    visualViewport.addEventListener('scroll', update);
    return () => {
      visualViewport.removeEventListener('resize', update);
      visualViewport.removeEventListener('scroll', update);
    };
  }, []);

  return keyboardInset;
}
