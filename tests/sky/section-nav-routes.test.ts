import { describe, expect, it } from 'vitest';
import { SECTION_GROUPS } from '@/components/sky/layout/sky-section-nav';

describe('sky section navigation routes', () => {
  it('gives every sidebar item a unique page route without anchors or view queries', () => {
    const items = Object.values(SECTION_GROUPS).flatMap((groups) =>
      groups.flatMap((group) => group.items),
    );
    const hrefs = items.map((item) => item.href);

    expect(new Set(hrefs)).toHaveLength(hrefs.length);
    expect(hrefs.some((href) => href.includes('#') || href.includes('?'))).toBe(false);
  });
});
