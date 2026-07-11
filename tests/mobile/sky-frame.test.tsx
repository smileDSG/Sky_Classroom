import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import {
  MobileSkyFrame,
  applyMobileFrameScrollbarStyles,
  toMobileHref,
} from '@/components/mobile/mobile-sky-frame';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

describe('MobileSkyFrame', () => {
  test('marks the iframe itself as scrollbar hidden', () => {
    render(<MobileSkyFrame src="/sky/cloud-mind/solve" />);

    const frame = screen.getByTitle('Mobile page');

    expect(frame).toHaveClass('scrollbar-hide', 'h-dvh');
    expect(frame).not.toHaveClass('overflow-hidden');
    expect(frame).not.toHaveAttribute('scrolling');
  });

  test('supports fitContainer to fill parent instead of viewport', () => {
    render(<MobileSkyFrame src="/sky/cloud-mind/quiz" fitContainer />);

    const frame = screen.getByTitle('Mobile page');

    expect(frame).toHaveClass('scrollbar-hide', 'h-full');
    expect(frame).not.toHaveClass('h-dvh');
  });

  test('injects scrollbar hiding styles into the framed document', () => {
    const frameDocument = document.implementation.createHTMLDocument('frame');

    applyMobileFrameScrollbarStyles(frameDocument);

    const injectedStyle = frameDocument.getElementById('mobile-frame-scrollbar-reset');
    expect(injectedStyle?.textContent).toContain('scrollbar-width: none');
    expect(injectedStyle?.textContent).toContain('overflow-x: hidden');
    expect(injectedStyle?.textContent).toContain('overflow-y: auto');
    expect(injectedStyle?.textContent).toContain('*::-webkit-scrollbar');
    expect(injectedStyle?.textContent).toContain('[data-sky-responsive-top-bar]');
    expect(injectedStyle?.textContent).toContain('[data-sky-responsive-bottom-nav]');
    expect(injectedStyle?.textContent).toContain('background: transparent');
    expect(frameDocument.documentElement.classList.contains('mobile-frame-scrollbar-hidden')).toBe(
      true,
    );
    expect(frameDocument.body.classList.contains('mobile-frame-scrollbar-hidden')).toBe(true);
  });

  test('maps the legacy desktop learning route to the native mobile study lab', () => {
    expect(toMobileHref('/sky/learning', 'http://localhost:3000')).toBe('/m/sky/study-lab');
    expect(
      toMobileHref('http://localhost:3000/sky/learning?tab=today', 'http://localhost:3000'),
    ).toBe('/m/sky/study-lab?tab=today');
  });
});
