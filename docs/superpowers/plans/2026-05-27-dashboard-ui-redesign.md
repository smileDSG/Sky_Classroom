# 概况页 UI/UX 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the /sky dashboard page into a dark-themed data analytics panel with animated stat cards, a 7-day learning trend line chart, a 5-axis ability radar chart, and rich motion animations.

**Architecture:** Hand-written SVG chart components + `motion/react` for animations + `useAnimationFrame`-based number counter hook. Zero new npm dependencies. All charts are pure functional components receiving data props.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, motion/react, Zustand, SVG

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/hooks/use-animated-number.ts` | `useAnimatedNumber` hook with ease-out-cubic |
| Create | `components/sky/dashboard/learning-trend-chart.tsx` | 7-day trend line chart (SVG) |
| Create | `components/sky/dashboard/ability-radar.tsx` | 5-axis ability radar chart (SVG) |
| Modify | `components/sky/dashboard/stat-cards.tsx` | Refactor stat cards, quick actions, timeline |
| Modify | `app/sky/page.tsx` | New page layout orchestrating all components |
| Create | `tests/dashboard/animated-number.test.ts` | Hook unit tests |
| Create | `tests/dashboard/charts.test.tsx` | Chart component snapshot/render tests |

---

### Task 1: `useAnimatedNumber` Hook

**Files:**
- Create: `lib/hooks/use-animated-number.ts`
- Test: `tests/dashboard/animated-number.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/dashboard/animated-number.test.ts
import { renderHook, act } from '@testing-library/react';
import { useAnimatedNumber } from '@/lib/hooks/use-animated-number';
import { vi } from 'vitest';

