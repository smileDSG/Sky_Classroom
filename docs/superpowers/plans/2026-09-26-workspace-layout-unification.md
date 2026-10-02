# Workspace Layout Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the six teacher-facing AI tools to one responsive three-column workspace shell, including a run-mode layout for intelligent teaching, without changing their business workflows.

**Architecture:** Add a typed `WorkspaceShell` layout family under `components/sky/layout/` with shared header, panel, main, aside, status, and sticky action-bar primitives. Migrate existing pages incrementally by replacing only page chrome and layout wrappers; keep each page's existing state, API calls, generation components, and domain-specific inner content. Use `mode="edit"` for configuration/generation pages and `mode="run"` for intelligent teaching.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict mode, Tailwind CSS 4, existing shadcn/ui primitives, Vitest + Testing Library, Playwright for responsive checks.

---

## File Map

### Shared layout

- Create: `components/sky/layout/workspace-shell.tsx` — typed shell, header, three-column grid, panel roles, status, and action bar.
- Create: `components/sky/layout/workspace-shell.test.tsx` — unit tests for slot order, edit/run modes, responsive class contracts, and action-bar semantics.
- Modify: `components/sky/layout/feature-page-chrome.tsx` — keep existing exports working while adapting `FeaturePageHeader` and `FeatureWorkspace` to shared tokens or documenting their migration boundary.

### Page migrations

- Modify: `app/sky/cloud-mind/quiz/page.tsx` — AI question trial edit-mode shell.
- Modify: `components/sky/slides/slides-page.tsx` — AI courseware generation edit-mode shell.
- Modify: `components/sky/solve/solve-page.tsx` and `app/sky/cloud-mind/solve/page.tsx` — problem-solving / grading shell.
- Modify: `app/sky/cloud-mind/memory/page.tsx` — memory-card shell.
- Modify: `components/sky/course-studio/course-studio-page.tsx` — learning-package workshop shell.
- Modify: `app/sky/teaching/teaching-page.tsx` and `app/sky/cloud-mind/teaching/page.tsx` — intelligent-teaching run-mode shell.
- Modify: `components/sky/teaching/teacher-workspace-page.tsx` — teaching overview entry point, removing the large violet hero and aligning the embedded teaching area.

### Tests and verification

- Modify: `tests/sky/cloud-mind-quiz-page.test.tsx` — assert the trial remains functionally interactive inside the new shell.
- Modify: `tests/sky/cloud-mind-slides.test.tsx` — assert generation form and preview landmarks remain present.
- Modify: `tests/sky/cloud-mind-memory.test.tsx` — assert card input and generation action remain available.
- Modify: `tests/sky/course-studio-page.test.tsx` — assert task/path/AI suggestion regions remain available.
- Create: `tests/sky/teaching-page.test.tsx` — assert run-mode landmarks and action labels.
- Create: `e2e/tests/workspace-layout.spec.ts` — Playwright smoke checks at desktop, tablet, and mobile widths.

## Task 1: Establish Shared Workspace Primitives

**Files:**
- Create: `components/sky/layout/workspace-shell.tsx`
- Create: `components/sky/layout/workspace-shell.test.tsx`
- Modify: `components/sky/layout/feature-page-chrome.tsx`

- [ ] **Step 1: Write failing tests for the shell contract**

Test that `WorkspaceShell` renders a page header before a grid, the grid contains `panel`, `main`, and `aside` landmarks in that order, and the action bar exposes exactly one primary action. Test that `mode="run"` adds a run-mode data attribute without changing slot order.

```tsx
render(
  <WorkspaceShell
    title="试炼"
    description="生成一组练习"
    panel={<div data-testid="panel" />}
    main={<div data-testid="main" />}
    aside={<div data-testid="aside" />}
    actions={<WorkspacePrimaryAction>开始出题</WorkspacePrimaryAction>}
  />,
);

expect(screen.getByTestId('workspace-grid')).toHaveAttribute('data-mode', 'edit');
expect(screen.getAllByTestId(/^(panel|main|aside)$/).map((node) => node.dataset.testid)).toEqual([
  'panel',
  'main',
  'aside',
]);
expect(screen.getByRole('button', { name: '开始出题' })).toHaveAttribute('data-primary', 'true');
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm vitest run components/sky/layout/workspace-shell.test.tsx`

Expected: FAIL because the shared components do not exist.

- [ ] **Step 3: Implement the minimal typed component family**

