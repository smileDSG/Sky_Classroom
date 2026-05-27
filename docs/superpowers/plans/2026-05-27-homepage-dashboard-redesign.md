# Homepage Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the homepage from a linear single-column layout into a rich Dashboard style with greeting, quick stats, compact input, function cards, and generation status — all while keeping classroom generation as the core.

**Architecture:** 3 new focused components (`GreetingSection`, `QuickAccessGrid`, `GenerationStatus`) + compact adjustments to `HeroInput` + layout reorganization in `app/page.tsx`.

**Tech Stack:** React, motion/react (Framer Motion), Tailwind CSS, lucide-react icons

---

### File Structure

| File | Responsibility |
|------|---------------|
| `components/sky/home/greeting-section.tsx` | Greeting text + 3 quick stat cards (demo data) |
| `components/sky/home/quick-access-grid.tsx` | 4 function shortcut cards with icons and hover |
| `components/sky/home/generation-status.tsx` | Generation progress or onboarding guide |
| `components/sky/home/hero-input.tsx` | Compact input (reduced padding, removed outer animation) |
| `app/page.tsx` | Layout reorganization |

---

### Task 1: Create GreetingSection Component

**Files:**
- Create: `components/sky/home/greeting-section.tsx`

- [ ] **Step 1: Create the component**

Create `components/sky/home/greeting-section.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Zap, Sparkles, Brain } from 'lucide-react';
import { useTheme } from '@/lib/hooks/use-theme';

const stats = [
  { label: '今日学习', value: '2.5h', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  { label: '连续打卡', value: '7 天', icon: Sparkles, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  { label: '知识掌握', value: '68%', icon: Brain, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
];

function getGreeting(isDark: boolean): string {
  const hour = new Date().getHours();
  if (isDark) {
    if (hour >= 5 && hour < 12) return '晚上好，同学！';
    if (hour >= 12 && hour < 18) return '夜晚好，同学！';
    if (hour >= 18 && hour < 22) return '晚上好，同学！';
    return '夜深了，注意休息！';
  }
  if (hour >= 5 && hour < 12) return '早上好，同学！';
  if (hour >= 12 && hour < 18) return '下午好，同学！';
  if (hour >= 18 && hour < 22) return '晚上好，同学！';
  return '夜深了，注意休息！';
}

function getGreetingEmoji(isDark: boolean): string {
  const hour = new Date().getHours();
  if (isDark) return '🌙';
  if (hour >= 5 && hour < 12) return '☀️';
  if (hour >= 12 && hour < 18) return '🌤️';
  return '🌙';
}

export function GreetingSection() {
  const { resolvedTheme } = useTheme();
  const greeting = useMemo(() => getGreeting(resolvedTheme === 'dark'), [resolvedTheme]);
  const greetingEmoji = useMemo(() => getGreetingEmoji(resolvedTheme === 'dark'), [resolvedTheme]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6"
    >
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span className="text-3xl">{greetingEmoji}</span>
          {greeting}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          今天是学习的好日子，继续加油！
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex items-center gap-3 rounded-xl bg-white/70 dark:bg-slate-800/60 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/30 p-3"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div>
                <div className="text-base font-bold text-slate-800 dark:text-slate-100">{stat.value}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{stat.label}</div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "greeting-section" || echo "OK"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add components/sky/home/greeting-section.tsx
git commit -m "feat: add GreetingSection with time-based greeting and quick stats"
```

---

### Task 2: Create QuickAccessGrid Component

**Files:**
- Create: `components/sky/home/quick-access-grid.tsx`

- [ ] **Step 1: Create the component**

