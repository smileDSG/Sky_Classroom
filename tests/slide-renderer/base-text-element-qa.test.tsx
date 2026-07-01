import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { BaseTextElement } from '@/components/slide-renderer/components/element/TextElement/BaseTextElement';
import type { PPTTextElement } from '@/lib/types/slides';

const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');
const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollHeight');

function mockMeasuredTextSize(width: number, height: number): void {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() {
      return width;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get() {
      return height;
    },
  });
}

function restoreMeasuredTextSize(): void {
  if (originalScrollWidth) {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth);
  }
  if (originalScrollHeight) {
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', originalScrollHeight);
  }
}

function makeTextElement(overrides: Partial<PPTTextElement> = {}): PPTTextElement {
  return {
    id: 'text_qa',
    type: 'text',
    left: 0,
    top: 0,
    width: 220,
    height: 90,
    rotate: 0,
    content: '<p style="font-size:18px;">Java loop text</p>',
    defaultFontName: 'Microsoft YaHei',
    defaultColor: '#17233c',
    ...overrides,
  } as PPTTextElement;
}

describe('BaseTextElement render QA markers', () => {
  afterEach(() => {
    restoreMeasuredTextSize();
  });

  it('marks text as overflow when browser measurement cannot fit at the minimum scale', async () => {
    mockMeasuredTextSize(260, 320);

    const { container } = render(<BaseTextElement elementInfo={makeTextElement()} />);
    const qaElement = container.querySelector('[data-slide-qa-element-id="text_qa"]');

    await waitFor(() => {
      expect(qaElement).toHaveAttribute('data-slide-qa-overflow', 'true');
      expect(qaElement).toHaveAttribute('data-slide-qa-status', 'overflow');
    });
  });

  it('marks text as scale-down when it fits only after heavy browser scaling', async () => {
    mockMeasuredTextSize(260, 100);

    const { container } = render(<BaseTextElement elementInfo={makeTextElement()} />);
    const qaElement = container.querySelector('[data-slide-qa-element-id="text_qa"]');

    await waitFor(() => {
      expect(qaElement).toHaveAttribute('data-slide-qa-status', 'scale-down');
      expect(qaElement).toHaveAttribute('data-slide-qa-overflow', 'false');
    });
  });
});
