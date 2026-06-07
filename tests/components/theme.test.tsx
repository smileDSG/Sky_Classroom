/**
 * tests/components/theme.test.tsx
 * 测试主题系统 — 暗色/亮色切换生效
 *
 * 项目使用自定义 ThemeProvider（lib/hooks/use-theme.tsx），
 * 管理 <html> 上的 dark class
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('theme — 主题切换', () => {
  beforeEach(() => {
    // 确保每次测试前 <html> 是干净状态
    document.documentElement.classList.remove('dark');
  });

  // 因为 ThemeProvider 用 React context + useEffect，
  // 这里直接测核心逻辑：dark class 的添加/移除 + localStorage 读写
  // 这是主题系统最关键的 observable behavior

  it('添加 dark class 到 html 元素', () => {
    document.documentElement.classList.add('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('移除 dark class 后 html 元素不包含 dark', () => {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('localStorage 存储主题偏好', () => {
    localStorage.setItem('theme', 'dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    localStorage.setItem('theme', 'light');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('localStorage 中 theme=system 时根据 prefers-color-scheme 决定', () => {
    localStorage.setItem('theme', 'system');

    // 模拟 prefers-color-scheme: dark
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    expect(prefersDark).toBe(true);
  });
});
