'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface MobileSkyFrameProps {
  src: string;
  fitContainer?: boolean;
}

export function applyMobileFrameScrollbarStyles(frameDocument: Document) {
  frameDocument.documentElement.classList.add('mobile-frame-scrollbar-hidden');
  frameDocument.body?.classList.add('mobile-frame-scrollbar-hidden');

  if (frameDocument.getElementById('mobile-frame-scrollbar-reset')) return;

  const style = frameDocument.createElement('style');
  style.id = 'mobile-frame-scrollbar-reset';
  style.textContent = `
    html,
    body {
      background: transparent !important;
      max-width: 100% !important;
      overflow-x: hidden !important;
      overflow-y: auto !important;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }

    * {
      max-width: 100%;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }

    html::-webkit-scrollbar,
    body::-webkit-scrollbar,
    *::-webkit-scrollbar {
      width: 0 !important;
      height: 0 !important;
      display: none !important;
    }

    .mobile-frame-scrollbar-hidden,
    .mobile-frame-scrollbar-hidden * {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    }

    [data-sky-responsive-mobile-shell] {
      min-height: auto !important;
      background: transparent !important;
    }

    [data-sky-responsive-top-bar],
    [data-sky-responsive-bottom-nav] {
      display: none !important;
    }

    [data-sky-responsive-mobile-main] {
      min-height: auto !important;
    }

    [data-sky-desktop-top-actions] {
      display: none !important;
    }
  `;
  frameDocument.head.appendChild(style);
}

export function toMobileHref(rawHref: string, origin: string): string | null {
  if (rawHref === '/') return '/m/sky';
  if (rawHref.startsWith('/auth/')) return `/m${rawHref}`;
  if (rawHref === '/sky') return '/m/sky';
  if (rawHref === '/sky/learning') return '/m/sky/study-lab';
  if (rawHref.startsWith('/sky/')) return `/m${rawHref}`;
  if (rawHref.startsWith('/generation-progress')) return `/m${rawHref}`;
  if (rawHref.startsWith('/classroom/')) return `/m${rawHref}`;

  try {
    const url = new URL(rawHref, origin);
    if (url.origin !== origin) return null;
    if (url.pathname === '/') return '/m/sky';
    if (url.pathname.startsWith('/auth/')) {
      return `/m${url.pathname}${url.search}${url.hash}`;
    }
    if (url.pathname === '/sky') return '/m/sky';
    if (url.pathname === '/sky/learning') {
      return `/m/sky/study-lab${url.search}${url.hash}`;
    }
    if (url.pathname.startsWith('/sky/')) {
      return `/m${url.pathname}${url.search}${url.hash}`;
    }
    if (url.pathname === '/generation-progress' || url.pathname.startsWith('/classroom/')) {
      return `/m${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return null;
  }

  return null;
}

export function MobileSkyFrame({ src, fitContainer = false }: MobileSkyFrameProps) {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [frameSrc, setFrameSrc] = useState(src);

  useEffect(() => {
    setFrameSrc(src);
  }, [src]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  const wireFrameNavigation = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    const frame = frameRef.current;
    const frameWindow = frame?.contentWindow;
    const frameDocument = frame?.contentDocument;
    if (!frame || !frameWindow || !frameDocument) return;

    applyMobileFrameScrollbarStyles(frameDocument);

    const parentOrigin = window.location.origin;
    const currentPath = frameWindow.location.pathname;
    if (
      currentPath === '/sky' ||
      currentPath.startsWith('/sky/') ||
      currentPath.startsWith('/auth/') ||
      currentPath === '/generation-progress' ||
      currentPath.startsWith('/classroom/')
    ) {
      const expectedParentHref =
        currentPath === '/sky/learning'
          ? `/m/sky/study-lab${frameWindow.location.search}${frameWindow.location.hash}`
          : `/m${currentPath}${frameWindow.location.search}${frameWindow.location.hash}`;
      if (
        window.location.pathname + window.location.search + window.location.hash !==
        expectedParentHref
      ) {
        router.replace(expectedParentHref);
      }
    }

    const handleClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;

      const href = link.getAttribute('href');
      if (!href) return;

      const mobileHref = toMobileHref(href, parentOrigin);
      if (!mobileHref) return;

      event.preventDefault();
      router.push(mobileHref);
    };

    frameDocument.addEventListener('click', handleClick);

    const originalPushState = frameWindow.history.pushState;
    const originalReplaceState = frameWindow.history.replaceState;

    frameWindow.history.pushState = function patchedPushState(data, unused, url) {
      if (typeof url === 'string' || url instanceof URL) {
        const mobileHref = toMobileHref(url.toString(), parentOrigin);
        if (mobileHref) {
          router.push(mobileHref);
          return originalPushState.call(this, data, unused, frameWindow.location.href);
        }
      }
      return originalPushState.call(this, data, unused, url);
    };

    frameWindow.history.replaceState = function patchedReplaceState(data, unused, url) {
      if (typeof url === 'string' || url instanceof URL) {
        const mobileHref = toMobileHref(url.toString(), parentOrigin);
        if (mobileHref) {
          router.replace(mobileHref);
          return originalReplaceState.call(this, data, unused, frameWindow.location.href);
        }
      }
      return originalReplaceState.call(this, data, unused, url);
    };

    cleanupRef.current = () => {
      frameDocument.removeEventListener('click', handleClick);
      frameWindow.history.pushState = originalPushState;
      frameWindow.history.replaceState = originalReplaceState;
    };
  }, [router]);

  return (
    <iframe
      ref={frameRef}
      src={frameSrc}
      onLoad={wireFrameNavigation}
      className={cn(
        'scrollbar-hide block w-full border-0 bg-[#07111f]',
        fitContainer ? 'h-full' : 'h-dvh',
      )}
      title="Mobile page"
    />
  );
}