Create `components/sky/home/quick-access-grid.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  Presentation,
  Search,
  Brain,
  MessageSquare,
} from 'lucide-react';

const quickAccessItems = [
  {
    icon: Presentation,
    title: 'PPT 课件生成',
    desc: '一键生成精美课件',
    color: 'text-sky-500',
    bg: 'bg-sky-500/10 hover:bg-sky-500/20',
    border: 'border-sky-200/50 dark:border-sky-800/30',
    href: '/sky/slides',
  },
  {
    icon: Search,
    title: '拍照搜题',
    desc: '拍照秒出解析答案',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10 hover:bg-violet-500/20',
    border: 'border-violet-200/50 dark:border-violet-800/30',
    href: '/sky/solve',
  },
  {
    icon: Brain,
    title: '云端智囊',
    desc: 'AI 智能学习工具集',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10 hover:bg-amber-500/20',
    border: 'border-amber-200/50 dark:border-amber-800/30',
    href: '/sky/cloud-mind',
  },
  {
    icon: MessageSquare,
    title: '互动课堂',
    desc: '沉浸式 AI 教学',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    border: 'border-emerald-200/50 dark:border-emerald-800/30',
    href: '/sky/assistant',
  },
];

export function QuickAccessGrid() {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {quickAccessItems.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06 }}
            whileHover={{ y: -3, scale: 1.02 }}
            onClick={() => router.push(item.href)}
            className={`
              flex items-center gap-3 rounded-xl border ${item.border}
              ${item.bg} backdrop-blur-sm cursor-pointer
              p-4 transition-all duration-200
              hover:shadow-lg
            `}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
              <Icon className={`h-5 w-5 ${item.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                {item.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {item.desc}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "quick-access" || echo "OK"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add components/sky/home/quick-access-grid.tsx
git commit -m "feat: add QuickAccessGrid with 4 function shortcuts"
```

---

### Task 3: Create GenerationStatus Component

**Files:**
- Create: `components/sky/home/generation-status.tsx`

- [ ] **Step 1: Create the component**

Create `components/sky/home/generation-status.tsx`:

```tsx
'use client';

import { motion } from 'motion/react';
import { Sparkles, ArrowRight, BookOpen, Lightbulb } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface GenerationStatusProps {
  phase: 'idle' | 'submitting' | 'generating_outline' | 'reviewing' | 'generating_slides' | 'done';
  progress: number;
  step: string;
  jobId: string | null;
}

const phaseLabels: Record<string, string> = {
  idle: '',
  submitting: '正在提交...',
  generating_outline: '正在生成大纲...',
  reviewing: '大纲已生成，点击查看',
  generating_slides: '正在生成幻灯片...',
  done: '课堂生成完成',
};

export function GenerationStatus({ phase, progress, step, jobId }: GenerationStatusProps) {
  const router = useRouter();

  // Active generation
  if (phase !== 'idle' && phase !== 'done') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <button
          type="button"
          onClick={() => jobId && router.push(`/generation-progress?jobId=${jobId}`)}
          className="w-full text-left rounded-2xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 shadow-lg p-5 hover:shadow-xl hover:border-sky-300 dark:hover:border-sky-700 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-sky-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-sky-700 dark:text-sky-300">
                {phaseLabels[phase] || '后台处理中'}
              </p>
              <p className="text-sm text-muted-foreground">
                {phase === 'reviewing'
                  ? '共 0 个场景 — 点击进入审阅'
                  : step || '后台处理中，可自由切换页面'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-sky-600">{progress}%</span>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-sky-100 dark:bg-sky-900 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-sky-500"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </button>
      </motion.div>
    );
  }

  // Idle — onboarding guide
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm p-5"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-500 shadow-lg shadow-sky-500/25">
          <BookOpen className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
            开始你的第一个课堂
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            在上方输入框中描述你想要的课堂内容，点击"创建课堂"即可开始
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">
              <Lightbulb className="w-3 h-3 text-amber-500" />
              试试输入"初中物理：力的作用"
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">
              <Sparkles className="w-3 h-3 text-sky-500" />
              或点击"模板"快速开始
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "generation-status" || echo "OK"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add components/sky/home/generation-status.tsx
git commit -m "feat: add GenerationStatus with progress bar and onboarding guide"
```

---

### Task 4: Compact HeroInput Adjustments

**Files:**
- Modify: `components/sky/home/hero-input.tsx`

- [ ] **Step 1: Reduce outer container animation**

Remove the `motion.div` wrapper's entrance animation. Change the outer `<motion.div>` to a plain `<div>`:

Change from:
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.3, duration: 0.5 }}
  className="w-full max-w-3xl mx-auto"
>
```

to:
```tsx
<div className="w-full">
```

And change the closing `</motion.div>` to `</div>`.

- [ ] **Step 2: Reduce internal padding**

Change the top toolbar padding from `px-4 py-3` to `px-3 py-2`:

```tsx
<div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
```

Change the agent selector row padding from `px-4 py-3` to `px-3 py-2`:

```tsx
<div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/30">
```

Change the textarea padding from `px-4 py-4 min-h-[140px]` to `px-3 py-3 min-h-[100px]`:

```tsx
'w-full px-3 py-3 min-h-[100px] max-h-[300px]',
```

Change the bottom toolbar padding from `px-4 py-3` to `px-3 py-2`:

```tsx
<div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 dark:border-slate-700/50">
```

- [ ] **Step 3: Reduce PDF preview padding**

Change `px-4 pb-3` to `px-3 pb-2`:

```tsx
className="px-3 pb-2"
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "hero-input" || echo "OK"`

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add components/sky/home/hero-input.tsx
git commit -m "style: compact HeroInput — reduced padding, removed outer animation"
```

---

### Task 5: Restructure app/page.tsx Layout

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Update imports**

Replace the existing sky/home imports block (lines 38-42):

```tsx
import { SkyBackground } from '@/components/sky/home/sky-background';
import { MinimalNavbar } from '@/components/sky/home/minimal-navbar';
import { FloatingUserCard } from '@/components/sky/home/floating-user-card';
import { AnimatedLogo, FeatureHighlights } from '@/components/sky/home/animated-logo';
import { HeroInput } from '@/components/sky/home/hero-input';
import { ClassroomGrid } from '@/components/sky/home/classroom-grid';
```

with:

```tsx
import { SkyBackground } from '@/components/sky/home/sky-background';
import { MinimalNavbar } from '@/components/sky/home/minimal-navbar';
import { FloatingUserCard } from '@/components/sky/home/floating-user-card';
import { HeroInput } from '@/components/sky/home/hero-input';
import { ClassroomGrid } from '@/components/sky/home/classroom-grid';
import { GreetingSection } from '@/components/sky/home/greeting-section';
import { QuickAccessGrid } from '@/components/sky/home/quick-access-grid';
import { GenerationStatus } from '@/components/sky/home/generation-status';
```

- [ ] **Step 2: Reorganize the main content area**

Find the `<main>` tag in the return block. Replace the entire section from `<main className="relative z-10 pt-24 pb-12 px-4 md:px-6">` through the closing `</main>` with:

```tsx
<main className="relative z-10 px-4 md:px-6 pt-8 pb-8">
  <div className="max-w-6xl mx-auto space-y-6">
    {/* Greeting + Quick Stats */}
    <GreetingSection />

    {/* Hero Input */}
    <HeroInput
      value={requirement}
      onChange={handleRequirementChange}
      onSubmit={handleGenerate}
      onTemplateClick={() => setTemplatePickerOpen(true)}
      pdfFile={pdfFile}
      onPdfChange={setPdfFile}
      interactiveMode={interactiveMode}
      onInteractiveModeChange={handleInteractiveModeChange}
      webSearch={webSearch}
      onWebSearchChange={handleWebSearchChange}
      canSubmit={canGenerate}
      onSettingsOpen={() => {
        setSettingsSection('providers');
        setSettingsOpen(true);
      }}
      selectedTeacherId={selectedTeacherId}
      selectedStudentIds={selectedStudentIds}
      onTeacherChange={setSelectedTeacherId}
      onStudentsChange={setSelectedStudentIds}
    />

    {/* Quick Access + Generation Status */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <QuickAccessGrid />
      </div>
      <div className="lg:col-span-1">
        <GenerationStatus
          phase={classroomPhase}
          progress={classroomProgress}
          step={classroomStep}
          jobId={classroomJobId}
        />
      </div>
    </div>

    {/* ── Classroom generation progress (replaces old inline block) ── */}
    {/* Note: This is the OLD generation progress block — REMOVE it entirely.
       The GenerationStatus component above now handles this.
       Delete the entire AnimatePresence block that renders when
       classroomPhase !== 'idle' && classroomPhase !== 'done' */}

    {/* Error display (keep this) */}
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm"
        >
          {error}
        </motion.div>
      )}
    </AnimatePresence>

    {/* PPT课件生成入口 (move after error, keep it) */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="flex items-center justify-center gap-3"
    >
      <span className="text-xs text-slate-400">或</span>
      <button
        onClick={handlePptGenerate}
        disabled={!canGenerate}
        className={
          'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ' +
          (canGenerate
            ? 'text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20'
            : 'text-slate-400 cursor-not-allowed')
        }
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
        生成PPT课件
      </button>
    </motion.div>

    {/* Import button when no classrooms */}
    {classrooms.length === 0 && (
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        onClick={triggerFileSelect}
        disabled={importing}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
      >
        <span>导入已有课堂</span>
      </motion.button>
    )}

    {/* Usage Progress (logged in) */}
    {user && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <UsageProgress />
      </motion.div>
    )}

    {/* Recent Classrooms */}
    {classrooms.length > 0 && (
      <section>
        <ClassroomGrid
          classrooms={classrooms}
          thumbnails={thumbnails}
          formatDate={formatDate}
          onDelete={handleDelete}
          onRename={handleRename}
        />
      </section>
    )}
  </div>
</main>
```

- [ ] **Step 3: Remove old generation progress block**

In the original code, there's an `AnimatePresence` block (around line 606-657) that renders the classroom generation progress card. This is now handled by `GenerationStatus`. Delete this entire block.

The block to delete starts with:
```tsx
<AnimatePresence>
  {classroomPhase !== 'idle' && classroomPhase !== 'done' && (
```
and ends with:
```tsx
  )}
</AnimatePresence>
```

- [ ] **Step 4: Remove AnimatedLogo and FeatureHighlights usage**

Remove these lines from the JSX (they're still imported but now unused):
- `<AnimatedLogo />`
- `<FeatureHighlights />`

The imports were already removed in Step 1.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "page\.tsx" || echo "OK"`

Expected: `OK` (only pre-existing errors in other files, none from page.tsx)

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat: restructure homepage into dashboard layout with greeting, quick access, and generation status"
```

---

### Task 6: Final QA — Dev Server Verification

**Files:** None (manual verification)

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Verify layout at http://localhost:3000**

Checklist:
1. Navbar renders at top (unchanged)
2. GreetingSection shows time-appropriate greeting + 3 stat cards
3. HeroInput renders below greeting, with compact padding
4. QuickAccessGrid shows 4 cards (PPT课件、搜题、云端智囊、互动课堂)
5. GenerationStatus shows onboarding guide (when idle) or progress bar (when active)
6. PPT课件生成 button visible below
7. ClassroomGrid renders when classrooms exist (compact grid, gap-3)
8. Footer renders at bottom
9. Overall vertical spacing feels tighter than before (pt-8 vs pt-24)
10. All click-throughs work (QuickAccess cards navigate to correct pages)

- [ ] **Step 3: Test responsive behavior**

- Mobile (375px): Greeting + stats stack vertically, QuickAccessGrid is 2 columns, GenerationStatus is full width
- Tablet (768px): Greeting + stats side-by-side, QuickAccessGrid 4 columns
- Desktop (1440px): QuickAccessGrid 3:1 split with GenerationStatus