Define `WorkspaceShellProps` with `title`, `description`, `panel`, `main`, `aside`, `actions`, optional `status`, and `mode: 'edit' | 'run'`. Use one outer `max-w-[1360px]` container, `grid-cols-[240px_minmax(0,1fr)_300px]` at `lg`, `gap-5`, white cards with `rounded-xl` and `border-slate-200`, and a bottom sticky action bar with `pb-[max(0.75rem,env(safe-area-inset-bottom))]`. Export small role wrappers so migrated pages can place domain content without duplicating card chrome.

- [ ] **Step 4: Add responsive and accessibility class contracts**

At `md` collapse the panel to a horizontal parameter region and keep the aside collapsible; at the base breakpoint stack `panel`, `main`, and `aside`. Add `aria-labelledby` for the shell title, semantic `header`, `main`, `aside`, and `footer`, and ensure the action bar has `role="toolbar"`.

- [ ] **Step 5: Re-run the focused test**

Run: `pnpm vitest run components/sky/layout/workspace-shell.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the shared primitive**

```bash
git add components/sky/layout/workspace-shell.tsx components/sky/layout/workspace-shell.test.tsx components/sky/layout/feature-page-chrome.tsx
git commit -m "feat: add shared workspace shell"
```

## Task 2: Migrate AI Generation Pages

**Files:**
- Modify: `app/sky/cloud-mind/quiz/page.tsx`
- Modify: `components/sky/slides/slides-page.tsx`
- Modify: `tests/sky/cloud-mind-quiz-page.test.tsx`
- Modify: `tests/sky/cloud-mind-slides.test.tsx`

- [ ] **Step 1: Add landmark assertions to existing page tests**

For quiz, render idle AI mode and assert `workspace-panel`, `workspace-main`, `workspace-aside`, and the primary action are present. For slides, assert the topic/parameter form, preview landmark, and generation action are present. Keep existing API and interaction assertions unchanged.

- [ ] **Step 2: Run the two focused tests to establish the baseline**

Run: `pnpm vitest run tests/sky/cloud-mind-quiz-page.test.tsx tests/sky/cloud-mind-slides.test.tsx`

Expected: existing tests pass; new landmark assertions fail until wrappers are added.

- [ ] **Step 3: Wrap quiz with edit-mode workspace slots**

Use `WorkspaceHeader` for the existing title and personalization status. Move subject, goal, question type, difficulty, and count controls into `panel`; keep the current question generation/editor content in `main`; place preview and recommendation content in `aside`; move the main generate/regenerate action into `WorkspaceActionBar`. Do not alter `useTaskStore`, preview polling, question generation requests, or answer submission handlers.

- [ ] **Step 4: Wrap slides with the same edit-mode shell**

Put topic, audience, duration, style, and density controls in `panel`; keep the current generation state and result renderer in `main`; put cover/slide preview and AI generation suggestions in `aside`. Replace the existing feature header only; preserve job polling, cancel, export, and download handlers. Remove page-level purple hero treatment while retaining slide-specific preview colors.

- [ ] **Step 5: Run focused tests and typecheck the touched modules**

Run: `pnpm vitest run tests/sky/cloud-mind-quiz-page.test.tsx tests/sky/cloud-mind-slides.test.tsx` and `npx tsc --noEmit`.

Expected: PASS with no new TypeScript errors.

- [ ] **Step 6: Commit the generation-page migration**

```bash
git add app/sky/cloud-mind/quiz/page.tsx components/sky/slides/slides-page.tsx tests/sky/cloud-mind-quiz-page.test.tsx tests/sky/cloud-mind-slides.test.tsx
git commit -m "feat: align quiz and slides workspaces"
```

## Task 3: Migrate Problem Solving and Memory Cards

**Files:**
- Modify: `components/sky/solve/solve-page.tsx`
- Modify: `app/sky/cloud-mind/solve/page.tsx`
- Modify: `app/sky/cloud-mind/memory/page.tsx`
- Modify: `tests/sky/cloud-mind-memory.test.tsx`

- [ ] **Step 1: Add focused landmark tests**

Assert that memory input, card preview, and AI suggestion regions render inside the shared shell. Add a solve-page smoke assertion for multimodal input, solution/grade result, and the right-side teaching suggestion region without asserting internal styling.

- [ ] **Step 2: Run the focused tests before migration**

Run: `pnpm vitest run tests/sky/cloud-mind-memory.test.tsx tests/sky/multimodal-input.test.tsx`

Expected: existing behavior passes; new shell assertions fail.

- [ ] **Step 3: Migrate solve page to the edit/result shell**

Place image/text input and subject/context options in `panel`; keep recognition, analysis, solution, and grading state in `main`; place verification badge, similar problems, teaching hints, and history entry points in `aside`. Preserve all solve API calls, streaming state, and existing loading/error components. Use the shared action bar for submit/retry only when the current state exposes those actions.

- [ ] **Step 4: Migrate memory page to the three-column shell**

Place topic/content and review interval settings in `panel`; keep generated card browsing and editing in `main`; put study tips and AI optimization suggestions in `aside`. Keep SSE parsing, review submission, task-store updates, and card navigation unchanged. Ensure the primary “生成记忆卡片” action remains reachable in the sticky action bar.

- [ ] **Step 5: Verify behavior and responsive class contracts**

Run: `pnpm vitest run tests/sky/cloud-mind-memory.test.tsx tests/sky/multimodal-input.test.tsx` and `npx tsc --noEmit`.

- [ ] **Step 6: Commit the solve and memory migration**

```bash
git add components/sky/solve/solve-page.tsx app/sky/cloud-mind/solve/page.tsx app/sky/cloud-mind/memory/page.tsx tests/sky/cloud-mind-memory.test.tsx
git commit -m "feat: align solve and memory workspaces"
```

## Task 4: Migrate Learning Package Workshop

**Files:**
- Modify: `components/sky/course-studio/course-studio-page.tsx`
- Modify: `tests/sky/course-studio-page.test.tsx`

- [ ] **Step 1: Add the three-region contract to the course-studio test**

Assert that task information, learning-path editing, and AI recommendation/preview landmarks render together. Preserve existing personalization and generation assertions.

- [ ] **Step 2: Run the course-studio test before changing layout**

Run: `pnpm vitest run tests/sky/course-studio-page.test.tsx`

Expected: current test behavior passes; new role assertions fail.

- [ ] **Step 3: Move course-studio content into shared slots**

Use `panel` for topic, learner profile, resource types, and generation parameters. Use `main` for the learning-path timeline, generated-resource editing, and stage progression. Use `aside` for evidence, safety, quality review, and generated-resource preview. Replace `FeatureWorkspace` only at the outer layout boundary; do not change job submission, polling, route transitions, or `CourseStudioP1EvidencePanel` / `CourseStudioP2LongTermPanel` data contracts.

- [ ] **Step 4: Normalize course-studio action placement**

Move the page’s primary generation/continue action to `WorkspaceActionBar`; keep secondary resource actions inside their respective cards. Remove large violet section backgrounds and use the shared white-card surface, while retaining semantic warning/success colors for safety and quality states.

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm vitest run tests/sky/course-studio-page.test.tsx` and `npx tsc --noEmit`.

