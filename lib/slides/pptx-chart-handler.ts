/**
 * PPTX Chart Handler
 *
 * Renders PPTChartElement to pptxgenjs native charts.
 * Supports: bar, column, line, pie, doughnut.
 */

import type pptxgen from 'pptxgenjs';
import type { PPTChartElement } from '@/lib/types/slides';
import type { ThemeToken } from './types';
import { toPptxHex } from './color-utils';

interface ChartRenderContext {
  pptxSlide: pptxgen.Slide;
  theme: ThemeToken;
  ratioPx2Inch: number;
}

const CHART_TYPE_MAP: Record<string, string> = {
  bar: 'bar',
  column: 'bar',
  line: 'line',
  pie: 'pie',
  ring: 'doughnut',
  area: 'area',
  radar: 'radar',
  scatter: 'scatter',
};

/**
 * Convert PPTChartElement to pptxgenjs chart data and render it.
 */
export function addChartToSlide(
  ctx: ChartRenderContext,
  el: PPTChartElement,
): void {
  const { pptxSlide, theme, ratioPx2Inch } = ctx;
  const x = el.left / ratioPx2Inch;
  const y = el.top / ratioPx2Inch;
  const w = el.width / ratioPx2Inch;
  const h = el.height / ratioPx2Inch;

  const chartType = CHART_TYPE_MAP[el.chartType] || 'bar';
  const data = buildChartData(el, theme);
  const colors = buildChartColors(el, theme);

  const options: Record<string, unknown> = {
    x,
    y,
    w,
    h,
    showLegend: data.length > 1,
    legendPos: 'b',
    legendFontSize: 9,
    legendFontFace: theme.fontFamily,
    chartColors: colors,
    ...(el.textColor ? { titleColor: toPptxHex(el.textColor) } : {}),
    ...(el.lineColor ? { gridLineColor: toPptxHex(el.lineColor) } : {}),
    ...(el.fill ? { fill: toPptxHex(el.fill) } : {}),
    ...(el.options?.lineSmooth && chartType === 'line' ? { lineDataSymbol: 'circle', lineDataSymbolSize: 6 } : {}),
  };

  // @ts-expect-error pptxgenjs addChart type is loosely typed
  pptxSlide.addChart(chartType as pptxgen.ChartType, data, options);
}

function buildChartData(el: PPTChartElement, theme: ThemeToken): Array<{ name: string; labels: string[]; values: number[] }> {
  const { labels, legends, series } = el.data;
  if (!series || series.length === 0) {
    return [{ name: '', labels: labels || [], values: [] }];
  }
  return series.map((s, i) => ({
    name: legends?.[i] || `Series ${i + 1}`,
    labels: labels || [],
    values: s,
  }));
}

function buildChartColors(el: PPTChartElement, theme: ThemeToken): string[] {
  if (el.themeColors && el.themeColors.length > 0) {
    return el.themeColors.map((c) => toPptxHex(c));
  }
  // Default theme palette
  return [
    toPptxHex(theme.accent),
    toPptxHex(theme.accentSecondary),
    toPptxHex(theme.dividerColor),
    toPptxHex(theme.coverSubColor),
    toPptxHex(theme.bodyMutedColor),
  ];
}
