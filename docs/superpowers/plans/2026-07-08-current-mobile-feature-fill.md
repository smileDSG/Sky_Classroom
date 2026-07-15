# Current Mobile Feature Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the newest web learning features into the existing `/m/sky/*` mobile app without replacing the current mobile shell or visual direction.

**Architecture:** Keep `components/mobile/mobile-sky-shell.tsx` and `MobileQuickEntranceNav` as the active mobile foundation. Add native first-pass mobile pages for missing high-frequency student flows, while keeping `MobileSkyFrame` only for advanced editor/detail fallbacks. Use existing APIs and stores instead of inventing new backend contracts.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, lucide-react, Vitest, React Testing Library.

---

## Scope

This plan implements Phase 1 from the spec and prepares Phase 2 test seams:

- Add mobile memory cards route.
- Add mobile course studio entry route.
- Replace review plan iframe with a native task list.
- Update the existing mobile cloud mind tool shelf to expose current tools.
- Add tests that protect the current mobile shell and `/m/*` routing.

It does not redesign the desktop web pages, replace the current mobile shell, or remove every `MobileSkyFrame` usage.

## File Map

- Modify: `app/m/sky/cloud-mind/page.tsx`
  - Responsibility: current mobile AI tool shelf. Add missing tool cards while preserving the existing dark-card style.
- Create: `app/m/sky/cloud-mind/memory/page.tsx`
  - Responsibility: mobile memory-card generator and study view.
- Create: `app/m/sky/cloud-mind/course-studio/page.tsx`
  - Responsibility: mobile entry/start page for course studio, with advanced fallback link.
- Replace: `app/m/sky/learning/review/plan/page.tsx`
  - Responsibility: native daily review task list using workshop data.
- Create: `tests/sky/mobile-cloud-mind-tools.test.tsx`
  - Responsibility: route coverage for cloud mind cards.
- Create: `tests/sky/mobile-memory-page.test.tsx`
  - Responsibility: memory mobile generator and generated-card study behavior.
- Create: `tests/sky/mobile-review-plan.test.tsx`
  - Responsibility: native review plan loading, task rendering, and empty state.
- Create: `tests/sky/mobile-course-studio-entry.test.tsx`
  - Responsibility: course studio mobile entry controls and fallback route.

## Shared Implementation Notes

- Follow existing tests that mock `next/link` by returning an `<a href>`.
- Keep existing Chinese UI vocabulary from nearby mobile pages.
- Use `/m/*` links for all mobile navigation.
- Keep `MobileSkyShell` imported from `@/components/mobile/mobile-sky-shell`.
- Keep `MobileQuickEntranceNav` imported from `@/components/mobile/mobile-quick-entrance-nav`.
- Do not import `components/mobile/shell/*` in this effort.

---

### Task 1: Protect Cloud Mind Tool Coverage

**Files:**
- Create: `tests/sky/mobile-cloud-mind-tools.test.tsx`
- Modify later: `app/m/sky/cloud-mind/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/sky/mobile-cloud-mind-tools.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MobileCloudMindPage from '@/app/m/sky/cloud-mind/page';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

describe('MobileCloudMindPage tool shelf', () => {
  it('keeps the current mobile shell and exposes current student tools', () => {
    render(<MobileCloudMindPage />);

    const expectedRoutes = [
      '/m/sky/cloud-mind/solve',
      '/m/sky/cloud-mind/slides',
      '/m/sky/cloud-mind/quiz',
      '/m/sky/cloud-mind/memory',
      '/m/sky/cloud-mind/teaching',
      '/m/sky/cloud-mind/course-studio',
    ];

    for (const href of expectedRoutes) {
      expect(screen.getByRole('link', { name: (_name, element) => element?.getAttribute('href') === href })).toHaveAttribute(
        'href',
        href,
      );
    }
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).not.toContain('/m/sky/question-bank');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
E:\01_Work\sky-classroom\node_modules\.bin\vitest.cmd run tests/sky/mobile-cloud-mind-tools.test.tsx
```

