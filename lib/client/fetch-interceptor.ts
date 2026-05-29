/**
 * Global fetch interceptor that handles 401 responses
 * by showing a toast and redirecting to login.
 */

import { toast } from 'sonner';

let installed = false;

export function installFetchInterceptor() {
  if (installed) return;
  if (typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await originalFetch(...args);

    if (res.status === 401) {
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : args[0].url;
      // Only handle 401 from our own API routes, not external requests
      if (url.startsWith('/api/') && !url.startsWith('/api/auth/')) {
        toast.warning('请先登录后再操作');
        // Redirect to login with current path as redirect target
        const currentPath = window.location.pathname;
        window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}&reason=login_required`;
      }
    }

    return res;
  };
}
