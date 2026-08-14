# Core QA Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the question-bank 500 and missing About page, then prevent root quality checks from scanning the nested repository.

**Architecture:** Keep changes surgical. The database fix changes only schema declarations, the About fix adds one static route, and tool exclusions are configuration-only changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, MySQL, ESLint, Prettier.

---

### Task 1: MySQL-compatible question-bank schema

**Files:**
- Modify: `tests/question-bank/dao.test.ts`
- Modify: `lib/question-bank/dao.ts`
- Modify: `lib/question-bank/migration.sql`

- [ ] Add a test that captures the `CREATE TABLE` statement and rejects defaults on `TEXT` and `JSON` columns.
- [ ] Run `pnpm vitest run tests/question-bank/dao.test.ts` and confirm the new test fails.
- [ ] Remove the invalid defaults from the runtime schema and migration SQL.
- [ ] Re-run the targeted test and confirm it passes.
- [ ] Request the authenticated question-bank API and confirm status 200.

### Task 2: About route

**Files:**
- Create: `app/about/page.tsx`
- Create: `tests/components/about-page.test.tsx`

- [ ] Add a page test expecting the 智眸无界 name, open-source description, and license link.
- [ ] Run the test and confirm it fails because the page does not exist.
- [ ] Add a static About page using existing Tailwind and Link patterns.
- [ ] Re-run the test and confirm it passes.
- [ ] Request `/about` and confirm status 200.

### Task 3: Root-tool exclusions

**Files:**
- Modify: `.prettierignore`
- Modify: `eslint.config.mjs`
- Modify: `tsconfig.json`
- Modify: `vitest.config.ts`

- [ ] Add `software-cup-A3/**` and `.gstack/**` to supported exclusion lists.
- [ ] Run focused configuration checks to prove the nested repository is no longer reported.
- [ ] Run production build and targeted tests.

### Task 4: Final verification

- [ ] Run `pnpm vitest run tests/question-bank/dao.test.ts tests/components/about-page.test.tsx`.
- [ ] Verify `/api/sky/question-bank?page=1&limit=20` and `/about` in an authenticated browser session.
- [ ] Run `pnpm build`.
- [ ] Confirm no user-owned changes were overwritten.