- [ ] **Step 6: Commit the workshop migration**

```bash
git add components/sky/course-studio/course-studio-page.tsx tests/sky/course-studio-page.test.tsx
git commit -m "feat: align learning package workspace"
```

## Task 5: Migrate Intelligent Teaching to Run Mode

**Files:**
- Modify: `app/sky/teaching/teaching-page.tsx`
- Modify: `app/sky/cloud-mind/teaching/page.tsx`
- Modify: `components/sky/teaching/teacher-workspace-page.tsx`
- Create: `tests/sky/teaching-page.test.tsx`

- [ ] **Step 1: Write run-mode tests**

Render `TeachingPage` with a mocked `TeachingPanel` and assert `data-mode="run"`, a course-outline panel, a live-lesson main region, an AI teaching aside, and an action bar. Assert the history toggle still works and existing `initialTopic` / personalization props are passed through.

- [ ] **Step 2: Run the teaching test to verify the new assertions fail**

Run: `pnpm vitest run tests/sky/teaching-page.test.tsx`

Expected: FAIL because the current page has a standalone header and no workspace landmarks.

- [ ] **Step 3: Wrap `TeachingPage` in `WorkspaceShell mode="run"`**

Place course sections and progress controls in `panel`; place `TeachingPanel` and its live lesson content in `main`; place current-section teaching tips, checkpoints, and history/status controls in `aside`. Keep `TeachingHistoryPanel` available through the existing toggle, but remove the separate purple/teaching-themed header treatment. Pass through all existing teaching callbacks and personalization values unchanged.

- [ ] **Step 4: Remove the independent Aurora layer from the cloud-mind teaching route**

Delete only the route-level fixed glow wrappers in `app/sky/cloud-mind/teaching/page.tsx`. Keep `SkyAppShell`, suspense behavior, personalization fetch, query-topic behavior, and `PageTour`. The shared shell supplies the page background and run-mode styling.

- [ ] **Step 5: Align the teacher overview entry page**

In `components/sky/teaching/teacher-workspace-page.tsx`, replace the violet hero with `WorkspaceHeader`-compatible lightweight page chrome and render the embedded teaching area using the same panel/card tokens. Keep course-entry links and history routing intact.

