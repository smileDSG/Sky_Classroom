/**
 * Global fetch interceptor that handles 401 responses
 * by showing a toast and redirecting to login.
 *
 * During an active token refresh it holds 401s and only redirects
 * if the refresh also fails.
 */

import { toast } from 'sonner';

let installed = false;
let refreshingPromise: Promise<boolean> | null = null;
let redirectTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Attempt a token refresh. Returns true if refresh succeeded.
 * Concurrent callers share the same promise to avoid duplicate requests.
 */
function tryRefresh(): Promise<boolean> {
  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshingPromise = null;
    }
  })();

  return refreshingPromise;
}

/**
 * Schedule a redirect after a short delay so concurrent 401s
 * can be coalesced and cancelled by a successful refresh.
 */
function scheduleRedirect() {
  if (redirectTimer) return; // already scheduled
  redirectTimer = setTimeout(() => {
    redirectTimer = null;
    toast.warning('请先登录后再操作');
    const currentPath = window.location.pathname;
    window.location.href = `/auth/login?redirect=${encodeURIComponent(currentPath)}&reason=login_required`;
  }, 500);
}

function cancelRedirect() {
  if (redirectTimer) {
    clearTimeout(redirectTimer);
    redirectTimer = null;
  }
}

export function installFetchInterceptor() {
  if (installed) return;
  if (typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const res = await originalFetch(...args);

    if (res.status === 401) {
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : args[0]?.url;
      const method = (
        typeof args[1] === 'object' && args[1] ? args[1].method : undefined
      )?.toUpperCase();
      const reqInit = typeof args[0] === 'object' && args[0] ? (args[0] as Request) : null;
      const resolvedMethod = method ?? (reqInit?.method?.toUpperCase() || 'GET');

      // Only handle 401 from our own API routes, not external or auth routes
      if (url?.startsWith('/api/') && !url.startsWith('/api/auth/')) {
        // Start a refresh attempt (shared across concurrent callers)
        const ok = await tryRefresh();
        if (ok) {
          cancelRedirect();
          // Only auto-retry idempotent requests — replaying a POST could
          // duplicate a mutation (e.g. double submit). Non-idempotent calls
          // fall through and surface the 401 to the caller instead.
          if (resolvedMethod === 'GET' || resolvedMethod === 'HEAD') {
            return originalFetch(...args);
          }
        } else {
          scheduleRedirect();
        }
      }
    }

    return res;
  };
}
