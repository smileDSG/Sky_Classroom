/**
 * Fetch wrapper that injects the X-Locale header from localStorage.
 * Use this for all API calls that need locale-aware responses.
 */

export function fetchWithLocale(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const locale =
    typeof window !== 'undefined'
      ? localStorage.getItem('locale') || 'zh-CN'
      : 'zh-CN';

  const headers = new Headers(init?.headers);
  if (!headers.has('X-Locale')) {
    headers.set('X-Locale', locale);
  }

  return fetch(input, { ...init, headers });
}