describe('useAnimatedNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('animates from 0 to target value', () => {
    const { result } = renderHook(() => useAnimatedNumber(42, { duration: 1000 }));
    // At start, value should be 0
    expect(result.current.value).toBe(0);
    // Advance full duration
    act(() => { vi.advanceTimersByTime(1000); });
    // Should reach target (rounded)
    expect(Math.round(result.current.value)).toBe(42);
  });

  it('animates when target changes', () => {
    const { result, rerender } = renderHook(
      ({ target }: { target: number }) => useAnimatedNumber(target, { duration: 1000 }),
      { initialProps: { target: 10 } }
    );
    act(() => { vi.advanceTimersByTime(1000); });
    expect(Math.round(result.current.value)).toBe(10);
    rerender({ target: 25 });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(Math.round(result.current.value)).toBe(25);
  });

  it('returns decimals when specified', () => {
    const { result } = renderHook(() => useAnimatedNumber(78.5, { decimals: 1, duration: 500 }));
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current.value.toFixed(1)).toBe('78.5');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/dashboard/animated-number.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Write the hook implementation**

```typescript
// lib/hooks/use-animated-number.ts
import { useRef, useState, useEffect } from 'react';

interface UseAnimatedNumberOptions {
  duration?: number;
  decimals?: number;
  enabled?: boolean;
}

/**
 * Animates a number from 0 to target using ease-out-cubic easing.
 */
export function useAnimatedNumber(
  target: number,
  { duration = 1200, decimals = 0, enabled = true }: UseAnimatedNumberOptions = {},
) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }

    cancelAnimationFrame(rafRef.current);
    startTimeRef.current = performance.now();
    const startValue = 0;

    function animate(now: number) {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-cubic: 1 - (1 - t)^3
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (target - startValue) * eased;

      setValue(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, enabled]);

  return {
    value: decimals > 0 ? parseFloat(value.toFixed(decimals)) : Math.round(value),
    raw: value,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/dashboard/animated-number.test.ts
```
Expected: PASS — 3 tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/use-animated-number.ts tests/dashboard/animated-number.test.ts
git commit -m "feat: add useAnimatedNumber hook with ease-out-cubic easing"
```

---

### Task 2: Learning Trend Chart Component

**Files:**
- Create: `components/sky/dashboard/learning-trend-chart.tsx`
- Test: `tests/dashboard/charts.test.tsx` (create file, add first test here)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/dashboard/charts.test.tsx
import { render, screen } from '@testing-library/react';
import { LearningTrendChart } from '@/components/sky/dashboard/learning-trend-chart';
import { describe, it, expect } from 'vitest';

describe('LearningTrendChart', () => {
  const mockData = [
    { day: '周一', count: 3 },
    { day: '周二', count: 5 },
    { day: '周三', count: 2 },
    { day: '周四', count: 8 },
    { day: '周五', count: 4 },
    { day: '周六', count: 6 },
    { day: '周日', count: 1 },
  ];

  it('renders chart title and axis labels', () => {
    render(<LearningTrendChart data={mockData} />);
    expect(screen.getByText('近7天学习趋势')).toBeInTheDocument();
    expect(screen.getByText('周日')).toBeInTheDocument();
  });

  it('shows correct max count on Y axis', () => {
    render(<LearningTrendChart data={mockData} />);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders empty state when no data', () => {
    render(<LearningTrendChart data={[]} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/dashboard/charts.test.tsx
```
Expected: FAIL — module not found

- [ ] **Step 3: Write the chart component**

```typescript
// components/sky/dashboard/learning-trend-chart.tsx
'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { useAnimatedNumber } from '@/lib/hooks/use-animated-number';

interface DayData {
  day: string;
  count: number;
}

interface LearningTrendChartProps {
  data: DayData[];
}

const CHART = { width: 480, height: 220, padL: 45, padR: 15, padT: 20, padB: 35 };

function buildPoints(data: DayData[]) {
  const { width: W, height: H, padL, padR, padT, padB } = CHART;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW / 2;

  return data.map((d, i) => ({
    x: padL + i * stepX,
    y: padT + chartH - (d.count / maxVal) * chartH,
    ...d,
  }));
}

function GridLines({ maxVal }: { maxVal: number }) {
  const { padL, padT, padB, width: W, padR } = CHART;
  const chartH = CHART.height - padT - padB;
  const lines = 4;
  return (
    <>
      {Array.from({ length: lines + 1 }).map((_, i) => {
        const y = padT + (i / lines) * chartH;
        const val = Math.round(maxVal - (i / lines) * maxVal);
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#334155" strokeWidth={0.5} strokeDasharray="4,4" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize={10}>
              {val}
            </text>
          </g>
        );
      })}
    </>
  );
}

function Tooltip({ x, y, count, day }: { x: number; y: number; count: number; day: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={10} fill="#8B5CF6" fillOpacity={0.2} />
      <circle cx={x} cy={y} r={4} fill="#8B5CF6" />
      <rect x={x - 25} y={y - 30} width={50} height={22} rx={6} fill="#1e293b" stroke="#475569" />
      <text x={x} y={y - 15} textAnchor="middle" fill="#e2e8f0" fontSize={11} fontWeight={600}>
        {count} 题 · {day}
      </text>
    </g>
  );
}

export function LearningTrendChart({ data }: LearningTrendChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const points = useMemo(() => buildPoints(data), [data]);
  const maxVal = useMemo(() => Math.max(...data.map((d) => d.count), 1), [data]);
  const total = useAnimatedNumber(data.reduce((s, d) => s + d.count, 0), { duration: 1500 });

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
        <p className="text-slate-500">暂无数据</p>
      </div>
    );
  }

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x},${CHART.padT + CHART.height - CHART.padT - CHART.padB} L${points[0].x},${CHART.padT + CHART.height - CHART.padT - CHART.padB} Z`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-slate-200">近7天学习趋势</h3>
        </div>
        <span className="text-xs text-slate-400">共 <span className="text-cyan-400 font-bold">{Math.round(total.value)}</span> 题</span>
      </div>

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="w-full h-auto" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <GridLines maxVal={maxVal} />

        {/* X axis labels */}
        {points.map((p, i) => (
          <text key={i} x={p.x} y={CHART.height - 6} textAnchor="middle" fill="#64748b" fontSize={10}>
            {p.day}
          </text>
        ))}

        {/* Area fill */}
        <motion.path
          d={areaD}
          fill="url(#areaGrad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        />

        {/* Line */}
        <motion.path
          d={pathD}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          style={{ pathLength: 1 }}
        />

        {/* Data dots */}
        {points.map((p, i) => (
          <g
            key={i}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
            className="cursor-pointer"
          >
            <circle cx={p.x} cy={p.y} r={14} fill="transparent" />
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={4}
              fill="#8B5CF6"
              stroke="#1e293b"
              strokeWidth={2}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            />
            {hoverIdx === i && <Tooltip x={p.x} y={p.y} count={p.count} day={p.day} />}
          </g>
        ))}
      </svg>
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/dashboard/charts.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/sky/dashboard/learning-trend-chart.tsx tests/dashboard/charts.test.tsx
git commit -m "feat: add LearningTrendChart SVG component with pathLength animation"
```

---

### Task 3: Ability Radar Chart Component

**Files:**
- Create: `components/sky/dashboard/ability-radar.tsx`

- [ ] **Step 1: Write the test (add to existing charts.test.tsx)**

```typescript
// Append to tests/dashboard/charts.test.tsx
import { AbilityRadar } from '@/components/sky/dashboard/ability-radar';

describe('AbilityRadar', () => {
  const mockData = [
    { name: '代数', value: 75 },
    { name: '几何', value: 60 },
    { name: '函数', value: 80 },
    { name: '概率', value: 45 },
    { name: '统计', value: 70 },
  ];

  it('renders all 5 dimension labels', () => {
    render(<AbilityRadar data={mockData} />);
    for (const dim of mockData) {
      expect(screen.getByText(dim.name)).toBeInTheDocument();
    }
  });

  it('renders title', () => {
    render(<AbilityRadar data={mockData} />);
    expect(screen.getByText('能力雷达图')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/dashboard/charts.test.tsx
```
Expected: FAIL — `AbilityRadar` not found

- [ ] **Step 3: Write the radar component**

```typescript
// components/sky/dashboard/ability-radar.tsx
'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Brain } from 'lucide-react';

interface RadarDimension {
  name: string;
  value: number; // 0-100
}

interface AbilityRadarProps {
  data: RadarDimension[];
}

const CX = 140, CY = 130, R = 90; // center x, center y, max radius
const LEVELS = 4;

/** Generate polygon points for n vertices at given radius ratio */
function polygonPoints(n: number, ratio: number, cx = CX, cy = CY, r = R) {
  return Array.from({ length: n }).map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return {
      x: cx + r * ratio * Math.cos(angle),
      y: cy + r * ratio * Math.sin(angle),
    };
  });
}

function pointsToAttr(pts: { x: number; y: number }[]) {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

export function AbilityRadar({ data }: AbilityRadarProps) {
  const n = data.length;
  const gridLevels = useMemo(() =>
    Array.from({ length: LEVELS }).map((_, i) => ({
      ratio: (i + 1) / LEVELS,
      points: polygonPoints(n, (i + 1) / LEVELS),
    })), [n]);

  const valuePoints = useMemo(() =>
    data.map((d) => ({
      x: CX + R * (d.value / 100) * Math.cos((Math.PI * 2 * data.indexOf(d)) / n - Math.PI / 2),
      y: CY + R * (d.value / 100) * Math.sin((Math.PI * 2 * data.indexOf(d)) / n - Math.PI / 2),
    })), [data, n]);

  const labelPoints = useMemo(() =>
    polygonPoints(n, 1.18), [n]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Brain className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-slate-200">能力雷达图</h3>
      </div>

      {/* SVG Radar */}
      <svg viewBox="0 0 280 260" className="w-full h-auto" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="radarGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.4} />
          </linearGradient>
        </defs>

        {/* Grid levels */}
        {gridLevels.map((level, i) => (
          <motion.polygon
            key={i}
            points={pointsToAttr(level.points)}
            fill="none"
            stroke={i === LEVELS - 1 ? '#475569' : '#334155'}
            strokeWidth={i === LEVELS - 1 ? 1 : 0.5}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
          />
        ))}

        {/* Axis lines */}
        {polygonPoints(n, 1).map((p, i) => (
          <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#334155" strokeWidth={0.5} />
        ))}

        {/* Data area */}
        <motion.polygon
          points={pointsToAttr(valuePoints)}
          fill="url(#radarGrad)"
          stroke="#8B5CF6"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6, type: 'spring', stiffness: 120 }}
        />

        {/* Data dots */}
        {valuePoints.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="#8B5CF6"
            stroke="#1e293b"
            strokeWidth={1.5}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5 + i * 0.08 }}
          />
        ))}

        {/* Labels */}
        {labelPoints.map((p, i) => {
          const anchor = Math.abs(p.x - CX) < 5 ? 'middle' : p.x > CX ? 'start' : 'end';
          return (
            <text
              key={i}
              x={p.x}
              y={p.y + 4}
              textAnchor={anchor}
              fill="#94a3b8"
              fontSize={11}
              fontWeight={500}
            >
              {data[i].name}
            </text>
          );
        })}
      </svg>
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/dashboard/charts.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/sky/dashboard/ability-radar.tsx tests/dashboard/charts.test.tsx
git commit -m "feat: add AbilityRadar SVG component with 5-axis spring animation"
```

---

### Task 4: Refactor StatCards with Animations & Dark Theme

**Files:**
- Modify: `components/sky/dashboard/stat-cards.tsx`

The entire file will be rewritten. Current file has 3 exports: `StatCards`, `QuickActions`, `ActivityTimeline`.

- [ ] **Step 1: Write tests (add to charts.test.tsx)**

```typescript
// Append to tests/dashboard/charts.test.tsx
import { StatCards, QuickActions, ActivityTimeline } from '@/components/sky/dashboard/stat-cards';
import type { MistakeRecord } from '@/lib/mistakes/types';

const demoMistakes: MistakeRecord[] = [
  {
    id: 't1', problem: 'test', userAnswer: 'a', correctAnswer: 'b',
    cause: 'calculation-error', solvedAt: new Date(), reviewed: false,
    reviewCount: 0, knowledgePoints: ['代数'],
  },
];

describe('StatCards', () => {
  it('renders 3 stat cards', () => {
    render(<StatCards mistakes={demoMistakes} />);
    expect(screen.getByText('今日搜题')).toBeInTheDocument();
    expect(screen.getByText('错题待复习')).toBeInTheDocument();
    expect(screen.getByText('知识掌握度')).toBeInTheDocument();
  });
});

describe('QuickActions', () => {
  it('renders 4 action buttons', () => {
    render(<QuickActions />);
    expect(screen.getByText('拍照搜题')).toBeInTheDocument();
    expect(screen.getByText('幻灯片讲解')).toBeInTheDocument();
    expect(screen.getByText('学习数据')).toBeInTheDocument();
    expect(screen.getByText('AI 助手')).toBeInTheDocument();
  });
});

describe('ActivityTimeline', () => {
  it('shows empty state with no mistakes', () => {
    render(<ActivityTimeline mistakes={[]} />);
    expect(screen.getByText('还没有学习活动，去搜题页开始练习吧！')).toBeInTheDocument();
  });

  it('shows recent mistakes', () => {
    render(<ActivityTimeline mistakes={demoMistakes} />);
    expect(screen.getByText('test')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/dashboard/charts.test.tsx
```
Expected: FAIL — old StatCards doesn't have dark theme elements

- [ ] **Step 3: Rewrite stat-cards.tsx**

Replace the entire file content with:

```typescript
// components/sky/dashboard/stat-cards.tsx
'use client';

import Link from 'next/link';
import type { MistakeRecord } from '@/lib/mistakes/types';
import { useAnimatedNumber } from '@/lib/hooks/use-animated-number';
import { motion } from 'motion/react';
import { Search, BookOpen, BarChart3, Sparkles, Clock } from 'lucide-react';

// ── Cause label map ─────────────────────────────────────────────────

const causeLabels: Record<string, string> = {
  'concept-unclear': '概念不清',
  'calculation-error': '计算失误',
  'misreading': '审题错误',
  'method-wrong': '方法错误',
  'careless': '粗心',
  'format-error': '格式错误',
};

const causeColors: Record<string, string> = {
  'concept-unclear': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'calculation-error': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'misreading': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'method-wrong': 'bg-red-500/20 text-red-400 border-red-500/30',
  'careless': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'format-error': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

// ── Relative time helper ────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMin = Math.floor(diffMs / 1000 / 60);
  const diffHour = Math.floor(diffMs / 1000 / 60 / 60);
  const diffDay = Math.floor(diffMs / 1000 / 60 / 60 / 24);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  return `${Math.floor(diffDay / 30)}个月前`;
}

// ── RingProgress SVG ────────────────────────────────────────────────

function RingProgress({ percent, size = 48, color = '#8B5CF6' }: { percent: number; size?: number; color?: string }) {
  const r = 18;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#334155" strokeWidth={3} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - (percent / 100) * circumference }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ── StatCards ───────────────────────────────────────────────────────

function isToday(date: Date): boolean {
  const d = new Date(date);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

interface StatCardsProps {
  mistakes: MistakeRecord[];
}

export function StatCards({ mistakes }: StatCardsProps) {
  const todayCount = mistakes.filter((m) => isToday(m.solvedAt)).length;
  const toReviewCount = mistakes.filter((m) => !m.reviewed).length;
  const reviewedCount = mistakes.filter((m) => m.reviewed).length;
  const masteryPercent = mistakes.length > 0 ? Math.round((reviewedCount / mistakes.length) * 100) : 0;

  const animToday = useAnimatedNumber(todayCount, { duration: 1200 });
  const animReview = useAnimatedNumber(toReviewCount, { duration: 1200 });
  const animMastery = useAnimatedNumber(masteryPercent, { duration: 1500 });

  const cards = [
    {
      label: '今日搜题',
      value: Math.round(animToday.value),
      color: '#8B5CF6',
      gradient: 'from-violet-500/20 to-purple-500/20',
      icon: <Search className="w-5 h-5 text-violet-400" />,
      ringPercent: Math.min(todayCount, 100),
      pulse: todayCount > 0,
    },
    {
      label: '错题待复习',
      value: Math.round(animReview.value),
      color: '#F59E0B',
      gradient: 'from-amber-500/20 to-orange-500/20',
      icon: <BookOpen className="w-5 h-5 text-amber-400" />,
      barPercent: mistakes.length > 0 ? Math.round((toReviewCount / mistakes.length) * 100) : 0,
    },
    {
      label: '知识掌握度',
      value: Math.round(animMastery.value),
      suffix: '%',
      color: '#10B981',
      gradient: 'from-emerald-500/20 to-green-500/20',
      icon: <BarChart3 className="w-5 h-5 text-emerald-400" />,
      ringPercent: masteryPercent,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
          whileHover={{ scale: 1.02 }}
          className="group relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5 backdrop-blur-sm transition-shadow hover:shadow-lg hover:shadow-violet-500/10"
        >
          {/* Glow on hover */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none"
            style={{ backgroundImage: `linear-gradient(135deg, ${card.color}15, transparent)` }} />

          <div className="flex items-start justify-between">
            <div>
              <div className="text-3xl font-bold text-slate-100">
                {card.value}{card.suffix || ''}
              </div>
              <div className="mt-1 text-sm text-slate-400">{card.label}</div>
            </div>
            <div className="flex flex-col items-center gap-2">
              {card.pulse && (
                <motion.div
                  className="w-2 h-2 rounded-full bg-violet-400"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              <RingProgress percent={card.ringPercent} color={card.color} />
            </div>
          </div>

          {/* Progress bar for review card */}
          {'barPercent' in card && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                initial={{ width: 0 }}
                animate={{ width: `${card.barPercent}%` }}
                transition={{ duration: 1.2, delay: 0.3 }}
              />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ── QuickActions ────────────────────────────────────────────────────

const actions = [
  { icon: Search, label: '拍照搜题', href: '/sky/solve', color: 'text-violet-400', bg: 'bg-violet-500/10 hover:bg-violet-500/20' },
  { icon: BookOpen, label: '幻灯片讲解', href: '/sky/slides', color: 'text-cyan-400', bg: 'bg-cyan-500/10 hover:bg-cyan-500/20' },
  { icon: BarChart3, label: '学习数据', href: '/sky/learning', color: 'text-emerald-400', bg: 'bg-emerald-500/10 hover:bg-emerald-500/20' },
  { icon: Sparkles, label: 'AI 助手', href: '/sky/assistant', color: 'text-amber-400', bg: 'bg-amber-500/10 hover:bg-amber-500/20' },
];

export function QuickActions() {
  return (
    <div className="flex gap-3">
      {actions.map((action, i) => (
        <motion.div
          key={action.label}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.08 }}
        >
          <Link
            href={action.href}
            className={`flex items-center gap-3 rounded-xl border border-slate-700/50 px-4 py-3 ${action.bg} backdrop-blur-sm transition-all hover:scale-[1.03] hover:border-slate-600/50`}
          >
            <action.icon className={`w-5 h-5 ${action.color}`} />
            <span className="text-sm font-medium text-slate-300">{action.label}</span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}

// ── ActivityTimeline ────────────────────────────────────────────────

interface ActivityTimelineProps {
  mistakes: MistakeRecord[];
}

export function ActivityTimeline({ mistakes }: ActivityTimelineProps) {
  const recentMistakes = [...mistakes]
    .sort((a, b) => new Date(b.solvedAt).getTime() - new Date(a.solvedAt).getTime())
    .slice(0, 5);

  if (recentMistakes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center rounded-2xl border border-slate-700/50 bg-slate-900/50 p-8 backdrop-blur-sm"
      >
        <Sparkles className="w-8 h-8 text-slate-600 mb-3" />
        <p className="text-slate-500 text-sm">还没有学习活动，去搜题页开始练习吧！</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5 backdrop-blur-sm"
    >
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Clock className="w-4 h-4 text-slate-400" />
        最近活动
      </h3>
      <ul className="space-y-3">
        {recentMistakes.map((m, i) => (
          <motion.li
            key={m.id}
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.08 }}
            className="flex items-center gap-3 text-sm"
          >
            {/* Timeline dot + line */}
            <div className="relative flex flex-col items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-violet-500 ring-4 ring-violet-500/20" />
              {i < recentMistakes.length - 1 && <div className="w-px h-6 bg-slate-700" />}
            </div>

            <span className="shrink-0 w-16 text-right text-xs text-slate-500">
              {formatRelativeTime(m.solvedAt)}
            </span>
            <span className="flex-1 truncate text-slate-300">
              {m.problem.length > 60 ? m.problem.slice(0, 60) + '...' : m.problem}
            </span>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${causeColors[m.cause] ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
              {causeLabels[m.cause] ?? m.cause}
            </span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/dashboard/charts.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/sky/dashboard/stat-cards.tsx tests/dashboard/charts.test.tsx
git commit -m "feat: redesign stat cards with dark theme, animated numbers, ring progress"
```

---

### Task 5: Refactor Page Layout + Trend Data + Radar Data

**Files:**
- Modify: `app/sky/page.tsx`

- [ ] **Step 1: Verify no existing tests reference the page (no test needed, this is a layout wiring change)**

- [ ] **Step 2: Rewrite the page**

Replace entire file content:

```typescript
// app/sky/page.tsx
'use client';

import { useMemo, useEffect } from 'react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { StatCards, QuickActions, ActivityTimeline } from '@/components/sky/dashboard/stat-cards';
import { LearningTrendChart } from '@/components/sky/dashboard/learning-trend-chart';
import { AbilityRadar } from '@/components/sky/dashboard/ability-radar';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { buildKnowledgeGraph, getMasterySummary } from '@/lib/mistakes/knowledge-graph';
import { syncMistakesFromQuizzes } from '@/lib/mistakes/bridge';
import type { MistakeRecord } from '@/lib/mistakes/types';

const DEMO_MISTAKES: MistakeRecord[] = [
  {
    id: 'demo-1',
    problem: '解方程：2x + 5 = 13，求 x 的值。',
    userAnswer: 'x = 3',
    correctAnswer: 'x = 4',
    cause: 'calculation-error',
    solvedAt: new Date(Date.now() - 3600000),
    reviewed: false,
    reviewCount: 0,
    knowledgePoints: ['代数', '一元一次方程'],
  },
  {
    id: 'demo-2',
    problem: '若 sin A = 3/5，且 A 为锐角，求 cos A。',
    userAnswer: 'cos A = 3/5',
    correctAnswer: 'cos A = 4/5',
    cause: 'concept-unclear',
    solvedAt: new Date(Date.now() - 7200000),
    reviewed: false,
    reviewCount: 0,
    knowledgePoints: ['几何', '三角函数'],
  },
  {
    id: 'demo-3',
    problem: '下列选项中，哪一个是二次函数 y = x² - 4x + 3 的对称轴？',
    userAnswer: 'x = 1',
    correctAnswer: 'x = 2',
    cause: 'method-wrong',
    solvedAt: new Date(Date.now() - 86400000),
    reviewed: true,
    reviewCount: 1,
    knowledgePoints: ['代数', '二次函数'],
  },
  {
    id: 'demo-4',
    problem: '一个物体从 20 米高处自由落下，求落地时的速度。（g=10m/s²）',
    userAnswer: '10 m/s',
    correctAnswer: '20 m/s',
    cause: 'misreading',
    solvedAt: new Date(Date.now() - 172800000),
    reviewed: false,
    reviewCount: 0,
    knowledgePoints: ['物理', '自由落体'],
  },
  {
    id: 'demo-5',
    problem: '计算：(a + b)² 的展开式。',
    userAnswer: 'a² + b²',
    correctAnswer: 'a² + 2ab + b²',
    cause: 'careless',
    solvedAt: new Date(Date.now() - 259200000),
    reviewed: true,
    reviewCount: 3,
    knowledgePoints: ['代数', '乘法公式'],
  },
];

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return '早上好，同学！';
  if (hour >= 12 && hour < 18) return '下午好，同学！';
  if (hour >= 18 && hour < 22) return '晚上好，同学！';
  return '夜深了，注意休息！';
}

export default function SkyDashboardPage() {
  const mistakes = useSkyClassroomStore((s) => s.mistakes);

  useEffect(() => {
    const store = useSkyClassroomStore.getState();
    if (store.mistakes.length === 0) {
      DEMO_MISTAKES.forEach((m) => store.addMistake(m));
    }
    syncMistakesFromQuizzes();
  }, []);

  const greeting = getGreeting();
  const now = new Date();

  // Build 7-day trend data from mistakes
  const trendData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return { date: d, day: DAY_NAMES[d.getDay()], count: 0 };
    });
    for (const m of mistakes) {
      const mDate = new Date(m.solvedAt);
      const diffDays = Math.floor((now.getTime() - mDate.getTime()) / 86400000);
      if (diffDays >= 0 && diffDays < 7) {
        days[6 - diffDays].count++;
      }
    }
    return days;
  }, [mistakes]);

  // Build radar data from knowledge graph
  const radarData = useMemo(() => {
    if (mistakes.length === 0) {
      return [
        { name: '代数', value: 0 },
        { name: '几何', value: 0 },
        { name: '函数', value: 0 },
        { name: '概率', value: 0 },
        { name: '统计', value: 0 },
      ];
    }
    const graph = buildKnowledgeGraph(mistakes);
    const summary = getMasterySummary(graph);
    const categoryMastery = new Map<string, { total: number; count: number }>();
    for (const node of graph.nodes) {
      const existing = categoryMastery.get(node.category) ?? { total: 0, count: 0 };
      existing.total += node.mastery;
      existing.count++;
      categoryMastery.set(node.category, existing);
    }
    const dimensions = ['代数', '几何', '函数', '概率', '统计'];
    return dimensions.map((name) => {
      const cat = categoryMastery.get(name);
      return { name, value: cat ? Math.round(cat.total / cat.count) : 0 };
    });
  }, [mistakes]);

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-100">{greeting}</h2>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            学习进行中
          </div>
        </div>

        {/* Stat Cards */}
        <StatCards mistakes={mistakes} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LearningTrendChart data={trendData} />
          <AbilityRadar data={radarData} />
        </div>

        {/* Quick Actions */}
        <QuickActions />

        {/* Activity Timeline */}
        <ActivityTimeline mistakes={mistakes} />
      </div>
    </SkyAppShell>
  );
}
```

Note: need to import `useEffect` — already imported at top.

- [ ] **Step 3: Type-check the page**

```bash
npx tsc --noEmit --pretty 2>&1 | head -30
```
Expected: No errors in `app/sky/page.tsx`

- [ ] **Step 4: Commit**

```bash
git add app/sky/page.tsx
git commit -m "feat: wire up new dashboard layout with trend + radar charts"
```

---

### Task 6: Dark Theme Shell + Run Dev Server Verification

**Files:**
- Modify: `components/sky/layout/app-shell.tsx`

The app shell background needs to change from `bg-[#F8FAFC]` (light) to dark gradient.

- [ ] **Step 1: Change app shell background**

Edit `components/sky/layout/app-shell.tsx` line 36:
Change:
```
<div className="flex h-screen w-full flex-col bg-[#F8FAFC]">
```
To:
```
<div className="flex h-screen w-full flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
```

Also update header to match dark theme — change line 37:
```
<header className="grid h-14 shrink-0 grid-cols-3 items-center border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm px-4">
```

- [ ] **Step 2: Update header text colors for dark theme**

Edit the header children text colors:
- Line 41: `<h1 className="text-lg font-bold text-[#8B5CF6]">` — keep as is
- Tab bar items — the tab bar already handles its own colors, but update line 187 avatar ring: change `bg-[#8B5CF6]/20` to `bg-violet-500/20` and text to `text-violet-400`

- [ ] **Step 3: Start dev server and verify**

```bash
pnpm dev
```

Open browser at `http://localhost:3000/sky` and verify:
1. Dark gradient background is visible
2. 3 stat cards show with animated numbers (pulse dot on today count if > 0)
3. Trend line chart renders with gradient line, area fill, and hover tooltips
4. Radar chart renders with 5 dimensions and spring animation
5. Quick actions display as horizontal row with colored icons
6. Activity timeline shows with colored dots and error type badges
7. All cards have hover scale effect
8. Header is dark themed

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run --reporter=verbose
```

Expected: All tests pass

- [ ] **Step 5: Final commit**

```bash
git add components/sky/layout/app-shell.tsx
git commit -m "feat: apply dark theme to app shell header and background"
```

---

## Task Summary

| # | Component | Files | Key Deliverable |
|---|-----------|-------|-----------------|
| 1 | Hook | `lib/hooks/use-animated-number.ts` | `useAnimatedNumber` with ease-out-cubic |
| 2 | Trend Chart | `learning-trend-chart.tsx` | SVG line chart with pathLength animation |
| 3 | Radar Chart | `ability-radar.tsx` | SVG 5-axis radar with spring animation |
| 4 | Stat Cards | `stat-cards.tsx` | Dark themed cards + RingProgress + timeline |
| 5 | Page Layout | `app/sky/page.tsx` | Orchestration + trend/radar data builders |
| 6 | Shell Theme | `app-shell.tsx` | Dark gradient background + header |
