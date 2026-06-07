/**
 * Google Adapter — Proxy and Fetch Configuration
 *
 * Google Gemini API may require proxy routing in certain regions.
 * This adapter provides a reusable proxy-enabled fetch function.
 */

let proxyAgentCache: unknown;

/**
 * Create a fetch function that routes through a proxy.
 * Uses undici ProxyAgent for connection pooling.
 */
export async function createProxyFetch(proxyUrl: string): Promise<typeof fetch> {
  const { ProxyAgent, fetch: undiciFetch } = (await import(/* webpackIgnore: true */ 'undici')) as {
    ProxyAgent: new (proxyUrl: string) => unknown;
    fetch: (input: string | URL | Request, init?: Record<string, unknown>) => Promise<unknown>;
  };

  const agent = new ProxyAgent(proxyUrl);

  return ((input: RequestInfo | URL, init?: RequestInit) => {
    return undiciFetch(input, {
      ...(init as Record<string, unknown>),
      dispatcher: agent,
    }) as Promise<Response>;
  }) as typeof fetch;
}

/**
 * Reset the proxy agent cache (for hot-reload or testing).
 */
export function resetProxyCache(): void {
  proxyAgentCache = undefined;
}