Expected: FAIL because `/m/sky/cloud-mind/course-studio` is not yet present in the tool shelf, or because the shelf still contains the disallowed `/m/sky/question-bank` route.

- [ ] **Step 3: Update the cloud mind tool list**

Modify the `tools` array in `app/m/sky/cloud-mind/page.tsx` to include the missing entries. Keep the current object shape.

Add imports if missing:

```tsx
import {
  BookOpen,
  Brain,
  Camera,
  FileQuestion,
  Presentation,
  Route,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
```

Use this full tool list:

```tsx
const tools: Array<{
  label: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  color: string;
  badge?: string;
}> = [
  {
    label: '拍照搜题',
    desc: '拍照识别题目',
    href: '/m/sky/cloud-mind/solve',
    icon: Camera,
    color: 'from-violet-500 to-purple-600',
    badge: '热门',
  },
  {
    label: 'PPT课件',
    desc: '一键生成课件',
    href: '/m/sky/cloud-mind/slides',
    icon: Presentation,
    color: 'from-cyan-500 to-blue-600',
    badge: '推荐',
  },
  {
    label: '智能出题',
    desc: '定制练习题',
    href: '/m/sky/cloud-mind/quiz',
    icon: FileQuestion,
    color: 'from-amber-500 to-orange-500',
    badge: '新',
  },
  {
    label: '记忆卡片',
    desc: '生成复习卡',
    href: '/m/sky/cloud-mind/memory',
    icon: Brain,
    color: 'from-rose-500 to-pink-600',
  },
  {
    label: '智能授课',
    desc: '生成教学方案',
    href: '/m/sky/cloud-mind/teaching',
    icon: BookOpen,
    color: 'from-emerald-500 to-teal-600',
  },
  {
    label: '课程工作室',
    desc: '生成个性资源',
    href: '/m/sky/cloud-mind/course-studio',
    icon: Route,
    color: 'from-sky-500 to-indigo-600',
  },
];
```

The existing grid can stay as-is. Do not add question bank to this cloud mind shelf; question bank remains outside the primary AI tools entry.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
E:\01_Work\sky-classroom\node_modules\.bin\vitest.cmd run tests/sky/mobile-cloud-mind-tools.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/m/sky/cloud-mind/page.tsx tests/sky/mobile-cloud-mind-tools.test.tsx
git commit -m "feat: expose current mobile cloud mind tools"
```

---

### Task 2: Add Mobile Memory Cards Page

**Files:**
- Create: `tests/sky/mobile-memory-page.test.tsx`
- Create: `app/m/sky/cloud-mind/memory/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/sky/mobile-memory-page.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileMemoryPage from '@/app/m/sky/cloud-mind/memory/page';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

vi.mock('next/navigation', () => ({
  useSearchParams: () =>
    new URLSearchParams('topic=函数&content=函数单调性错题整理'),
}));

