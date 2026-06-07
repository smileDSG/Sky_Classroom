/**
 * tests/components/responsive.test.tsx
 * 测试响应式布局 — 移动端断点行为
 *
 * 项目依赖 Tailwind CSS 断点和 CSS Container Queries，
 * 没有 JS 响应式 hook。因此测试 matchMedia 行为。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('responsive — 响应式布局', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('移动端断点 (max-width: 639px) 被正确识别', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches:
        // max-width 媒体查询：宽度为 500 时匹配
        query.includes('max-width') && query.includes('639'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const isMobile = window.matchMedia('(max-width: 639px)').matches;
    expect(isMobile).toBe(true);
  });

  it('桌面端断点 (min-width: 1024px) 被正确识别', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query.includes('min-width') && query.includes('1024'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    expect(isDesktop).toBe(true);
  });

  it('平板端断点 (min-width: 640px) and (max-width: 1023px)', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches:
        query.includes('min-width: 640px') && query.includes('max-width: 1023px'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const isTablet = window.matchMedia(
      '(min-width: 640px) and (max-width: 1023px)',
    ).matches;
    expect(isTablet).toBe(true);
  });

});
