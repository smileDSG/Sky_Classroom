import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  HeroLeftCover,
  HeroCenteredCover,
  SplitPanelCover,
  MinimalTypeCover,
  BoldAccentCover,
} from '@/components/sky/slides/cover-layouts';
import { getDefaultDesignDNA } from '@/lib/slides/agent/design-dna';
import type { DesignDNA } from '@/lib/slides/agent/design-dna';

describe('Cover Layouts', () => {
  const baseDNA = getDefaultDesignDNA();

  function createDNA(overrides: Partial<DesignDNA> = {}): DesignDNA {
    return { ...baseDNA, ...overrides };
  }

  describe('HeroLeftCover', () => {
    it('renders without crashing', () => {
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <HeroLeftCover dna={baseDNA} title="测试" subtitle="副标题" />
        </svg>,
      );
      expect(container.querySelector('rect')).toBeTruthy();
    });

    it('density=sparse has ≤1 decorative circle', () => {
      const dna = createDNA({ decoration: { ...baseDNA.decoration, density: 'sparse' } });
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <HeroLeftCover dna={dna} title="测试" subtitle="副标题" />
        </svg>,
      );
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeLessThanOrEqual(1);
    });

    it('density=rich has ≥3 decorative circles', () => {
      const dna = createDNA({ decoration: { ...baseDNA.decoration, density: 'rich' } });
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <HeroLeftCover dna={dna} title="测试" subtitle="副标题" />
        </svg>,
      );
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('HeroCenteredCover', () => {
    it('renders without crashing', () => {
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <HeroCenteredCover dna={baseDNA} title="测试" subtitle="副标题" />
        </svg>,
      );
      expect(container.querySelector('rect')).toBeTruthy();
    });

    it('title is centered (textAnchor=middle)', () => {
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <HeroCenteredCover dna={baseDNA} title="光合作用" subtitle="副标题" />
        </svg>,
      );
      const texts = Array.from(container.querySelectorAll('text'));
      const titleText = texts.find((t) => t.textContent === '光合作用');
      expect(titleText?.getAttribute('text-anchor')).toBe('middle');
    });

    it('density=sparse has ≤2 decorative circles', () => {
      const dna = createDNA({ decoration: { ...baseDNA.decoration, density: 'sparse' } });
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <HeroCenteredCover dna={dna} title="测试" subtitle="副标题" />
        </svg>,
      );
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeLessThanOrEqual(2);
    });

    it('density=rich has ≥4 decorative circles', () => {
      const dna = createDNA({ decoration: { ...baseDNA.decoration, density: 'rich' } });
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <HeroCenteredCover dna={dna} title="测试" subtitle="副标题" />
        </svg>,
      );
      const circles = container.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('SplitPanelCover', () => {
    it('renders without crashing', () => {
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <SplitPanelCover dna={baseDNA} title="测试" subtitle="副标题" />
        </svg>,
      );
      expect(container.querySelector('rect')).toBeTruthy();
    });

    it('has left panel rect with width 6.0', () => {
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <SplitPanelCover dna={baseDNA} title="测试" subtitle="副标题" />
        </svg>,
      );
      const rects = Array.from(container.querySelectorAll('rect'));
      const leftPanel = rects.find((r) => r.getAttribute('width') === '6');
      expect(leftPanel).toBeTruthy();
    });

    it('has accent stripe at split', () => {
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <SplitPanelCover dna={baseDNA} title="测试" subtitle="副标题" />
        </svg>,
      );
      const rects = Array.from(container.querySelectorAll('rect'));
      const stripe = rects.find((r) => r.getAttribute('x') === '6' && r.getAttribute('width') === '0.04');
      expect(stripe).toBeTruthy();
    });
  });

  describe('MinimalTypeCover', () => {
    it('renders without crashing', () => {
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <MinimalTypeCover dna={baseDNA} title="测试" subtitle="副标题" />
        </svg>,
      );
      expect(container.querySelector('rect')).toBeTruthy();
    });

    it('has large title font size', () => {
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <MinimalTypeCover dna={baseDNA} title="光合作用" subtitle="副标题" />
        </svg>,
      );
      const texts = Array.from(container.querySelectorAll('text'));
      const titleText = texts.find((t) => t.textContent === '光合作用');
      const fontSize = parseFloat(titleText?.getAttribute('font-size') || '0');
      expect(fontSize).toBeGreaterThan(0.5); // headingSize + 8 = ~60pt = ~0.83in
    });

    it('density=sparse has no separator line', () => {
      const dna = createDNA({ decoration: { ...baseDNA.decoration, density: 'sparse' } });
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <MinimalTypeCover dna={dna} title="测试" subtitle="副标题" />
        </svg>,
      );
      const lines = container.querySelectorAll('line');
      expect(lines.length).toBe(0);
    });

    it('density=moderate has separator line', () => {
      const dna = createDNA({ decoration: { ...baseDNA.decoration, density: 'moderate' } });
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <MinimalTypeCover dna={dna} title="测试" subtitle="副标题" />
        </svg>,
      );
      const lines = container.querySelectorAll('line');
      expect(lines.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('BoldAccentCover', () => {
    it('renders without crashing', () => {
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <BoldAccentCover dna={baseDNA} title="测试" subtitle="副标题" />
        </svg>,
      );
      expect(container.querySelector('rect')).toBeTruthy();
    });

    it('has top accent bar', () => {
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <BoldAccentCover dna={baseDNA} title="测试" subtitle="副标题" />
        </svg>,
      );
      const rects = Array.from(container.querySelectorAll('rect'));
      const topBar = rects.find((r) => r.getAttribute('y') === '0' && r.getAttribute('height') === '1.2');
      expect(topBar).toBeTruthy();
    });

    it('density=sparse has no bottom bar', () => {
      const dna = createDNA({ decoration: { ...baseDNA.decoration, density: 'sparse' } });
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <BoldAccentCover dna={dna} title="测试" subtitle="副标题" />
        </svg>,
      );
      const rects = Array.from(container.querySelectorAll('rect'));
      const bottomBar = rects.find((r) => r.getAttribute('y') === '6.2');
      expect(bottomBar).toBeFalsy();
    });

    it('density=rich has bottom bar', () => {
      const dna = createDNA({ decoration: { ...baseDNA.decoration, density: 'rich' } });
      const { container } = render(
        <svg viewBox="0 0 13.33 7.5">
          <BoldAccentCover dna={dna} title="测试" subtitle="副标题" />
        </svg>,
      );
      const rects = Array.from(container.querySelectorAll('rect'));
      const bottomBar = rects.find((r) => r.getAttribute('y') === '6.2');
      expect(bottomBar).toBeTruthy();
    });
  });
});
