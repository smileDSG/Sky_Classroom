# Sky Learning Entry Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify Sky learning entry points so users follow a clear path from today’s task to the learning route and only open tools when needed.

**Architecture:** Keep existing routes and data APIs. Rework the presentation layer so `/sky` acts as the today dashboard, `/sky/learning` acts as the route and plan center, and `/sky/study-lab` becomes a hidden detail page without internal demo wording. Avoid deleting business capabilities.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, lucide-react, existing Sky store and learning insight helpers.

---

## File Structure

- Modify `components/sky/layout/sky-tab-bar.tsx`: rename top-level learning navigation labels to clearer task language.
- Modify `app/sky/page.tsx`: reduce first-screen complexity and make the current task the only dominant action.
- Modify `components/sky/learning/workshop-page.tsx`: remove the visible `/sky/study-lab` CTA, make course resource generation contextual, and fold the tool grid under a disclosure.
- Modify `components/sky/study-lab/study-lab-page.tsx`: remove internal competition/team wording and make the page read as a detail view.
- Verify with `npx tsc --noEmit` if available, otherwise run targeted TypeScript checks through the existing build command.

## Task 1: Navigation Labels

**Files:**
- Modify: `components/sky/layout/sky-tab-bar.tsx`

- [ ] **Step 1: Update nav labels**

Change the nav item labels so the user sees the task hierarchy:

```tsx
const NAV_ITEMS: { label: string; href: string; icon: typeof Star; badge?: number }[] = [
  { label: '天穹授课', href: '/', icon: GraduationCap },
  { label: '今日学习', href: '/sky', icon: Star },
  { label: '云端智囊', href: '/sky/cloud-mind', icon: Brain },
  { label: '学习路线', href: '/sky/learning', icon: TrendingUp },
  { label: '云翼助手', href: '/sky/assistant', icon: Feather },
];
```

- [ ] **Step 2: Keep active-route behavior unchanged**

Confirm `/sky/study-lab` still highlights neither a new top-level item nor a removed item. Do not add a nav item for study lab.

## Task 2: Home Page First Screen

**Files:**
- Modify: `app/sky/page.tsx`

- [ ] **Step 1: Rename the hero context**

Change the greeting area copy so it frames `/sky` as “今日学习 / 摘星锦囊”, not a general dashboard.

Use text:

```tsx
<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
  {hasData ? `摘星锦囊已记录 ${mistakes.length} 道错题，先完成今天最重要的一步。` : '从第一道题开始，摘星锦囊会逐步生成你的今日任务。'}
</p>
```

- [ ] **Step 2: Ensure the top content has one dominant task**

Keep `TodayActionCard` as the only high-emphasis CTA when `personalization.recommendation` exists. Keep `DailySuggestCard` below it as secondary guidance. Do not add new high-emphasis tool buttons.

- [ ] **Step 3: Downgrade common tools**

Change `CloudMindMiniCard` header from “常用工具” to “更多工具” and body copy to make it a secondary area. Do not remove the links because these tools remain available.

- [ ] **Step 4: Keep profile completion as a contextual entry**

Keep `LearningProfileEntryCard`, but make its CTA copy “完善画像” instead of only “完善”.

## Task 3: Workshop Page Recomposition

**Files:**
- Modify: `components/sky/learning/workshop-page.tsx`

- [ ] **Step 1: Add collapsible tools state**

Add a local state after snapshot states:

```tsx
const [toolsExpanded, setToolsExpanded] = useState(false);
```

- [ ] **Step 2: Remove visible study-lab CTA**

Delete the visible `<Link href="/sky/study-lab">个性化学习工作台</Link>` block from the right-side today task panel. Keep the route itself.

- [ ] **Step 3: Downgrade course resources**

Delete the visible `<Link href="/sky/cloud-mind/course-studio">生成课程资源</Link>` block from the right-side today task panel. Course resources remain accessible through “更多工具”.

- [ ] **Step 4: Rename the path section**

Change the section title from “今日学习路径” to “学习路线” so it matches navigation and product hierarchy.

- [ ] **Step 5: Convert tool grid to a disclosure**

Replace the always-visible tool grid section with a compact disclosure:

```tsx
<section className="relative overflow-hidden rounded-[24px] border border-emerald-200 bg-white/85 shadow-[0_18px_55px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-emerald-200/20 dark:bg-[#07111f]/95 dark:shadow-[0_18px_55px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.04)]">
  <button
    type="button"
    onClick={() => setToolsExpanded((value) => !value)}
    className="flex min-h-16 w-full items-center justify-between gap-3 border-b border-slate-200/70 bg-slate-50/70 p-5 text-left transition-colors hover:bg-slate-100/70 dark:border-cyan-100/10 dark:bg-[#0b1729]/80 dark:hover:bg-[#10223a] md:p-6"
    aria-expanded={toolsExpanded}
  >
    <span className="flex items-center gap-3 text-base font-semibold text-slate-950 dark:text-white">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-200/25 dark:bg-emerald-300/10 dark:text-emerald-100">
        <BookOpenCheck className="h-4 w-4" />
      </span>
      更多工具
    </span>
    <span className="text-xs font-medium text-slate-500 dark:text-slate-300">
      {toolsExpanded ? '收起' : '展开'}
    </span>
  </button>
  {toolsExpanded && (
    <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
      {LEARNING_FEATURES.map((feature) => (
        <FeatureEntryCard key={feature.key} feature={feature} />
      ))}
    </div>
  )}
</section>
```

## Task 4: Study Lab Detail Copy

**Files:**
- Modify: `components/sky/study-lab/study-lab-page.tsx`

- [ ] **Step 1: Remove internal wording**

Replace `队员 B 业务闭环` with `学习数据详情`.

- [ ] **Step 2: Rename the hero**

Replace the hero heading with:

```tsx
学习画像、路线和数据来源
```

Replace the description with:

```tsx
这里保留个性化学习的详细数据，主流程请从今日学习和学习路线进入。
```

- [ ] **Step 3: Keep route safe**

Do not delete `/sky/study-lab`. Keep the back link to `/sky/learning`.

## Task 5: Verification

**Files:**
- No code files modified in this task.

- [ ] **Step 1: Run type check**

Run:

```bash
npx tsc --noEmit
```

Expected: TypeScript completes without new errors. If the repository already has unrelated errors, capture the first relevant error and verify it is not caused by the touched files.

- [ ] **Step 2: Inspect diff**

Run:

```bash
git diff -- components/sky/layout/sky-tab-bar.tsx app/sky/page.tsx components/sky/learning/workshop-page.tsx components/sky/study-lab/study-lab-page.tsx
```

Expected: Diff only changes copy, visibility, and presentation structure described in this plan.