- [ ] **Step 6: Run teaching tests and typecheck**

Run: `pnpm vitest run tests/sky/teaching-page.test.tsx tests/teaching tests/sky/section-nav-routes.test.ts` and `npx tsc --noEmit`.

- [ ] **Step 7: Commit the run-mode migration**

```bash
git add app/sky/teaching/teaching-page.tsx app/sky/cloud-mind/teaching/page.tsx components/sky/teaching/teacher-workspace-page.tsx tests/sky/teaching-page.test.tsx
git commit -m "feat: align intelligent teaching workspace"
```

## Task 6: Add Responsive End-to-End Coverage

**Files:**
- Create: `e2e/tests/workspace-layout.spec.ts`

- [ ] **Step 1: Add desktop smoke coverage**

At `1280px` viewport, visit quiz, memory, course-studio, slides, solve, and teaching routes. Assert the workspace grid is visible, three role regions exist, the action bar is visible, and no horizontal scrollbar is present.

- [ ] **Step 2: Add tablet coverage**

At `900px` viewport, assert the panel has collapsed to the parameter-strip layout and the main region remains visible. Verify the aside is either visible or exposes its collapse control.

- [ ] **Step 3: Add mobile coverage**

At `390px` viewport, assert the regions stack in panel → main → aside order, the action bar remains within the viewport, and the primary action can be clicked without horizontal scrolling. For teaching, assert the course directory uses its disclosure control and the live lesson remains first priority.

- [ ] **Step 4: Run the e2e file with the project dev server**

Run: `pnpm test:e2e -- e2e/tests/workspace-layout.spec.ts`

Expected: PASS at all three viewport sizes. If the repository’s Playwright config requires port `3002`, start the documented dev server first and keep unrelated e2e failures separate from this file.

- [ ] **Step 5: Commit responsive coverage**

```bash
git add e2e/tests/workspace-layout.spec.ts
git commit -m "test: cover responsive workspace layout"
```

## Task 7: Full Verification and Cleanup

**Files:**
- Modify only files identified by failing checks; do not stage unrelated pre-existing worktree changes.

- [ ] **Step 1: Run formatting and lint checks**

Run: `pnpm check` then `pnpm lint`.

Expected: both commands pass. Fix only formatting/lint issues introduced by the workspace migration.

- [ ] **Step 2: Run typecheck and focused unit tests**

Run: `npx tsc --noEmit` and `pnpm vitest run components/sky/layout/workspace-shell.test.tsx tests/sky/cloud-mind-quiz-page.test.tsx tests/sky/cloud-mind-slides.test.tsx tests/sky/cloud-mind-memory.test.tsx tests/sky/course-studio-page.test.tsx tests/sky/teaching-page.test.tsx`.

Expected: PASS with no new errors.

- [ ] **Step 3: Run the complete unit suite**

Run: `pnpm test`.

Expected: PASS, or document any pre-existing failures with exact test names and output.

- [ ] **Step 4: Run the responsive e2e suite**

Run: `pnpm test:e2e -- e2e/tests/workspace-layout.spec.ts`.

Expected: PASS at desktop, tablet, and mobile viewports.

- [ ] **Step 5: Audit the final diff**

Run: `git diff --stat`, `git diff --check`, and `git status --short`. Confirm no API, state-store, prompt, data, or unrelated user-modified files were staged.

- [ ] **Step 6: Commit final verification fixes**

```bash
git add components/sky/layout app/sky/cloud-mind/quiz/page.tsx components/sky/slides/slides-page.tsx components/sky/solve/solve-page.tsx app/sky/cloud-mind/solve/page.tsx app/sky/cloud-mind/memory/page.tsx components/sky/course-studio/course-studio-page.tsx app/sky/teaching/teaching-page.tsx app/sky/cloud-mind/teaching/page.tsx components/sky/teaching/teacher-workspace-page.tsx tests/sky e2e/tests/workspace-layout.spec.ts
git commit -m "feat: unify AI teaching workspace layouts"
```

## Self-Review

- Spec coverage: shared shell and tokens are covered by Task 1; all five generation/resource pages are covered by Tasks 2–4; intelligent teaching run mode is covered by Task 5; responsive behavior and acceptance checks are covered by Tasks 6–7.
- Completeness scan: every task names concrete files, commands, and expected outcomes, with no unspecified implementation steps.
- Type consistency: all pages consume the same `WorkspaceShell` slot names (`panel`, `main`, `aside`), and `mode` is restricted to `'edit' | 'run'` throughout.
- Scope protection: API routes, generation agents, stores, prompts, and user-modified unrelated files remain outside the migration unless a focused test proves a contract change is required.
