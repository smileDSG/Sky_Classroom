# Course Studio Minimal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify `/sky/cloud-mind/course-studio` into a minimal resource-generation studio while keeping multi-agent evidence available after generation.

**Architecture:** Keep the existing route, API calls, and state flow. Recompose `CourseStudioPage` so the first screen has one intent input, compact resource-type pills, one generate button, and secondary disclosure actions. Move profile details, stage cards, trust review, P1 evidence, P2 long-term planning, and learning path into collapsible detail sections after generation.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, shadcn UI primitives, lucide-react, Vitest + React Testing Library.

---

## File Structure

- Modify `components/sky/course-studio/course-studio-page.tsx`: rewrite the visible layout, add compact helper components, and keep generation logic intact.
- Create `tests/sky/course-studio-page.test.tsx`: verify the first screen is minimal and detailed profile fields are not visible by default.
- Verify with `npx tsc --noEmit` and a targeted Vitest run.

## Task 1: Add Minimal First-Screen Test

**Files:**
- Create: `tests/sky/course-studio-page.test.tsx`

- [ ] **Step 1: Create a component test with app shell and link mocks**

Use this structure:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CourseStudioPage } from '@/components/sky/course-studio/course-studio-page';

vi.mock('@/components/sky/layout/app-shell', () => ({
  SkyAppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock('next/link', async () => {
  const ReactModule = await import('react');
  return {
    default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
      ReactModule.createElement('a', { href, ...props }, children),
  };
});

describe('CourseStudioPage', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          userId: 'student-1',
          generatedAt: Date.now(),
          hasLearningData: true,
          hasPersonalizationSignals: true,
          weakPoints: [
            {
              knowledgePoint: 'RAG',
              mastery: 48,
              recentMistakeCount: 2,
              actionHref: '/sky/cloud-mind/quiz',
            },
          ],
          masteryByKnowledge: { RAG: 48 },
          recentAccuracy: 62,
          dueReviews: [],
          errorPatterns: [],
          preferredDifficulty: 'medium',
          learningPath: {
            current: '检索增强生成',
            next: '智能体工作流',
            nodes: ['RAG', '智能体工作流'],
            reason: '薄弱点优先',
          },
          tutoringPolicy: {
            targetTopic: 'RAG',
            difficulty: 'medium',
            explanationStyle: 'example_first',
            resourceFormats: ['code_case', 'diagram'],
            pacing: 'steady',
            directives: [],
            evidence: [{ source: 'profile', summary: '偏好代码案例' }],
          },
          recommendation: {
            title: '复习 RAG',
            reason: '最近准确率偏低',
            targetTool: 'quiz',
            href: '/sky/cloud-mind/quiz',
          },
        },
      }),
    } as Response);
    global.fetch = mockFetch;
  });

  it('keeps the initial course studio screen focused on one generation task', async () => {
    render(<CourseStudioPage />);

    expect(await screen.findByRole('heading', { name: '这次想生成什么学习资料？' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('例如：帮我复习 RAG，准备期末考试')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /生成/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /讲义/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PPT/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /题库/ })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sky/cloud-mind/personalization-context', {
        credentials: 'include',
        cache: 'no-store',
      });
    });

    expect(screen.queryByLabelText('专业背景')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('学习目标')).not.toBeInTheDocument();
    expect(screen.queryByText('Agent 协同进度')).not.toBeInTheDocument();
    expect(screen.queryByText('P1 Evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('P2 Long-Term')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails before implementation**

Run:

```bash
npx vitest run tests/sky/course-studio-page.test.tsx
```

Expected before implementation: FAIL because the current page heading and full profile fields are still visible.

## Task 2: Recompose CourseStudioPage First Screen

**Files:**
- Modify: `components/sky/course-studio/course-studio-page.tsx`

- [ ] **Step 1: Add local disclosure state**

Add state near the existing UI state:

```tsx
const [profilePanelOpen, setProfilePanelOpen] = useState(false);
const [flowPanelOpen, setFlowPanelOpen] = useState(false);
const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
```

- [ ] **Step 2: Replace the two-column pre-generation layout**

Change the JSX returned by `CourseStudioPage` so the outer content is a centered `max-w-4xl` surface. Before results exist, render:

```tsx
<section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70 sm:p-6">
  <Link href="/sky/cloud-mind" className="mb-5 inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:border-cyan-200 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-cyan-400/40 dark:hover:text-cyan-100">
    <ArrowLeft className="h-4 w-4" />
    云端智囊
  </Link>
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <Badge variant="outline" className="h-7 rounded-full px-3 text-cyan-700 dark:text-cyan-100">课程资源工坊</Badge>
      <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-3xl">这次想生成什么学习资料？</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">已根据学习画像预设偏好。补一句本次重点，或直接生成一套资料。</p>
    </div>
    <Badge variant="outline" className="h-8 shrink-0 rounded-full px-3 text-slate-600 dark:text-slate-300">{contextLoading ? '画像读取中' : systemProfileReady ? '画像已就绪' : '补一句即可生成'}</Badge>
  </div>
</section>
```

- [ ] **Step 3: Add the compact generation studio**

Render a single input area below the hero:

```tsx
<section className="rounded-2xl border border-cyan-200/70 bg-cyan-50/60 p-4 shadow-sm dark:border-cyan-300/20 dark:bg-cyan-300/10 sm:p-5">
  <Textarea
    id="course-studio-intent"
    value={supplement}
    onChange={(event) => setSupplement(event.target.value)}
    placeholder="例如：帮我复习 RAG，准备期末考试"
    className="min-h-24 resize-none bg-white text-sm leading-6 dark:bg-slate-950/70"
  />
  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-wrap gap-2">
      {RESOURCE_TYPES.map((item) => (
        <ResourceTypePill key={item.id} item={item} selected={selectedTypes.includes(item.id)} onClick={() => toggleType(item.id)} />
      ))}
    </div>
    <Button type="button" className="min-h-11 justify-center px-5" onClick={handleGenerate} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
      生成
    </Button>
  </div>
</section>
```

- [ ] **Step 4: Keep secondary actions low emphasis**

Below the studio, render only two outline/ghost actions:

```tsx
<div className="flex flex-wrap justify-center gap-2 text-sm">
  <Button type="button" variant="ghost" size="sm" onClick={() => setProfilePanelOpen((value) => !value)}>调整画像依据</Button>
  <Button type="button" variant="ghost" size="sm" onClick={() => setFlowPanelOpen((value) => !value)}>查看生成流程</Button>
  <Button type="button" variant="ghost" size="sm" onClick={refreshPersonalization} disabled={contextLoading || loading}>刷新画像</Button>
</div>
```

## Task 3: Move Profile And Flow Into Disclosures

**Files:**
- Modify: `components/sky/course-studio/course-studio-page.tsx`

- [ ] **Step 1: Move existing editable fields into an optional profile panel**

When `profilePanelOpen` is true, render the existing fields for `major`, `goal`,
`weakPoints`, `studyTime`, `courseFocus`, `history`, and `preferenceText` in a
single compact panel below the secondary actions. Keep `supplement` out of this
panel because it is now the main input.

- [ ] **Step 2: Move stage grid into an optional flow panel**

When `flowPanelOpen` is true, render the existing stage progress grid. When
`loading` is true and the panel is closed, show only:

```tsx
<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70">
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
      <Search className="h-4 w-4 text-cyan-600 dark:text-cyan-100" />
      正在生成学习资料
    </div>
    <Badge variant="outline" className="h-7 rounded-full px-3">{progress}%</Badge>
  </div>
  <Progress value={progress} className="mt-3 h-2" />
</div>
```

## Task 4: Make Results First And Details Second

**Files:**
- Modify: `components/sky/course-studio/course-studio-page.tsx`

- [ ] **Step 1: Replace the resource card grid with a vertical list**

Update `ResourceCard` styling so it uses `min-h` only where needed and reads as
a list item. Keep view, copy, and download actions.

- [ ] **Step 2: Add detail sections below results**

Create `DetailSection` in the same file:

```tsx
function DetailSection({
  id,
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
          <Icon className="h-4 w-4 text-cyan-600 dark:text-cyan-100" />
          {title}
        </span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-300">{open ? '收起' : '展开'}</span>
      </button>
      {open && <div className="border-t border-slate-200 p-4 dark:border-slate-700/40">{children}</div>}
    </section>
  );
}
```

- [ ] **Step 3: Place existing technical panels inside details**

After `result` exists, render detail sections:

- `为什么适合你`: profile summary and recommendation evidence.
- `生成流程`: stage cards and agent trace if present.
- `可信审核`: safety result, hit count, and resource checks.
- `后续学习`: learning path, next actions, `CourseStudioP1EvidencePanel`, and `CourseStudioP2LongTermPanel`.

## Task 5: Verify And Clean Up

**Files:**
- Test: `tests/sky/course-studio-page.test.tsx`
- Modify: `components/sky/course-studio/course-studio-page.tsx`

- [ ] **Step 1: Run targeted test**

Run:

```bash
npx vitest run tests/sky/course-studio-page.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run type check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors from `components/sky/course-studio/course-studio-page.tsx`
or `tests/sky/course-studio-page.test.tsx`. If existing unrelated errors appear,
record the first unrelated file.

- [ ] **Step 3: Inspect diff**

Run:

```bash
git diff -- components/sky/course-studio/course-studio-page.tsx tests/sky/course-studio-page.test.tsx
```

Expected: diff only changes presentation, test coverage, and local helper
components for the course studio page.
