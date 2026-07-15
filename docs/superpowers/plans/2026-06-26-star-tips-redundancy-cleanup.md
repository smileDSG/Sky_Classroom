# Star Tips Redundancy Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the highest-impact redundancy from the Star Tips dashboard by consolidating tool entry points and eliminating duplicate stats requests.

**Architecture:** Keep `app/sky/page.tsx` as the dashboard coordinator. Make `DailySuggestCard` a pure presentational component that receives stats from the parent. Keep one Cloud Mind tool entry section on the dashboard and remove the duplicate quick-actions panel.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library.

---

## File Structure

- Modify: `components/sky/dashboard/daily-suggest-card.tsx`
  - Remove its internal `/api/sky/learning-stats` fetch.
  - Accept `stats` as a prop.
  - Remove the inactive "换一批" pagination UI.
- Modify: `app/sky/page.tsx`
  - Pass fetched stats into `DailySuggestCard`.
  - Expand `CloudMindMiniCard` to the five core Cloud Mind tools.
  - Remove `QuickActionsCompact` from the rendered dashboard.
  - Fix greeting text and emoji edge cases.
- Create: `tests/sky/star-tips-dashboard.test.tsx`
  - Verify the dashboard fetches learning stats once.
  - Verify the page exposes one consolidated tool-entry section.
- Create: `tests/sky/daily-suggest-card.test.tsx`
  - Verify the suggestion card does not fetch stats by itself.
  - Verify no inactive refresh control appears.
- Modify: `docs/star-tips-redundancy-audit.md`
  - Mark the first implemented cleanup batch.

## Task 1: Daily Suggestion Card Purity

**Files:**
- Create: `tests/sky/daily-suggest-card.test.tsx`
- Modify: `components/sky/dashboard/daily-suggest-card.tsx`

- [x] **Step 1: Write the failing test**

```tsx
render(<DailySuggestCard mistakes={[makeMistake()]} stats={{ streakDays: 2, masteryPercent: 45 }} />);
expect(global.fetch).not.toHaveBeenCalled();
expect(screen.queryByText('换一批')).not.toBeInTheDocument();
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sky/daily-suggest-card.test.tsx`
Expected: FAIL because the component currently fetches `/api/sky/learning-stats`.

- [x] **Step 3: Write minimal implementation**

Change `DailySuggestCardProps` to include `stats`, remove `useAuth`, remove the stats `useEffect`, remove refresh state, and render `allSuggestions.slice(0, 3)`.

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sky/daily-suggest-card.test.tsx`
Expected: PASS.

## Task 2: Dashboard Entry Consolidation

**Files:**
- Create: `tests/sky/star-tips-dashboard.test.tsx`
- Modify: `app/sky/page.tsx`

- [x] **Step 1: Write the failing test**

```tsx
render(<SkyDashboardPage />);
expect(await screen.findByText('云端智囊')).toBeInTheDocument();
expect(screen.getByText('智能出题')).toBeInTheDocument();
expect(screen.getByText('智能授课')).toBeInTheDocument();
expect(screen.queryByText('快捷操作')).not.toBeInTheDocument();
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/sky/star-tips-dashboard.test.tsx`
Expected: FAIL because `QuickActionsCompact` still renders and `CloudMindMiniCard` only has three tools.

- [x] **Step 3: Write minimal implementation**

Remove `QuickActionsCompact` from the rendered dashboard, add quiz and teaching entries to `CloudMindMiniCard`, pass `stats` into `DailySuggestCard`, and fix greeting strings.

- [x] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/sky/star-tips-dashboard.test.tsx`
Expected: PASS.

## Task 3: Documentation Follow-up

**Files:**
- Modify: `docs/star-tips-redundancy-audit.md`

- [x] **Step 1: Update implementation status**

Add a short "实施记录" section naming the completed batch:

```markdown
## 八、实施记录

- 2026-06-26：完成第一批清理，包含每日建议去请求化、移除失效换一批、合并首页工具入口、修正问候语。
```

- [x] **Step 2: Verify docs diff**

Run: `git diff -- docs/star-tips-redundancy-audit.md`
Expected: only implementation status text changed.

## Self-Review

- Spec coverage: P0 duplicate stats request, inactive refresh logic, and repeated quick actions are covered.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: `stats` uses the existing `streakDays` and `masteryPercent` shape already consumed by `generateSuggestions`.
