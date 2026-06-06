/**
 * Page fetcher — robots.txt check + rate-limited HTTP fetch + HTML-to-text extraction.
 *
 * Compliance:
 * - Checks robots.txt before fetching (caches results per domain)
 * - Respects 5s minimum interval between same-domain requests
 * - Sends identifiable User-Agent header
 * - Times out after 15s per page
 */

import type { FetchedPage } from './types';
import { DOMAIN_RATE_LIMIT_MS, MAX_PAGES_PER_RUN, ALLOWED_DOMAINS } from './config';
import { createLogger } from '@/lib/logger';

const log = createLogger('Enrichment:Fetcher');

// ── robots.txt cache ─────────────────────────────────────────────────

interface RobotsCacheEntry {
  allowed: boolean;
  checkedAt: number;
  disallowedPaths: string[];
}

const robotsCache = new Map<string, RobotsCacheEntry>();
const ROBOTS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Check robots.txt for a domain.
 *
 * Returns true if the path is allowed, false if disallowed.
 * Caches the parsed robots.txt for 30 minutes.
 */
async function checkRobots(domain: string, path: string): Promise<boolean> {
  const cached = robotsCache.get(domain);
  if (cached && Date.now() - cached.checkedAt < ROBOTS_CACHE_TTL_MS) {
    if (!cached.allowed) return false;
    // Check if path is disallowed
    for (const disallowed of cached.disallowedPaths) {
      if (path.startsWith(disallowed)) return false;
    }
    return true;
  }

  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const resp = await fetch(robotsUrl, {
      signal: AbortSignal.timeout(5_000),
      headers: {
        'User-Agent': 'SkyClassroom-EnrichBot/1.0 (educational research; contact@skyclassroom.app)',
      },
    });

    if (resp.status === 404 || resp.status >= 500) {
      // No robots.txt or server error — assume allowed
      robotsCache.set(domain, { allowed: true, checkedAt: Date.now(), disallowedPaths: [] });
      return true;
    }

    if (!resp.ok) {
      // Disallowed
      robotsCache.set(domain, { allowed: false, checkedAt: Date.now(), disallowedPaths: ['/'] });
      return false;
    }

    const text = await resp.text();
    const disallowedPaths: string[] = [];
    let relevantUserAgent = false;
    let globalRules = false;

    for (const line of text.split('\n')) {
      const trimmed = line.trim();

      // Check if this rule block is for our bot or all bots
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        const agent = trimmed.slice('user-agent:'.length).trim().toLowerCase();
        relevantUserAgent = agent === '*' || agent === 'skyclassroom-enrichbot';
        globalRules = agent === '*';
        continue;
      }

      if (relevantUserAgent || globalRules) {
        if (trimmed.toLowerCase().startsWith('disallow:')) {
          const disallow = trimmed.slice('disallow:'.length).trim();
          if (disallow) {
            disallowedPaths.push(disallow);
          }
        }
      }
    }

    // Verify that our specific path is allowed
    let allowed = true;
    for (const disallowed of disallowedPaths) {
      if (disallowed === '/' || path.startsWith(disallowed)) {
        allowed = false;
        break;
      }
    }

    robotsCache.set(domain, {
      allowed,
      checkedAt: Date.now(),
      disallowedPaths,
    });

    return allowed;
  } catch {
    // Network error checking robots.txt — assume allowed
    robotsCache.set(domain, { allowed: true, checkedAt: Date.now(), disallowedPaths: [] });
    return true;
  }
}

// ── Rate limiter ─────────────────────────────────────────────────────

const lastFetchTime = new Map<string, number>();

async function rateLimitFetch(domain: string): Promise<void> {
  const last = lastFetchTime.get(domain) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < DOMAIN_RATE_LIMIT_MS) {
    const waitMs = DOMAIN_RATE_LIMIT_MS - elapsed;
    log.info(`[Fetcher] Rate limiting ${domain}: waiting ${waitMs}ms`);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  lastFetchTime.set(domain, Date.now());
}

// ── HTML to text extraction ──────────────────────────────────────────

