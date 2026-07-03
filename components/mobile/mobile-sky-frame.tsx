'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface MobileSkyFrameProps {
  src: string;
}

function toMobileHref(rawHref: string, origin: string): string | null {
  if (rawHref === '/') return '/m/sky';
  if (rawHref === '/sky') return '/m/sky';
  if (rawHref.startsWith('/sky/')) return `/m${rawHref}`;
  if (rawHref.startsWith('/generation-progress')) return `/m${rawHref}`;
  if (rawHref.startsWith('/classroom/')) return `/m${rawHref}`;

  try {
    const url = new URL(rawHref, origin);
    if (url.origin !== origin) return null;
    if (url.pathname === '/') return '/m/sky';
    if (url.pathname === '/sky') return '/m/sky';
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

export function MobileSkyFrame({ src }: MobileSkyFrameProps) {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameSrc, setFrameSrc] = useState(src);

  useEffect(() => {
    setFrameSrc(src);
  }, [src]);

  const wireFrameNavigation = useCallback(() => {
    const frame = frameRef.current;
    const frameWindow = frame?.contentWindow;
    const frameDocument = frame?.contentDocument;
    if (!frame || !frameWindow || !frameDocument) return;

    const parentOrigin = window.location.origin;
    const currentPath = frameWindow.location.pathname;
    if (
      currentPath === '/sky' ||
      currentPath.startsWith('/sky/') ||
      currentPath === '/generation-progress' ||
      currentPath.startsWith('/classroom/')
    ) {
      const expectedParentHref = `/m${currentPath}${frameWindow.location.search}${frameWindow.location.hash}`;
      if (window.location.pathname + window.location.search + window.location.hash !== expectedParentHref) {
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

    return () => {
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
      className="block h-[100dvh] w-full border-0 bg-[#07111f]"
      title="Mobile page"
    />
  );
}
