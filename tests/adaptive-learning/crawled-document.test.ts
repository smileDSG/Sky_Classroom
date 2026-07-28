import { describe, expect, it } from 'vitest';

import { AdaptiveLearningError } from '@/lib/adaptive-learning/errors';
import {
  canonicalizeUrl,
  detectLanguage,
  normalizeComparableText,
  parseCrawledMathDocument,
} from '@/lib/adaptive-learning/resources/crawled-document';

function markdown(body: string, originalUrl: string): string {
  return `---
title: "Ｆｕｎｃｔｉｏｎ＆Slope"
source: "https://Example.com/math/functions/"
originalUrl: "${originalUrl}"
course: "math"
tags: ["functions", "algebra"]
wordCount: 120
depth: 2
crawledAt: "2026-07-28T08:00:00.000Z"
---

${body}`;
}

function captureInvalidSchema(run: () => unknown): AdaptiveLearningError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AdaptiveLearningError);
    const adaptiveError = error as AdaptiveLearningError;
    expect(adaptiveError).toMatchObject({
      code: 'INVALID_SCHEMA',
      retryable: false,
      stage: 'resource-parse',
    });
    return adaptiveError;
  }
  throw new Error('Expected INVALID_SCHEMA');
}

describe('crawled math document parser', () => {
  it('produces stable comparable text, hashes, URLs, and source paths', () => {
    const first = parseCrawledMathDocument(
      'data\\crawled\\math\\functions.md',
      markdown(
        'ＦＵＮＣＴＩＯＮ， value &amp; slope! '.repeat(4),
        'https://EXAMPLE.com/math/functions/?utm_source=newsletter&b=2&a=1&ref=sidebar#proof',
      ),
    );
    const second = parseCrawledMathDocument(
      'data/crawled/math/functions-copy.md',
      markdown('function value slope '.repeat(4), 'https://example.com/math/functions?a=1&b=2'),
    );

    expect(first.sourcePath).toBe('data/crawled/math/functions.md');
    expect(first.canonicalUrl).toBe('https://example.com/math/functions?a=1&b=2');
    expect(first.normalizedTitle).toBe('function slope');
    expect(first.normalizedBody).toBe(second.normalizedBody);
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('decodes entities and distinguishes Chinese, English, and mixed text', () => {
    expect(normalizeComparableText(' Ａ&amp;Ｂ&nbsp;，&#x4E2D;&#25991; ')).toBe('a b 中文');
    expect(detectLanguage('函数图像与导数关系')).toBe('zh-CN');
    expect(detectLanguage('Functions and derivative graphs')).toBe('en');
    expect(detectLanguage('函数 function 的图像')).toBe('mixed');
  });

  it('removes tracking data and trailing slashes while sorting retained URL parameters', () => {
    expect(
      canonicalizeUrl(
        'https://Example.com/math/functions///?z=9&utm_medium=email&Source=crawler&a=2&a=1&ref=sidebar#proof',
      ),
    ).toBe('https://example.com/math/functions?a=2&a=1&z=9');
  });

  it.each([
    ['javascript:alert(1)', 'unsupported-url-protocol'],
    ['data:text/plain,math', 'unsupported-url-protocol'],
    ['ftp://example.com/math', 'unsupported-url-protocol'],
    ['not a url', 'invalid-url'],
  ])('rejects unsafe or malformed canonical URLs: %s', (url, reason) => {
    const error = captureInvalidSchema(() => canonicalizeUrl(url));
    expect(error.details).toMatchObject({ url, reason });
  });

  it.each([
    ['source', 'source: "https://Example.com/math/functions/"', 'source: "ftp://example.com/math"'],
    [
      'originalUrl',
      'originalUrl: "https://example.com/math"',
      'originalUrl: "javascript:alert(1)"',
    ],
  ])('rejects unsupported %s protocols in parsed metadata', (field, current, replacement) => {
    const input = markdown('x'.repeat(50), 'https://example.com/math').replace(
      current,
      replacement,
    );
    const error = captureInvalidSchema(() => parseCrawledMathDocument('unsafe.md', input));
    expect(error.details).toMatchObject({
      sourcePath: 'unsafe.md',
      field,
      reason: 'unsupported-url-protocol',
    });
  });

  it('reports true YAML syntax failures with their cause', () => {
    const invalidYaml = `---
title: "unterminated
source: "https://example.com/math"
originalUrl: "https://example.com/math"
course: "math"
tags: ["math"]
wordCount: 50
depth: 1
crawledAt: "2026-07-28T08:00:00.000Z"
---

${'x'.repeat(50)}`;
    const error = captureInvalidSchema(() =>
      parseCrawledMathDocument('invalid-yaml.md', invalidYaml),
    );
    expect(error.details).toMatchObject({
      sourcePath: 'invalid-yaml.md',
      reason: 'invalid-yaml',
    });
    expect(error.cause).toBeInstanceOf(Error);
  });

  it('rejects malformed front matter and cross-subject documents without fallback', () => {
    const missing = captureInvalidSchema(() =>
      parseCrawledMathDocument('data\\crawled\\math\\missing.md', 'plain markdown only'),
    );
    expect(missing.details).toMatchObject({
      sourcePath: 'data/crawled/math/missing.md',
      reason: 'front-matter-delimiters',
    });

    const biology = markdown('Biology content '.repeat(6), 'https://example.com/biology').replace(
      'course: "math"',
      'course: "biology"',
    );
    const crossSubject = captureInvalidSchema(() =>
      parseCrawledMathDocument('data/crawled/biology.md', biology),
    );
    expect(crossSubject.details).toMatchObject({ sourcePath: 'data/crawled/biology.md' });
  });

  it('rejects extra metadata keys and bodies below the sharp 50-character boundary', () => {
    const extraKey = markdown('x'.repeat(50), 'https://example.com/math').replace(
      'depth: 2',
      'depth: 2\nunknown: true',
    );
    captureInvalidSchema(() => parseCrawledMathDocument('extra.md', extraKey));

    const shortBody = captureInvalidSchema(() =>
      parseCrawledMathDocument('short.md', markdown('x'.repeat(49), 'https://example.com/math')),
    );
    expect(shortBody.details).toMatchObject({ bodyLength: 49, minimumBodyLength: 50 });

    expect(
      parseCrawledMathDocument('boundary.md', markdown('x'.repeat(50), 'https://example.com/math'))
        .body,
    ).toHaveLength(50);
  });
});