/**
 * Simple HTML-to-text extraction.
 *
 * Strips tags, decodes entities, collapses whitespace.
 * Does NOT run a full browser — this is a lightweight server-side extraction.
 */
function extractTextFromHtml(html: string): string {
  // Remove script/style/noscript/iframe/svg
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, ' ')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, ' ')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, ' ');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x?[0-9a-fA-F]+;/g, ' ');

  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

// ── Public API ──────────────────────────────────────────────────────

export interface FetchPageOptions {
  url: string;
  /** Skip robots.txt check (for trusted domains) */
  skipRobotsCheck?: boolean;
}

/**
 * Fetch and extract text content from a URL.
 *
 * 1. Checks robots.txt (unless skipRobotsCheck is true)
 * 2. Rate-limits by domain (5s interval)
 * 3. Fetches the page
 * 4. Extracts text content from HTML
 *
 * Returns null if the page cannot be fetched or is blocked.
 */
export async function fetchPage(opts: FetchPageOptions): Promise<FetchedPage | null> {
  const { url, skipRobotsCheck = false } = opts;

  let domain: string;
  let path: string;
  try {
    const parsed = new URL(url);
    domain = parsed.hostname;
    path = parsed.pathname + parsed.search;
  } catch {
    log.warn(`[Fetcher] Invalid URL: ${url}`);
    return null;
  }

  // Check domain against allowed list
  const isAllowed = ALLOWED_DOMAINS.some(
    (d) => domain === d || domain.endsWith('.' + d),
  );
  if (!isAllowed) {
    log.info(`[Fetcher] Domain not in allowlist: ${domain}`);
    return null;
  }

  // Check robots.txt
  if (!skipRobotsCheck) {
    const robotsOk = await checkRobots(domain, path);
    if (!robotsOk) {
      log.info(`[Fetcher] Blocked by robots.txt: ${domain}${path}`);
      return { url, domain, title: '', textContent: '', fetchedAt: Date.now(), robotsAllowed: false };
    }
  }

  // Rate limit
  await rateLimitFetch(domain);

  // Fetch
  try {
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        'User-Agent': 'SkyClassroom-EnrichBot/1.0 (educational research; contact@skyclassroom.app)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });

    if (!resp.ok) {
      log.warn(`[Fetcher] HTTP ${resp.status} for ${url}`);
      return null;
    }

    const contentType = resp.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      log.info(`[Fetcher] Non-HTML content: ${contentType} for ${url}`);
      return null;
    }

    const html = await resp.text();
    const textContent = extractTextFromHtml(html);

    // Extract rough title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? '';

    // Skip pages with very little content
    if (textContent.length < 200) {
      log.info(`[Fetcher] Skipping low-content page: ${url} (${textContent.length} chars)`);
      return null;
    }

    log.info(`[Fetcher] Fetched ${url}: ${textContent.length} chars`);

    return {
      url,
      domain,
      title,
      textContent: textContent.slice(0, 50_000), // cap at 50K chars
      fetchedAt: Date.now(),
      robotsAllowed: true,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`[Fetcher] Fetch failed for ${url}: ${msg}`);
    return null;
  }
}

export interface FetchPagesOptions {
  urls: string[];
  skipRobotsCheck?: boolean;
  maxPages?: number;
}

/**
 * Fetch multiple pages sequentially with rate limiting.
 *
 * @returns Array of successfully fetched pages (null entries filtered out)
 */
export async function fetchPages(opts: FetchPagesOptions): Promise<FetchedPage[]> {
  const { urls, skipRobotsCheck = false, maxPages = MAX_PAGES_PER_RUN } = opts;

  const pages: FetchedPage[] = [];
  const targetUrls = urls.slice(0, maxPages);

  log.info(`[Fetcher] Fetching ${targetUrls.length} pages...`);

  for (const url of targetUrls) {
    const page = await fetchPage({ url, skipRobotsCheck });
    if (page && page.robotsAllowed && page.textContent.length > 0) {
      pages.push(page);
    }
  }

  log.info(`[Fetcher] Successfully fetched ${pages.length}/${targetUrls.length} pages`);
  return pages;
}
