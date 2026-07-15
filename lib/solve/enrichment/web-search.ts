/**
 * Web search — multi-provider search with Tavily (primary) + Bing (fallback).
 *
 * Tavily is optimized for AI agents and is already configured in this project.
 * Bing Search API v7 is available as a fallback.
 */

import type { SearchResult, SubjectId, GradeLevel } from './types';
import {
  ALLOWED_DOMAINS,
  buildSearchQueries,
} from './config';
import { createLogger } from '@/lib/logger';

const log = createLogger('Enrichment:Search');

// ── Rate limiter ────────────────────────────────────────────────────

const lastRequestTime = new Map<string, number>();

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

async function rateLimit(domain: string, minIntervalMs: number = 1000): Promise<void> {
  const last = lastRequestTime.get(domain) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < minIntervalMs) {
    await new Promise((r) => setTimeout(r, minIntervalMs - elapsed));
  }
  lastRequestTime.set(domain, Date.now());
}

// ── Provider detection ──────────────────────────────────────────────

function getTavilyKey(): string {
  return process.env.TAVILY_API_KEY ?? '';
}

function isTavilyConfigured(): boolean {
  return getTavilyKey().length > 0;
}

function getBingKey(): string {
  return process.env.BING_API_KEY ?? process.env.BING_SEARCH_API_KEY ?? '';
}

function isBingConfigured(): boolean {
  return getBingKey().length > 0;
}

/**
 * Whether any search provider is available.
 */
export function isSearchConfigured(): boolean {
  return isTavilyConfigured() || isBingConfigured();
}

// ── Tavily Search ───────────────────────────────────────────────────

interface TavilyResult {
  url: string;
  title: string;
  content: string;
  raw_content?: string;
  score?: number;
}

interface TavilyResponse {
  results?: TavilyResult[];
  query?: string;
  response_time?: number;
}

const TAVILY_API_ENDPOINT = 'https://api.tavily.com/search';

async function searchTavily(
  query: string,
  maxResults: number = 10,
  searchDepth: 'basic' | 'advanced' = 'basic',
): Promise<SearchResult[]> {
  const apiKey = getTavilyKey();
  if (!apiKey) {
    log.warn('[Tavily] No TAVILY_API_KEY configured');
    return [];
  }

  await rateLimit('api.tavily.com', 500);

  try {
    const resp = await fetch(TAVILY_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: searchDepth,
        include_raw_content: false,
        include_answer: false,
        include_domains: [],
        exclude_domains: [],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!resp.ok) {
      const body = await resp.text();
      log.error(`[Tavily] HTTP ${resp.status}: ${body.slice(0, 200)}`);
      return [];
    }

    const data: TavilyResponse = await resp.json();
    const results: SearchResult[] = (data.results ?? []).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.content.slice(0, 300),
      domain: getDomain(r.url),
    }));

    log.info(`[Tavily] "${query}" → ${results.length} results`);
    return results;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[Tavily] Request failed: ${msg}`);
    return [];
  }
}

// ── Bing Search (fallback) ───────────────────────────────────────────

const BING_API_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';

interface BingWebResult {
  url: string;
  name: string;
  snippet: string;
  language?: string;
}

interface BingSearchResponse {
  webPages?: {
    value: BingWebResult[];
    totalEstimatedMatches?: number;
  };
  error?: { code: string; message: string };
}

async function searchBing(
  query: string,
  count: number = 10,
  market: string = 'zh-CN',
): Promise<SearchResult[]> {
  const apiKey = getBingKey();
  if (!apiKey) {
    return [];
  }

  await rateLimit('api.bing.microsoft.com', 500);

  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(count, 50)),
    mkt: market,
    textFormat: 'Raw',
    safeSearch: 'Strict',
  });

  try {
    const resp = await fetch(`${BING_API_ENDPOINT}?${params}`, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) return [];

    const data: BingSearchResponse = await resp.json();
    if (data.error) {
      log.error(`[Bing] API error: ${data.error.message}`);
      return [];
    }

    const results: SearchResult[] = (data.webPages?.value ?? []).map((r) => ({
      url: r.url,
      title: r.name,
      snippet: r.snippet,
      domain: getDomain(r.url),
    }));

    log.info(`[Bing] "${query}" → ${results.length} results`);
    return results;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error(`[Bing] Request failed: ${msg}`);
    return [];
  }
}

// ── Unified search ──────────────────────────────────────────────────

async function searchUnified(
  query: string,
  maxResults: number = 10,
): Promise<SearchResult[]> {
  // Try Tavily first (already configured)
  if (isTavilyConfigured()) {
    const results = await searchTavily(query, maxResults);
    if (results.length > 0) return results;
  }

  // Fall back to Bing
  if (isBingConfigured()) {
    return searchBing(query, maxResults);
  }

  log.warn('[Search] No search provider configured — add TAVILY_API_KEY or BING_API_KEY');
  return [];
}

// ── Public API ──────────────────────────────────────────────────────

export interface SearchForSubjectOptions {
  subject: SubjectId;
  gradeLevel: GradeLevel;
  maxResults?: number;
  /** Only return results from allowed domains */
  filterAllowedDomains?: boolean;
}

/**
 * Search for problems in a specific subject and grade level.
 *
 * Runs multiple queries (using keyword + grade combos) and merges
 * deduplicated results.
 *
 * Uses Tavily first (already configured), Bing as fallback.
 */
export async function searchForSubject(
  opts: SearchForSubjectOptions,
): Promise<SearchResult[]> {
  const { subject, gradeLevel, maxResults = 30, filterAllowedDomains = true } = opts;

  if (!isSearchConfigured()) {
    log.warn('[Search] No search API key configured — add TAVILY_API_KEY or BING_API_KEY to .env.local');
    return [];
  }

  const queries = buildSearchQueries(subject, gradeLevel, 3);
  const allResults: SearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    const results = await searchUnified(query, 10);
    for (const r of results) {
      if (seenUrls.has(r.url)) continue;
      seenUrls.add(r.url);
      allResults.push(r);
    }

    if (allResults.length >= maxResults) break;
  }

  // Filter by allowed domains
  let filtered = allResults;
  if (filterAllowedDomains) {
    filtered = allResults.filter((r) =>
      ALLOWED_DOMAINS.some((d) => r.domain === d || r.domain.endsWith('.' + d)),
    );
  }

  log.info(
    `[Search] ${subject}/${gradeLevel}: ${filtered.length} filtered results (${allResults.length} total)`,
  );

  return filtered.slice(0, maxResults);
}

// isTavilyConfigured / isBingConfigured / isSearchConfigured already exported inline above
