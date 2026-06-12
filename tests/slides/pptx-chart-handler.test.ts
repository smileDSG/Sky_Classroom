import { describe, it, expect, vi } from 'vitest';
import { addChartToSlide } from '@/lib/slides/pptx-chart-handler';
import type { PPTChartElement } from '@/lib/types/slides';
import type { ThemeToken } from '@/lib/slides/types';

function mockSlide() {
  return {
    addChart: vi.fn(),
  } as unknown as { addChart: ReturnType<typeof vi.fn> };
}

function baseTheme(): ThemeToken {
  return {
    id: 'sky-blue',
    name: 'Sky Blue',
    description: 'A sky blue theme',
    fontFamily: 'Microsoft YaHei',
    headingFont: 'Arial',
    coverTitleSize: 44,
    coverSubSize: 20,
    titleFontSize: 32,
    bodyFontSize: 18,
    captionFontSize: 12,
    bulletSize: 16,
    bulletStyle: 'dot',
    pageMargin: 60,
    contentMaxWidth: 880,
    useWideContent: false,
    accent: '#3b82f6',
    accentSecondary: '#60a5fa',
    accentLight: '#dbeafe',
    coverTitleColor: '#1e3a8a',
    coverSubColor: '#64748b',
    bodyColor: '#1e293b',
    bodyMutedColor: '#64748b',
    pageNumColor: '#94a3b8',
    dividerColor: '#cbd5e1',
    coverBg: '#f8fafc',
    contentBg: '#ffffff',
    shapeOutlineColor: '#e2e8f0',
    shadowColor: '#00000020',
    coverBgGradient: undefined,
    contentBgGradient: undefined,
    coverDecorations: [],
  };
}

function baseChart(chartType: PPTChartElement['chartType']): PPTChartElement {
  return {
    id: 'chart-1',
    type: 'chart',
    left: 60,
    top: 130,
    width: 880,
    height: 360,
    rotate: 0,
    chartType,
    data: {
      labels: ['A', 'B', 'C'],
      legends: ['数据'],
      series: [[10, 25, 15]],
    },
    themeColors: ['#3b82f6', '#60a5fa', '#93c5fd'],
    textColor: '#1e293b',
    lineColor: '#cbd5e1',
  };
}

describe('pptx-chart-handler', () => {
  it('renders bar chart with correct position and size', () => {
    const slide = mockSlide();
    const theme = baseTheme();
    const el = baseChart('bar');

    addChartToSlide({ pptxSlide: slide as any, theme, ratioPx2Inch: 96 }, el);

    expect(slide.addChart).toHaveBeenCalledOnce();
    const [, , opts] = slide.addChart.mock.calls[0];
    expect(opts.x).toBeCloseTo(60 / 96, 4);
    expect(opts.y).toBeCloseTo(130 / 96, 4);
    expect(opts.w).toBeCloseTo(880 / 96, 4);
    expect(opts.h).toBeCloseTo(360 / 96, 4);
  });

  it('maps chart types correctly', () => {
    const map: Record<string, string> = {
      bar: 'bar',
      column: 'bar',
      line: 'line',
      pie: 'pie',
      ring: 'doughnut',
      area: 'area',
      radar: 'radar',
      scatter: 'scatter',
    };

    for (const [input, expected] of Object.entries(map)) {
      const slide = mockSlide();
      const el = baseChart(input as PPTChartElement['chartType']);
      addChartToSlide({ pptxSlide: slide as any, theme: baseTheme(), ratioPx2Inch: 96 }, el);
      expect(slide.addChart).toHaveBeenCalledOnce();
      expect(slide.addChart.mock.calls[0][0]).toBe(expected);
    }
  });

  it('falls back to bar for unknown chart type', () => {
    const slide = mockSlide();
    const el = baseChart('bar');
    (el as any).chartType = 'unknown';

    addChartToSlide({ pptxSlide: slide as any, theme: baseTheme(), ratioPx2Inch: 96 }, el);
    expect(slide.addChart.mock.calls[0][0]).toBe('bar');
  });

  it('uses element themeColors when provided', () => {
    const slide = mockSlide();
    const el = baseChart('pie');

    addChartToSlide({ pptxSlide: slide as any, theme: baseTheme(), ratioPx2Inch: 96 }, el);
    const [, , opts] = slide.addChart.mock.calls[0];
    expect(opts.chartColors).toEqual(['3b82f6', '60a5fa', '93c5fd']);
  });

  it('falls back to theme palette when themeColors missing', () => {
    const slide = mockSlide();
    const el = baseChart('bar');
    el.themeColors = [];

    addChartToSlide({ pptxSlide: slide as any, theme: baseTheme(), ratioPx2Inch: 96 }, el);
    const [, , opts] = slide.addChart.mock.calls[0];
    expect(opts.chartColors).toBeDefined();
    expect(opts.chartColors.length).toBeGreaterThan(0);
  });

  it('handles multi-series data', () => {
    const slide = mockSlide();
    const el = baseChart('bar');
    el.data.legends = ['2023', '2024'];
    el.data.series = [
      [10, 20, 30],
      [15, 25, 35],
    ];

    addChartToSlide({ pptxSlide: slide as any, theme: baseTheme(), ratioPx2Inch: 96 }, el);
    const [, data] = slide.addChart.mock.calls[0];
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('2023');
    expect(data[1].name).toBe('2024');
    expect(data[0].values).toEqual([10, 20, 30]);
  });

  it('shows legend only when multi-series', () => {
    const slide1 = mockSlide();
    const el1 = baseChart('bar');
    el1.data.series = [[1, 2]];
    addChartToSlide({ pptxSlide: slide1 as any, theme: baseTheme(), ratioPx2Inch: 96 }, el1);
    const [, , opts1] = slide1.addChart.mock.calls[0];
    expect(opts1.showLegend).toBe(false);

    const slide2 = mockSlide();
    const el2 = baseChart('bar');
    el2.data.series = [[1, 2], [3, 4]];
    addChartToSlide({ pptxSlide: slide2 as any, theme: baseTheme(), ratioPx2Inch: 96 }, el2);
    const [, , opts2] = slide2.addChart.mock.calls[0];
    expect(opts2.showLegend).toBe(true);
  });

  it('applies line smoothing for line charts with lineSmooth option', () => {
    const slide = mockSlide();
    const el = baseChart('line');
    el.options = { lineSmooth: true };

    addChartToSlide({ pptxSlide: slide as any, theme: baseTheme(), ratioPx2Inch: 96 }, el);
    const [, , opts] = slide.addChart.mock.calls[0];
    expect(opts.lineDataSymbol).toBe('circle');
    expect(opts.lineDataSymbolSize).toBe(6);
  });

  it('handles empty series gracefully', () => {
    const slide = mockSlide();
    const el = baseChart('bar');
    el.data.series = [];

    addChartToSlide({ pptxSlide: slide as any, theme: baseTheme(), ratioPx2Inch: 96 }, el);
    const [, data] = slide.addChart.mock.calls[0];
    expect(data).toHaveLength(1);
    expect(data[0].values).toEqual([]);
  });
});
