# Handwriting Page Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept up to 12 handwritten page images, validate and analyze them, store binary objects separately, persist page metadata, and attach pages to the authenticated submission.

**Architecture:** Keep file validation, pixel quality analysis, binary storage, page metadata, and HTTP handling in separate modules. The upload service validates and analyzes the entire batch before writing, preventing invalid files from causing partial metadata updates.

**Tech Stack:** Next.js multipart routes, TypeScript, `@napi-rs/canvas`, unified storage, Node filesystem, Vitest.

---

### Task 1: Restrict client-driven workflow transitions

**Files:**
- Modify: `app/api/sky/handwriting/submissions/[submissionId]/route.ts`
- Modify: `tests/handwriting/submission-route.test.ts`

- [x] Add a failing test proving clients cannot set internal workflow states such as `uploaded`.
- [x] Run the item-route test and verify it fails with the current 200 response.
- [x] Restrict public PATCH to `closed`; internal services continue using the DAO transition method.
- [x] Run the item-route test and verify it passes.

### Task 2: File validation and pixel quality analysis

**Files:**
- Create: `lib/handwriting/image-validation.ts`
- Create: `lib/handwriting/image-quality.ts`
- Modify: `lib/handwriting/index.ts`
- Test: `tests/handwriting/image-validation.test.ts`
- Test: `tests/handwriting/image-quality.test.ts`

- [x] Write failing tests for JPEG/PNG/WebP acceptance, empty files, unsupported types, and the 15 MB limit.
- [x] Implement `validateHandwritingImage(file)` with stable error codes.
- [x] Write failing tests using synthetic canvases: a tiny blank image must produce blocking quality issues; a high-resolution high-contrast image must decode and receive a higher score.
- [x] Implement `analyzeHandwritingImage(buffer)` using a maximum 512 px analysis canvas, grayscale values, Laplacian variance, overexposed ratio, and underexposed ratio.
- [x] Run both test files and verify green.

### Task 3: Binary object store and page metadata DAO

**Files:**
- Create: `lib/handwriting/object-store.ts`
- Create: `lib/handwriting/page-dao.ts`
- Modify: `lib/handwriting/submission-dao.ts`
- Modify: `lib/handwriting/index.ts`
- Test: `tests/handwriting/object-store.test.ts`
- Test: `tests/handwriting/page-dao.test.ts`

- [x] Write a failing object-store test with a temporary root and verify the generated key cannot escape the root.
- [x] Implement `LocalHandwritingObjectStore.put()` with sanitized path segments and MIME-based extensions.
- [x] Write failing page DAO tests for create/list and submission page attachment with a 12-page limit.
- [x] Implement `createHandwritingPageDAO` and `submissionDAO.attachPages`.
- [x] Run both tests and verify green.

### Task 4: Page ingestion service and upload API

**Files:**
- Create: `lib/handwriting/page-ingestion.ts`
- Create: `app/api/sky/handwriting/submissions/[submissionId]/pages/route.ts`
- Test: `tests/handwriting/page-ingestion.test.ts`
- Test: `tests/handwriting/pages-route.test.ts`

- [x] Write a failing service test proving invalid batches write nothing and valid batches return page quality metadata.
- [x] Implement validate-all -> analyze-all -> store-all -> persist-all -> attach-pages ordering.
- [x] Write failing route tests for authentication, ownership, missing images, valid upload, and more than 12 total pages.
- [x] Implement the authenticated multipart route. Allow uploads only for `draft`, `uploaded`, or `quality_rejected` submissions; move `draft` and `quality_rejected` to `uploaded` after attachment.
- [x] Return `{ pages, blockingIssues, canContinue }`.
- [x] Run all `tests/handwriting` tests.
- [x] Run ESLint, Prettier, and TypeScript error attribution.

## Execution Status

- [x] Task 1 complete.
- [x] Task 2 complete.
- [x] Task 3 complete.
- [x] Task 4 complete.
- [x] Verification complete.
