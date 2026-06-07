/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';

// Mock next/navigation — 组件测试几乎都会碰到
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next-themes — Sonner toaster 依赖
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock ResizeObserver — Radix Popover 和 canvas 组件依赖
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock PointerEvent — Radix 组件依赖
class FakePointerEvent extends Event {
  pointerType: string;
  constructor(type: string, init?: EventInit & { pointerType?: string }) {
    super(type, init);
    this.pointerType = 'mouse';
  }
}
// @ts-expect-error - PointerEvent is not in jsdom
global.PointerEvent = FakePointerEvent;

// Mock scrollTo
Element.prototype.scrollTo = vi.fn();
Element.prototype.scrollIntoView = vi.fn();

// Mock matchMedia — 响应式测试需要
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock requestAnimationFrame + cancelAnimationFrame — motion/framer-motion 需要
global.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
  return setTimeout(cb, 16) as unknown as number;
});
global.cancelAnimationFrame = vi.fn((id: number) => {
  clearTimeout(id);
});

// Mock URL.createObjectURL / revokeObjectURL — 媒体测试需要
if (!global.URL.createObjectURL) {
  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: vi.fn(() => 'blob:mock-url'),
  });
}
if (!global.URL.revokeObjectURL) {
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: vi.fn(),
  });
}