describe('MobileMemoryPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          weakPoints: [{ knowledgePoint: '函数' }, { knowledgePoint: '导数' }],
          dueReviews: [],
          learningPath: { next: '函数' },
        },
      }),
    });
    global.fetch = mockFetch;
  });

  it('renders a mobile generator prefilled from params and weak point chips', async () => {
    render(<MobileMemoryPage />);

    expect(screen.getByRole('heading', { name: '记忆卡片' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('函数')).toBeInTheDocument();
    expect(screen.getByDisplayValue('函数单调性错题整理')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/cloud-mind/personalization-context', {
        credentials: 'include',
      });
    });

    expect(await screen.findByRole('button', { name: '函数' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导数' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /高级模式/ })).toHaveAttribute(
      'href',
      '/sky/cloud-mind/memory?topic=%E5%87%BD%E6%95%B0&content=%E5%87%BD%E6%95%B0%E5%8D%95%E8%B0%83%E6%80%A7%E9%94%99%E9%A2%98%E6%95%B4%E7%90%86',
    );
  });

  it('shows a local study preview after generating demo cards', async () => {
    render(<MobileMemoryPage />);

    fireEvent.click(screen.getByRole('button', { name: /生成复习卡/ }));

    expect(await screen.findByText('函数')).toBeInTheDocument();
    expect(screen.getByText('点击卡片查看答案')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('翻转记忆卡片'));
    expect(screen.getByText(/函数单调性错题整理/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '还不会' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '模糊' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '掌握了' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
E:\01_Work\sky-classroom\node_modules\.bin\vitest.cmd run tests/sky/mobile-memory-page.test.tsx
```

Expected: FAIL because `app/m/sky/cloud-mind/memory/page.tsx` does not exist.

- [ ] **Step 3: Create the mobile memory page**

Create `app/m/sky/cloud-mind/memory/page.tsx`:

```tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Brain, CheckCircle2, RotateCcw, Sparkles } from 'lucide-react';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { cn } from '@/lib/utils';

interface WeakPoint {
  knowledgePoint: string;
}

interface PersonalizationPayload {
  weakPoints?: WeakPoint[];
  dueReviews?: Array<{ title?: string; knowledgePoints?: string[] }>;
  learningPath?: { next?: string };
}

interface MemoryCard {
  id: string;
  front: string;
  back: string;
}

export default function MobileMemoryPage() {
  return (
    <Suspense
      fallback={
        <MobileSkyShell>
          <div className="px-4 py-6 text-sm font-semibold text-slate-400">加载记忆卡片...</div>
        </MobileSkyShell>
      }
    >
      <MobileMemoryContent />
    </Suspense>
  );
}

function MobileMemoryContent() {
  const searchParams = useSearchParams();
  const [topic, setTopic] = useState(searchParams.get('topic') ?? '');
  const [content, setContent] = useState(searchParams.get('content') ?? '');
  const [weakPoints, setWeakPoints] = useState<string[]>([]);
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    fetch('/api/sky/cloud-mind/personalization-context', { credentials: 'include' })
      .then((response) => response.json())
      .then((json: { success?: boolean; data?: PersonalizationPayload }) => {
        if (cancelled) return;
        const points = json.data?.weakPoints?.map((item) => item.knowledgePoint).filter(Boolean) ?? [];
        setWeakPoints(points.slice(0, 5));
        if (!topic && points[0]) setTopic(points[0]);
      })
      .catch(() => {
        if (!cancelled) setWeakPoints([]);
      });

    return () => {
      cancelled = true;
    };
  }, [topic]);

  const advancedHref = useMemo(() => {
    const params = new URLSearchParams();
    if (topic.trim()) params.set('topic', topic.trim());
    if (content.trim()) params.set('content', content.trim());
    const query = params.toString();
    return `/sky/cloud-mind/memory${query ? `?${query}` : ''}`;
  }, [content, topic]);

  const currentCard = cards[currentIndex];

  const generatePreview = () => {
    const safeTopic = topic.trim() || '综合复习';
    const safeContent = content.trim() || `围绕${safeTopic}整理概念、例题和易错点。`;
    setCards([
      {
        id: 'concept',
        front: safeTopic,
        back: `${safeContent}\n\n先说清概念，再用一道错题验证。`,
      },
      {
        id: 'mistake',
        front: `${safeTopic}最容易错在哪里？`,
        back: '先检查题干条件，再写出关键公式，最后回看单位和符号。',
      },
    ]);
    setCurrentIndex(0);
    setFlipped(false);
    setRatings({});
  };

  const rateCurrent = (rating: string) => {
    if (!currentCard) return;
    setRatings((prev) => ({ ...prev, [currentCard.id]: rating }));
    setFlipped(false);
    setCurrentIndex((prev) => Math.min(prev + 1, cards.length - 1));
  };

  return (
    <MobileSkyShell>
      <div className="space-y-3 pb-24">
        <section className="rounded-[22px] border border-rose-200/15 bg-[#0d1728] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <Link href="/m/sky/cloud-mind" className="mb-3 inline-flex items-center gap-1 text-[12px] font-bold text-slate-400">
            <ArrowLeft className="size-3.5" />
            返回 AI 工具
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-rose-500 text-white">
              <Brain className="size-5" />
            </span>
            <div>
              <h1 className="text-[24px] font-extrabold leading-none text-white">记忆卡片</h1>
              <p className="mt-1 text-[12px] font-semibold text-slate-400">把薄弱点变成可以反复复习的闪卡。</p>
            </div>
          </div>
        </section>

        {cards.length === 0 ? (
          <section className="rounded-[20px] border border-white/10 bg-[#0d1728] p-3">
            <label className="block text-[12px] font-extrabold text-slate-300" htmlFor="memory-topic">
              知识点
            </label>
            <input
              id="memory-topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              className="mt-2 h-11 w-full rounded-[13px] border border-white/10 bg-white/[0.055] px-3 text-[14px] font-semibold text-white outline-none focus:border-rose-300/40"
              placeholder="例如：函数单调性"
            />

            {weakPoints.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {weakPoints.map((point) => (
                  <button
                    key={point}
                    type="button"
                    onClick={() => setTopic(point)}
                    className="min-h-9 rounded-full border border-rose-200/15 bg-rose-300/10 px-3 text-[12px] font-bold text-rose-100"
                  >
                    {point}
                  </button>
                ))}
              </div>
            )}

            <label className="mt-4 block text-[12px] font-extrabold text-slate-300" htmlFor="memory-content">
              复习内容
            </label>
            <textarea
              id="memory-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="mt-2 min-h-28 w-full rounded-[13px] border border-white/10 bg-white/[0.055] px-3 py-3 text-[14px] font-semibold leading-6 text-white outline-none focus:border-rose-300/40"
              placeholder="粘贴错题、课堂笔记或想复习的知识点。"
            />

            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                onClick={generatePreview}
                className="flex h-11 items-center justify-center gap-2 rounded-[13px] bg-rose-500 text-[13px] font-extrabold text-white active:bg-rose-400"
              >
                <Sparkles className="size-4" />
                生成复习卡
              </button>
              <Link
                href={advancedHref}
                className="flex h-11 items-center justify-center rounded-[13px] border border-white/10 px-3 text-[12px] font-bold text-slate-300"
              >
                高级模式
              </Link>
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            <button
              type="button"
              aria-label="翻转记忆卡片"
              onClick={() => setFlipped((value) => !value)}
              className="min-h-[260px] w-full rounded-[22px] border border-rose-200/18 bg-[#0d1728] p-5 text-left shadow-[0_18px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]"
            >
              <div className="mb-4 flex items-center justify-between text-[12px] font-bold text-slate-400">
                <span>
                  {currentIndex + 1}/{cards.length}
                </span>
                <span>{flipped ? '答案' : '点击卡片查看答案'}</span>
              </div>
              <div className={cn('whitespace-pre-line text-[22px] font-extrabold leading-8 text-white', flipped && 'text-rose-50')}>
                {flipped ? currentCard.back : currentCard.front}
              </div>
            </button>

            <div className="grid grid-cols-3 gap-2">
              {[
                ['again', '还不会'],
                ['hard', '模糊'],
                ['easy', '掌握了'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => rateCurrent(value)}
                  className="flex h-11 items-center justify-center rounded-[13px] border border-white/10 bg-white/[0.055] text-[12px] font-extrabold text-slate-100"
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-[15px] border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-bold text-slate-400">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="size-3.5" />
                已记录 {Object.keys(ratings).length} 张
              </span>
              <button type="button" onClick={() => setCards([])} className="inline-flex items-center gap-1 text-rose-100">
                <RotateCcw className="size-3.5" />
                重新生成
              </button>
            </div>
          </section>
        )}
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
E:\01_Work\sky-classroom\node_modules\.bin\vitest.cmd run tests/sky/mobile-memory-page.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/m/sky/cloud-mind/memory/page.tsx tests/sky/mobile-memory-page.test.tsx
git commit -m "feat: add mobile memory card flow"
```

---

### Task 3: Replace Review Plan Frame With Native Tasks

**Files:**
- Create: `tests/sky/mobile-review-plan.test.tsx`
- Modify: `app/m/sky/learning/review/plan/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/sky/mobile-review-plan.test.tsx`:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MobileReviewPlanPage from '@/app/m/sky/learning/review/plan/page';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

describe('MobileReviewPlanPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it('renders native review tasks from workshop signals', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        review: { dueCount: 3, overdue: 1, total: 6 },
        profile: {
          weakPoints: ['函数', '导数'],
          masteryByKnowledge: { 函数: 42, 导数: 58 },
        },
        learningStats: { masteryPercent: 61 },
      }),
    });

    render(<MobileReviewPlanPage />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/workshop', {
        credentials: 'include',
        cache: 'no-store',
      });
    });

    expect(await screen.findByRole('heading', { name: '复习计划' })).toBeInTheDocument();
    expect(screen.getByText('3 个到期任务')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /处理到期复习/ })).toHaveAttribute(
      'href',
      '/m/sky/learning/review',
    );
    expect(screen.getByRole('link', { name: /围绕函数练习/ })).toHaveAttribute(
      'href',
      '/m/sky/cloud-mind/quiz?topic=%E5%87%BD%E6%95%B0',
    );
    expect(screen.getByRole('link', { name: /生成记忆卡/ })).toHaveAttribute(
      'href',
      '/m/sky/cloud-mind/memory?topic=%E5%87%BD%E6%95%B0',
    );
  });

  it('renders an empty state when there are no review signals', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        review: { dueCount: 0, overdue: 0, total: 0 },
        profile: { weakPoints: [], masteryByKnowledge: {} },
        learningStats: { masteryPercent: 0 },
      }),
    });

    render(<MobileReviewPlanPage />);

    expect(await screen.findByText('还没有复习任务')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /拍照搜题建立记录/ })).toHaveAttribute(
      'href',
      '/m/sky/cloud-mind/solve',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
E:\01_Work\sky-classroom\node_modules\.bin\vitest.cmd run tests/sky/mobile-review-plan.test.tsx
```

Expected: FAIL because the current page returns `MobileSkyFrame`.

- [ ] **Step 3: Replace the iframe page**

Replace `app/m/sky/learning/review/plan/page.tsx` with:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpenCheck, Brain, CalendarClock, Camera, Target } from 'lucide-react';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';

interface WorkshopSnapshot {
  review?: {
    dueCount?: number;
    overdue?: number;
    total?: number;
  } | null;
  profile?: {
    weakPoints?: string[];
    masteryByKnowledge?: Record<string, number>;
  } | null;
  learningStats?: {
    masteryPercent?: number;
  } | null;
}

interface ReviewTask {
  title: string;
  desc: string;
  href: string;
  icon: typeof CalendarClock;
}

function getFocusTopic(snapshot: WorkshopSnapshot | null) {
  const weak = snapshot?.profile?.weakPoints?.[0];
  if (weak) return weak;
  const lowMastery = Object.entries(snapshot?.profile?.masteryByKnowledge ?? {}).sort(([, a], [, b]) => a - b)[0]?.[0];
  return lowMastery ?? '综合诊断';
}

function buildTasks(snapshot: WorkshopSnapshot | null): ReviewTask[] {
  const dueCount = snapshot?.review?.dueCount ?? 0;
  const topic = getFocusTopic(snapshot);
  const encodedTopic = encodeURIComponent(topic);
  const tasks: ReviewTask[] = [];

  if (dueCount > 0) {
    tasks.push({
      title: '处理到期复习',
      desc: `${dueCount} 个到期任务，先把今天该回看的内容清掉。`,
      href: '/m/sky/learning/review',
      icon: CalendarClock,
    });
  }

  if (topic !== '综合诊断') {
    tasks.push(
      {
        title: `围绕${topic}练习`,
        desc: '用一组同类题确认薄弱点是否补上。',
        href: `/m/sky/cloud-mind/quiz?topic=${encodedTopic}`,
        icon: Target,
      },
      {
        title: '生成记忆卡',
        desc: `把${topic}整理成可反复复习的卡片。`,
        href: `/m/sky/cloud-mind/memory?topic=${encodedTopic}`,
        icon: Brain,
      },
    );
  }

  tasks.push({
    title: '问 AI 助手',
    desc: '把卡住的步骤发给小镜，先梳理思路再做题。',
    href: `/m/sky/assistant?view=chat&q=${encodeURIComponent(`帮我复习${topic}`)}`,
    icon: BookOpenCheck,
  });

  return tasks.slice(0, 5);
}

export default function MobileReviewPlanPage() {
  const [snapshot, setSnapshot] = useState<WorkshopSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/sky/workshop', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) return;
        if (!json?.success) throw new Error(json?.error ?? '复习数据加载失败');
        setSnapshot({
          review: json.review ?? null,
          profile: json.profile ?? null,
          learningStats: json.learningStats ?? null,
        });
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '复习数据加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const tasks = useMemo(() => buildTasks(snapshot), [snapshot]);
  const dueCount = snapshot?.review?.dueCount ?? 0;
  const hasSignals = dueCount > 0 || (snapshot?.profile?.weakPoints?.length ?? 0) > 0;

  return (
    <MobileSkyShell>
      <div className="space-y-3 pb-24">
        <section className="rounded-[22px] border border-amber-200/15 bg-[#0d1728] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <Link href="/m/sky/learning/review" className="mb-3 inline-flex items-center gap-1 text-[12px] font-bold text-slate-400">
            <ArrowLeft className="size-3.5" />
            返回复习
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-amber-500 text-white">
              <CalendarClock className="size-5" />
            </span>
            <div>
              <h1 className="text-[24px] font-extrabold leading-none text-white">复习计划</h1>
              <p className="mt-1 text-[12px] font-semibold text-slate-400">
                {loading ? '正在同步今日任务...' : error ? error : `${dueCount} 个到期任务`}
              </p>
            </div>
          </div>
        </section>

        {!loading && !error && !hasSignals ? (
          <section className="rounded-[20px] border border-white/10 bg-[#0d1728] p-4 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white/[0.06] text-slate-300">
              <Camera className="size-6" />
            </div>
            <h2 className="mt-3 text-[18px] font-extrabold text-white">还没有复习任务</h2>
            <p className="mt-2 text-[12px] font-semibold leading-5 text-slate-400">
              先做一次搜题或练习，系统会根据错题和薄弱点生成复习节奏。
            </p>
            <Link
              href="/m/sky/cloud-mind/solve"
              className="mt-4 flex h-11 items-center justify-center rounded-[13px] bg-amber-500 text-[13px] font-extrabold text-white"
            >
              拍照搜题建立记录
            </Link>
          </section>
        ) : (
          <section aria-label="今日复习任务" className="space-y-2">
            {tasks.map((task, index) => {
              const Icon = task.icon;
              return (
                <Link
                  key={task.href}
                  href={task.href}
                  className="flex min-h-[82px] items-center gap-3 rounded-[18px] border border-white/10 bg-[#0d1728] p-3 active:bg-[#142239]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-amber-400/15 text-amber-100">
                    <Icon className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-black text-slate-500">0{index + 1}</span>
                    <span className="block text-[15px] font-extrabold text-white">{task.title}</span>
                    <span className="mt-1 block text-[12px] font-semibold leading-5 text-slate-400">{task.desc}</span>
                  </span>
                </Link>
              );
            })}
          </section>
        )}
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
E:\01_Work\sky-classroom\node_modules\.bin\vitest.cmd run tests/sky/mobile-review-plan.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/m/sky/learning/review/plan/page.tsx tests/sky/mobile-review-plan.test.tsx
git commit -m "feat: add native mobile review plan"
```

---

### Task 4: Add Mobile Course Studio Entry

**Files:**
- Create: `tests/sky/mobile-course-studio-entry.test.tsx`
- Create: `app/m/sky/cloud-mind/course-studio/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/sky/mobile-course-studio-entry.test.tsx`:

```tsx
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MobileCourseStudioPage from '@/app/m/sky/cloud-mind/course-studio/page';

vi.mock('next/link', async () => {
  const ReactModule = await import('react');

  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

describe('MobileCourseStudioPage', () => {
  it('renders a current-mobile entry page and advanced fallback', () => {
    render(<MobileCourseStudioPage />);

    expect(screen.getByRole('heading', { name: '课程工作室' })).toBeInTheDocument();
    expect(screen.getByText('讲义')).toBeInTheDocument();
    expect(screen.getByText('PPT')).toBeInTheDocument();
    expect(screen.getByText('导图')).toBeInTheDocument();
    expect(screen.queryByText('题库')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('学习目标'), {
      target: { value: '两周内补上 RAG 和过拟合' },
    });

    expect(screen.getByRole('link', { name: /打开完整工作室/ })).toHaveAttribute(
      'href',
      '/sky/cloud-mind/course-studio?goal=%E4%B8%A4%E5%91%A8%E5%86%85%E8%A1%A5%E4%B8%8A%20RAG%20%E5%92%8C%E8%BF%87%E6%8B%9F%E5%90%88&types=markdown_lecture%2Cppt_outline',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
E:\01_Work\sky-classroom\node_modules\.bin\vitest.cmd run tests/sky/mobile-course-studio-entry.test.tsx
```

Expected: FAIL because `app/m/sky/cloud-mind/course-studio/page.tsx` does not exist.

- [ ] **Step 3: Create the mobile course studio entry page**

Create `app/m/sky/cloud-mind/course-studio/page.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Map, Presentation, Route, Sparkles } from 'lucide-react';
import { MobileSkyShell } from '@/components/mobile/mobile-sky-shell';
import { MobileQuickEntranceNav } from '@/components/mobile/mobile-quick-entrance-nav';
import { cn } from '@/lib/utils';

const resourceTypes = [
  { id: 'markdown_lecture', label: '讲义', icon: BookOpen },
  { id: 'ppt_outline', label: 'PPT', icon: Presentation },
  { id: 'mind_map', label: '导图', icon: Map },
];

export default function MobileCourseStudioPage() {
  const [goal, setGoal] = useState('两周内补上 RAG 和过拟合');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['markdown_lecture', 'ppt_outline']);

  const advancedHref = useMemo(() => {
    const params = new URLSearchParams();
    if (goal.trim()) params.set('goal', goal.trim());
    if (selectedTypes.length > 0) params.set('types', selectedTypes.join(','));
    const query = params.toString();
    return `/sky/cloud-mind/course-studio${query ? `?${query}` : ''}`;
  }, [goal, selectedTypes]);

  const toggleType = (typeId: string) => {
    setSelectedTypes((prev) =>
      prev.includes(typeId) ? prev.filter((item) => item !== typeId) : [...prev, typeId],
    );
  };

  return (
    <MobileSkyShell>
      <div className="space-y-3 pb-24">
        <section className="rounded-[22px] border border-sky-200/15 bg-[#0d1728] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06)]">
          <Link href="/m/sky/cloud-mind" className="mb-3 inline-flex items-center gap-1 text-[12px] font-bold text-slate-400">
            <ArrowLeft className="size-3.5" />
            返回 AI 工具
          </Link>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-sky-500 text-white">
              <Route className="size-5" />
            </span>
            <div>
              <h1 className="text-[24px] font-extrabold leading-none text-white">课程工作室</h1>
              <p className="mt-1 text-[12px] font-semibold text-slate-400">基于画像生成讲义、课件、导图和学习路径。</p>
            </div>
          </div>
        </section>

        <section className="rounded-[20px] border border-white/10 bg-[#0d1728] p-3">
          <label htmlFor="course-goal" className="block text-[12px] font-extrabold text-slate-300">
            学习目标
          </label>
          <textarea
            id="course-goal"
            aria-label="学习目标"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            className="mt-2 min-h-28 w-full rounded-[13px] border border-white/10 bg-white/[0.055] px-3 py-3 text-[14px] font-semibold leading-6 text-white outline-none focus:border-sky-300/40"
          />

          <div className="mt-4 text-[12px] font-extrabold text-slate-300">资源类型</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {resourceTypes.map((type) => {
              const Icon = type.icon;
              const selected = selectedTypes.includes(type.id);
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => toggleType(type.id)}
                  className={cn(
                    'flex h-11 items-center justify-center gap-2 rounded-[13px] border text-[13px] font-extrabold',
                    selected
                      ? 'border-sky-300/30 bg-sky-400/15 text-sky-100'
                      : 'border-white/10 bg-white/[0.045] text-slate-400',
                  )}
                >
                  <Icon className="size-4" />
                  {type.label}
                </button>
              );
            })}
          </div>

          <Link
            href={advancedHref}
            className="mt-4 flex h-11 items-center justify-center gap-2 rounded-[13px] bg-sky-500 text-[13px] font-extrabold text-white active:bg-sky-400"
          >
            <Sparkles className="size-4" />
            打开完整工作室
          </Link>
        </section>

        <section className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
          <h2 className="text-[14px] font-extrabold text-white">移动端先做轻入口</h2>
          <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-400">
            这里负责收集目标和资源类型。完整生成追踪、可信审核和多资源预览继续进入桌面工作室承接。
          </p>
        </section>
      </div>
      <MobileQuickEntranceNav />
    </MobileSkyShell>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
E:\01_Work\sky-classroom\node_modules\.bin\vitest.cmd run tests/sky/mobile-course-studio-entry.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/m/sky/cloud-mind/course-studio/page.tsx tests/sky/mobile-course-studio-entry.test.tsx
git commit -m "feat: add mobile course studio entry"
```

---

### Task 5: Run Focused Regression Suite

**Files:**
- No code changes unless tests reveal a regression.

- [ ] **Step 1: Run all mobile-focused tests**

Run:

```bash
E:\01_Work\sky-classroom\node_modules\.bin\vitest.cmd run tests/sky/mobile-cloud-mind-tools.test.tsx tests/sky/mobile-memory-page.test.tsx tests/sky/mobile-review-plan.test.tsx tests/sky/mobile-course-studio-entry.test.tsx tests/sky/mobile-study-lab.test.tsx tests/sky/mobile-learning-review.test.tsx tests/sky/mobile-assistant.test.tsx
```

Expected: PASS for all listed tests.

- [ ] **Step 2: Run existing broader mobile tests**

Run:

```bash
E:\01_Work\sky-classroom\node_modules\.bin\vitest.cmd run tests/mobile
```

Expected: PASS. If failures are unrelated to this change, record the failure names in the final implementation summary and do not change unrelated files.

- [ ] **Step 3: Inspect route/frame usage**

Run:

```bash
rg -n "MobileSkyFrame" app/m/sky app/m/generation-progress app/m/classroom
```

Expected:

- `app/m/sky/cloud-mind/memory/page.tsx` is not listed.
- `app/m/sky/cloud-mind/course-studio/page.tsx` is not listed.
- `app/m/sky/learning/review/plan/page.tsx` is not listed.
- Existing advanced routes such as slides, teaching, question-bank, classroom, and generation-progress may still be listed.

- [ ] **Step 4: Leave verification task uncommitted unless it changed code**

If no files changed during regression, do not commit. If a test fix is required, stop and create a
small follow-up task with exact file paths before editing. Do not commit unrelated dirty files.

---

## Plan Self-Review

- Spec coverage:
  - Existing mobile shell preserved: covered in shared notes and all page snippets.
  - Mobile cloud mind missing entries: covered by Task 1.
  - Memory route: covered by Task 2.
  - Review plan native route: covered by Task 3.
  - Course studio mobile entry: covered by Task 4.
  - Tests and focused verification: covered by Task 5.
- Deferred by design:
  - Native solve first screen, native quiz first screen, and assistant chat shell are Phase 2 in the spec and should receive a second plan after Phase 1 lands.
  - Teacher/editor pages remain framed behind entry or fallback links.
- Placeholder scan:
  - No `TBD`, `TODO`, or omitted implementation steps.
  - TSX code blocks contain angle brackets as syntax, not placeholders.
- Type consistency:
  - Page components are default exports matching Next.js route conventions.
  - Tests import the route files directly.
  - All mobile pages use the current `MobileSkyShell` and `MobileQuickEntranceNav`.
