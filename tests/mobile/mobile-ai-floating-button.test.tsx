import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileAIFloatingButton } from '@/components/mobile/mobile-ai-floating-button';

vi.mock('next/navigation', () => ({
  usePathname: () => '/m/sky',
}));

describe('MobileAIFloatingButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'PointerEvent', {
      configurable: true,
      value: MouseEvent,
    });
  });

  it('stays fixed to the viewport and opens on click', () => {
    const openListener = vi.fn();
    window.addEventListener('open-kagami-panel', openListener);

    render(<MobileAIFloatingButton />);
    const button = screen.getByRole('button', { name: '打开云翼助手' });

    expect(button).toHaveClass('fixed', 'touch-none');
    fireEvent.click(button);
    expect(openListener).toHaveBeenCalledOnce();

    window.removeEventListener('open-kagami-panel', openListener);
  });

  it('moves within the viewport without opening the panel after a drag', () => {
    const openListener = vi.fn();
    window.addEventListener('open-kagami-panel', openListener);

    render(<MobileAIFloatingButton />);
    const button = screen.getByRole('button', { name: '打开云翼助手' });
    vi.spyOn(button.parentElement!, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 390,
      bottom: 844,
      width: 390,
      height: 844,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    Object.defineProperties(button, {
      getBoundingClientRect: {
        value: () => ({
          left: 320,
          top: 600,
          right: 376,
          bottom: 656,
          width: 56,
          height: 56,
          x: 320,
          y: 600,
          toJSON: () => ({}),
        }),
      },
    });

    fireEvent.pointerDown(button, { pointerId: 1, clientX: 348, clientY: 628 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 148, clientY: 328 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 148, clientY: 328 });
    fireEvent.click(button);

    expect(button).toHaveStyle({ left: '120px', top: '300px' });
    expect(openListener).not.toHaveBeenCalled();

    window.removeEventListener('open-kagami-panel', openListener);
  });

  it('disables native image dragging so pointer movement stays on the button gesture', () => {
    render(<MobileAIFloatingButton />);

    expect(screen.getByAltText('小镜')).toHaveAttribute('draggable', 'false');
  });
});
