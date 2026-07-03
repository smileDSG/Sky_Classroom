'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

function toMobileHref(href: string): string | null {
  if (href === '/') return '/m/sky';
  if (href === '/sky') return '/m/sky';
  if (href.startsWith('/sky/')) return `/m${href}`;
  if (href.startsWith('/generation-progress')) return `/m${href}`;
  if (href.startsWith('/classroom/')) return `/m${href}`;
  if (typeof window !== 'undefined' && href === window.location.origin) {
    return `${window.location.origin}/m/sky`;
  }
  if (typeof window !== 'undefined' && href === `${window.location.origin}/`) {
    return `${window.location.origin}/m/sky`;
  }
  if (typeof window !== 'undefined' && href.startsWith(`${window.location.origin}/sky/`)) {
    const url = new URL(href);
    return `${url.origin}/m${url.pathname}${url.search}`;
  }
  if (
    typeof window !== 'undefined' &&
    (href.startsWith(`${window.location.origin}/generation-progress`) ||
      href.startsWith(`${window.location.origin}/classroom/`))
  ) {
    const url = new URL(href);
    return `${url.origin}/m${url.pathname}${url.search}`;
  }
  if (typeof window !== 'undefined' && href === `${window.location.origin}/sky`) {
    return `${window.location.origin}/m/sky`;
  }
  return null;
}

export function MobileRouteGuard() {
  const router = useRouter();

  useEffect(() => {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function patchedPushState(data, unused, url) {
      if (typeof url === 'string') {
        const mobileHref = toMobileHref(url);
        return originalPushState.call(this, data, unused, mobileHref ?? url);
      }
      if (url instanceof URL) {
        const mobileHref = toMobileHref(url.toString());
        return originalPushState.call(this, data, unused, mobileHref ?? url);
      }
      return originalPushState.call(this, data, unused, url);
    };

    window.history.replaceState = function patchedReplaceState(data, unused, url) {
      if (typeof url === 'string') {
        const mobileHref = toMobileHref(url);
        return originalReplaceState.call(this, data, unused, mobileHref ?? url);
      }
      if (url instanceof URL) {
        const mobileHref = toMobileHref(url.toString());
        return originalReplaceState.call(this, data, unused, mobileHref ?? url);
      }
      return originalReplaceState.call(this, data, unused, url);
    };

    const handleClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;

      const href = link.getAttribute('href');
      if (!href) return;

      const mobileHref = toMobileHref(href);
      if (!mobileHref) return;

      event.preventDefault();
      router.push(mobileHref);
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [router]);

  return null;
}
