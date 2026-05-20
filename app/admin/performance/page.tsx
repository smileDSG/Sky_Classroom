/**
 * Admin performance monitoring dashboard.
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, TitleComponent, LegendComponent } from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getVitalsHistory, type WebVitalEntry } from '@/lib/monitoring/web-vitals';

echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, TitleComponent, LegendComponent, SVGRenderer]);

export default function PerformanceDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<Record<string, unknown> | null>(null);
  const [vitals, setVitals] = useState<WebVitalEntry[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const clsChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch health data
    fetch('/api/admin/performance')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success) setHealthData(data.health as Record<string, unknown> | null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load vitals history
    setVitals(getVitalsHistory());
  }, []);

  useEffect(() => {
    if (!chartRef.current || vitals.length === 0) return;

    const chart = echarts.init(chartRef.current);
    const lcpData = vitals.filter((v) => v.name === 'LCP');
    chart.setOption({
      title: { text: 'LCP (Largest Contentful Paint)', left: 'center' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: lcpData.map((_, i) => `#${i + 1}`) },
      yAxis: { type: 'value', name: 'ms' },
      series: [{ type: 'line', data: lcpData.map((v) => Math.round(v.value)), smooth: true }],
    });

    return () => chart.dispose();
  }, [vitals]);

  useEffect(() => {
    if (!clsChartRef.current || vitals.length === 0) return;

    const chart = echarts.init(clsChartRef.current);
    const clsData = vitals.filter((v) => v.name === 'CLS');
    chart.setOption({
      title: { text: 'CLS (Cumulative Layout Shift)', left: 'center' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: clsData.map((_, i) => `#${i + 1}`) },
      yAxis: { type: 'value', name: 'score' },
      series: [{ type: 'bar', data: clsData.map((v) => +v.value.toFixed(3)) }],
    });

    return () => chart.dispose();
  }, [vitals]);

  const avgVital = (name: string) => {
    const entries = vitals.filter((v) => v.name === name);
    if (entries.length === 0) return null;
    return Math.round(entries.reduce((s, e) => s + e.value, 0) / entries.length);
  };

  const vitalRating = (name: string) => {
    const entries = vitals.filter((v) => v.name === name);
    if (entries.length === 0) return null;
    const last = entries[entries.length - 1];
    return last.rating;
  };

  const ratingColor = (r?: string) =>
    r === 'good' ? 'bg-green-500' : r === 'needs-improvement' ? 'bg-yellow-500' : r === 'poor' ? 'bg-red-500' : 'bg-gray-400';

  if (loading) return <p className="text-center py-8">Loading...</p>;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold">Performance Dashboard</h1>

      {/* Vital Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['LCP', 'FCP', 'CLS', 'TTFB'].map((name) => {
          const avg = avgVital(name);
          const rating = vitalRating(name);
          return (
            <Card key={name}>
              <CardHeader className="pb-2">
                <CardDescription>{name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{avg !== null ? `${avg}${name === 'CLS' ? '' : 'ms'}` : '—'}</span>
                  <Badge className={ratingColor(rating)}>{rating ?? 'n/a'}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="pt-4">
            <div ref={chartRef} className="h-64" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div ref={clsChartRef} className="h-64" />
          </CardContent>
        </Card>
      </div>

      {/* Health Status */}
      {healthData && (
        <Card>
          <CardHeader>
            <CardTitle>Server Health</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted p-4 rounded-md overflow-auto max-h-96">
              {JSON.stringify(healthData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
