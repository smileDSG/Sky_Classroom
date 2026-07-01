/**
 * Browser capability helpers used by mobile UI.
 */

export interface MobileCapabilities {
  touch: boolean;
  standalone: boolean;
  visualViewport: boolean;
  share: boolean;
}

export function getMobileCapabilities(): MobileCapabilities {
  if (typeof window === 'undefined') {
    return {
      touch: false,
      standalone: false,
      visualViewport: false,
      share: false,
    };
  }

  return {
    touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    visualViewport: 'visualViewport' in window && window.visualViewport != null,
    share: 'share' in navigator,
  };
}
