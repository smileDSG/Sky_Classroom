/**
 * Direct site scraper — no search API needed.
 * Searches Chinese educational sites directly, fetches pages, extracts questions.
 *
 * Sites tested and accessible:
 *   - jyeoo.com (菁优网) — public question bank
 *   - zujuan.xkw.com (组卷网) — exam question bank
 */

import type { ExtractedQuestion, SubjectId, GradeLevel } from './types';
import { fetchPage } from './page-fetcher';
import { extractQuestionsFromText } from './question-extractor';
import { createLogger } from '@/lib/logger';
import { SUBJECT_MAP, GRADE_MAP, ALLOWED_DOMAINS } from './config';

const log = createLogger('Enrichment:Scraper');

// ── Site-specific search URL builders ───────────────────────────────

interface SiteConfig {
  name: string;
  domain: string;
  /** Build a search URL for a given query */
  buildSearchUrl: (query: string) => string;
  /** Max results per search */
  maxResults: number;
}

const SITES: SiteConfig[] = [
  {
    name: '菁优网',
    domain: 'jyeoo.com',
    buildSearchUrl: (query: string) =>
      `https://www.jyeoo.com/search?q=${encodeURIComponent(query)}`,
    maxResults: 20,
  },
  {
    name: '组卷网',
    domain: 'zujuan.xkw.com',
    buildSearchUrl: (query: string) =>
      `https://zujuan.xkw.com/search?q=${encodeURIComponent(query)}`,
    maxResults: 20,
  },
];

// ── Search query templates per subject ──────────────────────────────

function buildSearchQuery(subject: SubjectId, gradeLevel: GradeLevel): string[] {
  const sub = SUBJECT_MAP[subject];
  const grade = GRADE_MAP[gradeLevel];
  if (!sub || !grade) return [];

  const suffix = grade.searchSuffix;
  return sub.searchKeywords.slice(0, 3).map((kw) => {
    if (suffix && !kw.includes(suffix)) return `${kw} ${suffix}`;
    return kw;
  });
}

// ── Parse search result links from HTML ─────────────────────────────

function extractLinks(html: string, domain: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  // Find all href attributes
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1];
    // Resolve relative URLs
    if (href.startsWith('/')) {
      href = `https://${domain}${href}`;
    }
    // Only include same-domain, non-search URLs
    if (href.includes(domain) && !href.includes('/search') && !seen.has(href)) {
      seen.add(href);
      links.push(href);
    }
  }

  return links.slice(0, 10); // limit per page
}

// ── Main scraper ────────────────────────────────────────────────────

export interface ScrapeOptions {
  subject: SubjectId;
  gradeLevel: GradeLevel;
  /** Max questions to scrape */
  maxQuestions?: number;
}

/**
 * Directly scrape educational sites for questions.
 *
 * Flow: build search queries → fetch search pages → extract result links
 * → fetch question pages → LLM extract questions → return
 */
export async function scrapeQuestions(opts: ScrapeOptions): Promise<ExtractedQuestion[]> {
  const { subject, gradeLevel, maxQuestions = 50 } = opts;

  const queries = buildSearchQuery(subject, gradeLevel);
  if (queries.length === 0) {
    log.warn(`[Scraper] No search queries for ${subject}/${gradeLevel}`);
    return [];
  }

  const allQuestions: ExtractedQuestion[] = [];

  for (const query of queries) {
    if (allQuestions.length >= maxQuestions) break;

    for (const site of SITES) {
      if (allQuestions.length >= maxQuestions) break;

      const searchUrl = site.buildSearchUrl(query);
      log.info(`[Scraper] Searching ${site.name}: ${query}`);

      try {
        // Fetch search results page
        const searchPage = await fetchPage({ url: searchUrl, skipRobotsCheck: false });
        if (!searchPage || !searchPage.robotsAllowed) {
          log.info(`[Scraper] ${site.name}: blocked or empty`);
          continue;
        }

        // Extract question page links
        const links = extractLinks(searchPage.textContent, site.domain);
        log.info(`[Scraper] ${site.name}: found ${links.length} links`);

        // Fetch question pages and extract
        for (const link of links) {
          if (allQuestions.length >= maxQuestions) break;

          const questionPage = await fetchPage({ url: link, skipRobotsCheck: true });
          if (!questionPage) continue;

          const questions = await extractQuestionsFromText({
            textContent: questionPage.textContent,
            expectedSubject: subject,
            expectedGrade: gradeLevel,
            maxQuestions: 3,
          });

          if (questions.length > 0) {
            for (const q of questions) {
              q.sourceUrl = link;
            }
            allQuestions.push(...questions);
            log.info(`[Scraper] Extracted ${questions.length} from ${link.slice(0, 60)}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn(`[Scraper] ${site.name} error: ${msg}`);
      }
    }
  }

  log.info(
    `[Scraper] Total scraped: ${allQuestions.length} questions for ${subject}/${gradeLevel}`,
  );
  return allQuestions.slice(0, maxQuestions);
}
