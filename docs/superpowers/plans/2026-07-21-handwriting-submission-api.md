# Handwriting Submission API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist user-owned handwriting submissions and expose authenticated create, list, read, and status-transition APIs.

**Architecture:** Add a DAO over the existing `StorageProvider`, keeping ownership filtering and legal transitions in the domain layer. API routes resolve the current user from the access-token cookie and never accept a client-supplied user ID.

**Tech Stack:** Next.js 16 route handlers, TypeScript, unified storage, Vitest, `NextRequest`.

---

### Task 1: Handwriting submission DAO

**Files:**
- Create: `lib/handwriting/submission-dao.ts`
- Modify: `lib/handwriting/index.ts`
- Test: `tests/handwriting/submission-dao.test.ts`

- [ ] **Step 1: Write failing DAO tests**

```ts
const storage = new MemoryStorageProvider();
const dao = createHandwritingSubmissionDAO(storage);

const created = await dao.create({ userId: 'user-1', subject: 'math', title: '代数练习' });
expect(created.status).toBe('draft');
expect(await dao.getForUser(created.id, 'user-2')).toBeNull();
expect((await dao.listByUser('user-1')).items).toHaveLength(1);
expect((await dao.updateStatus(created.id, 'user-1', 'uploaded'))?.status).toBe('uploaded');
```

- [ ] **Step 2: Run test and verify RED**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting/submission-dao.test.ts`

Expected: FAIL because `createHandwritingSubmissionDAO` does not exist.

- [ ] **Step 3: Implement DAO methods**

Implement `create`, `getForUser`, `listByUser`, and `updateStatus`. Store records in `handwriting_submissions`; filter every read by `userId`; call `transitionSubmission` before a status update.

- [ ] **Step 4: Run DAO tests and verify GREEN**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting/submission-dao.test.ts`

Expected: PASS.

### Task 2: Authenticated collection route

**Files:**
- Create: `app/api/sky/handwriting/auth.ts`
- Create: `app/api/sky/handwriting/submissions/route.ts`
- Test: `tests/handwriting/submissions-route.test.ts`

- [ ] **Step 1: Write failing collection-route tests**

```ts
const response = await POST(new NextRequest(BASE, {
  method: 'POST',
  body: JSON.stringify({ subject: 'math', title: '函数练习' }),
}));
expect(response.status).toBe(201);
expect((await response.json()).submission.userId).toBe('user-1');

token.value = undefined;
expect((await POST(request)).status).toBe(401);

token.value = 'token-user-1';
expect((await POST(invalidSubjectRequest)).status).toBe(400);
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting/submissions-route.test.ts`

Expected: FAIL because the route does not exist.

- [ ] **Step 3: Implement strict auth, POST, and GET**

`resolveHandwritingUserId()` reads `access_token`, verifies it, and returns `payload.sub` or `null`. POST accepts only `math` or `physics`, creates a draft submission, and returns 201. GET lists only the authenticated user's records.

- [ ] **Step 4: Run collection-route tests and verify GREEN**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting/submissions-route.test.ts`

Expected: PASS.

### Task 3: Authenticated item route and legal status updates

**Files:**
- Create: `app/api/sky/handwriting/submissions/[submissionId]/route.ts`
- Test: `tests/handwriting/submission-route.test.ts`

- [ ] **Step 1: Write failing item-route tests**

```ts
const response = await GET(request, { params: Promise.resolve({ submissionId }) });
expect((await response.json()).submission.id).toBe(submissionId);

const updated = await PATCH(patchRequest('uploaded'), context);
expect((await updated.json()).submission.status).toBe('uploaded');

const illegal = await PATCH(patchRequest('graded'), context);
expect(illegal.status).toBe(409);
```

Also verify another user receives 404 rather than the submission.

- [ ] **Step 2: Run tests and verify RED**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting/submission-route.test.ts`

Expected: FAIL because the item route does not exist.

- [ ] **Step 3: Implement GET and PATCH**

GET uses `getForUser`. PATCH validates the target status against `HANDWRITING_SUBMISSION_STATUSES`, delegates to `updateStatus`, returns 404 for missing or foreign records, and returns 409 for illegal transitions.

- [ ] **Step 4: Run all second-batch tests**

Run: `node_modules/.bin/vitest.cmd run tests/handwriting`

Expected: all handwriting tests PASS.

- [ ] **Step 5: Run lint, formatting, and TypeScript attribution checks**

Run ESLint and Prettier for new files. Run full `tsc --noEmit`; report existing errors separately and require zero lines referencing the new handwriting files.

## Execution Status

- [x] Task 1 complete with RED/GREEN verification.
- [x] Task 2 complete with RED/GREEN verification.
- [x] Task 3 complete with RED/GREEN verification.
- [x] Verification complete: 30 handwriting tests pass; ESLint and Prettier pass; zero TypeScript error lines reference the new handwriting files.
