import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import CoverSVGRenderer from '@/components/sky/slides/cover-svg-renderer';
import { getDefaultDesignDNA } from '@/lib/slides/agent/design-dna';

describe('CoverSVGRenderer', () => {
  const defaultDNA = getDefaultDesignDNA();

  it('renders without crashing', () => {
    const { container } = render(
      <CoverSVGRenderer designDNA={defaultDNA} title="测试标题" subtitle="测试副标题" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('has correct viewBox', () => {
    const { container } = render(
      <CoverSVGRenderer designDNA={defaultDNA} title="测试" subtitle="副标题" />,
    );
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 13.33 7.5');
  });

  it('renders background rect with coverBg color', () => {
    const { container } = render(
      <CoverSVGRenderer designDNA={defaultDNA} title="测试" subtitle="副标题" />,
    );
    const rect = container.querySelector('rect');
    expect(rect?.getAttribute('fill')).toBe(`#${defaultDNA.colors.coverBg}`);
  });

  it('renders title text', () => {
    const { container } = render(
      <CoverSVGRenderer designDNA={defaultDNA} title="光合作用" subtitle="高中教学课件" />,
    );
    const texts = Array.from(container.querySelectorAll('text'));
    const titleText = texts.find((t) => t.textContent?.includes('光合作用'));
    expect(titleText).toBeTruthy();
  });

  it('renders subtitle text', () => {
    const { container } = render(
      <CoverSVGRenderer designDNA={defaultDNA} title="光合作用" subtitle="高中教学课件" />,
    );
    const texts = Array.from(container.querySelectorAll('text'));
    const subtitleText = texts.find((t) => t.textContent?.includes('高中教学课件'));
    expect(subtitleText).toBeTruthy();
  });

  it('switches layout based on layoutType', () => {
    const heroLeftDNA = { ...defaultDNA, layoutType: 'hero-left' as const };
    const splitPanelDNA = { ...defaultDNA, layoutType: 'split-panel' as const };

    const { container: c1 } = render(
      <CoverSVGRenderer designDNA={heroLeftDNA} title="测试" subtitle="副标题" />,
    );
    const { container: c2 } = render(
      <CoverSVGRenderer designDNA={splitPanelDNA} title="测试" subtitle="副标题" />,
    );

    // split-panel has a left panel rect of width 6
    const rects2 = Array.from(c2.querySelectorAll('rect'));
    const leftPanel = rects2.find((r) => r.getAttribute('width') === '6');
    expect(leftPanel).toBeTruthy();

    // hero-left does not have a rect of width 6
    const rects1 = Array.from(c1.querySelectorAll('rect'));
    const noLeftPanel = rects1.find((r) => r.getAttribute('width') === '6');
    expect(noLeftPanel).toBeFalsy();
  });
});
