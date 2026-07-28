import { createHash } from 'node:crypto';

import { load } from 'js-yaml';
import { z } from 'zod';

import type { MathResourceLanguage } from '@/lib/adaptive-learning/contracts/resource';
import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';

const MINIMUM_BODY_LENGTH = 50;

const frontMatterSchema = z
  .object({
    title: z.string().trim().min(1),
    source: z.string().url(),
    originalUrl: z.string().url(),
    course: z.literal('math'),
    tags: z.array(z.string().trim().min(1)),
    wordCount: z.number().int().nonnegative(),
    depth: z.number().int().nonnegative(),
    crawledAt: z.string().datetime({ offset: true }),
  })
  .strict();

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  apos: "'",
  bull: '•',
  gt: '>',
  hellip: '…',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  quot: '"',
  rdquo: '”',
  rsquo: '’',
};

export interface CrawledMathDocument {
  sourcePath: string;
  title: string;
  sourceUrl: string;
  canonicalUrl: string;
  course: 'math';
  tags: string[];
  declaredWordCount: number;
  depth: number;
  crawledAt: string;
  body: string;
  normalizedTitle: string;
  normalizedBody: string;
  language: MathResourceLanguage;
  contentHash: string;
}

function invalidSchema(
  message: string,
  details: Record<string, unknown>,
  cause?: unknown,
): AdaptiveLearningError {
  return new AdaptiveLearningError({
    code: 'INVALID_SCHEMA',
    message,
    retryable: false,
    stage: 'resource-parse',
    details,
    cause,
  });
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);/giu, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const hexadecimal = entity[1]?.toLowerCase() === 'x';
      const digits = entity.slice(hexadecimal ? 2 : 1);
      const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
      try {
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function normalizeComparableText(value: string): string {
  return decodeHtmlEntities(value)
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{Z}\s]+/gu, ' ')
    .trim();
}

export function detectLanguage(value: string): MathResourceLanguage {
  const normalized = decodeHtmlEntities(value).normalize('NFKC');
  const hasHan = /\p{Script=Han}/u.test(normalized);
  const hasLatin = /\p{Script=Latin}/u.test(normalized);

  if (hasHan && hasLatin) return 'mixed';
  if (hasHan) return 'zh-CN';
  if (hasLatin) return 'en';
  return 'mixed';
}

export function canonicalizeUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw invalidSchema('Crawled resource contains an invalid URL', { url: value }, cause);
  }

  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey.startsWith('utm_') || normalizedKey === 'ref' || normalizedKey === 'source') {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/u, '') || '/';

  return url.toString().replace(/\/(?=\?|$)/u, '');
}

export function parseCrawledMathDocument(
  sourcePath: string,
  markdown: string,
): CrawledMathDocument {
  const normalizedSourcePath = sourcePath.replace(/\\/g, '/');
  const frontMatterMatch = markdown.match(
    /^(?:\uFEFF)?---[\t ]*\r?\n([\s\S]*?)\r?\n---[\t ]*(?:\r?\n|$)/u,
  );

  if (!frontMatterMatch) {
    throw invalidSchema('Crawled resource is missing valid YAML front matter', {
      sourcePath: normalizedSourcePath,
      reason: 'front-matter-delimiters',
    });
  }

  let yaml: unknown;
  try {
    yaml = load(frontMatterMatch[1]);
  } catch (cause) {
    throw invalidSchema(
      'Crawled resource YAML front matter could not be parsed',
      { sourcePath: normalizedSourcePath, reason: 'invalid-yaml' },
      cause,
    );
  }

  const parsed = frontMatterSchema.safeParse(yaml);
  if (!parsed.success) {
    throw invalidSchema('Crawled resource front matter failed schema validation', {
      sourcePath: normalizedSourcePath,
      issues: parsed.error.issues,
    });
  }

  const body = markdown.slice(frontMatterMatch[0].length).trim();
  if (body.length < MINIMUM_BODY_LENGTH) {
    throw invalidSchema('Crawled resource body is too short', {
      sourcePath: normalizedSourcePath,
      bodyLength: body.length,
      minimumBodyLength: MINIMUM_BODY_LENGTH,
    });
  }

  const normalizedTitle = normalizeComparableText(parsed.data.title);
  const normalizedBody = normalizeComparableText(body);

  return {
    sourcePath: normalizedSourcePath,
    title: parsed.data.title,
    sourceUrl: parsed.data.source,
    canonicalUrl: canonicalizeUrl(parsed.data.originalUrl),
    course: parsed.data.course,
    tags: parsed.data.tags,
    declaredWordCount: parsed.data.wordCount,
    depth: parsed.data.depth,
    crawledAt: parsed.data.crawledAt,
    body,
    normalizedTitle,
    normalizedBody,
    language: detectLanguage(body),
    contentHash: createHash('sha256').update(normalizedBody, 'utf8').digest('hex'),
  };
}
