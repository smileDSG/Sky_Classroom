# Cloud Mind Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce cloud-mind AI latency by routing agents through the unified LLM layer and caching repeat generations.

**Architecture:** Keep each cloud-mind agent's public API unchanged. Add one focused in-memory cache module under `lib/agents/cloud-mind/`, then wire quiz, memory cards, slides analysis, translation, and writing through `callLLM` or `streamLLM` so they inherit key rotation, timeout handling, thinking configuration, and performance telemetry.

**Tech Stack:** Next.js API routes, Vercel AI SDK, Vitest, TypeScript, existing 智眸无界 provider configuration.

---

### Task 1: Cloud-Mind Cache Utility

**Files:**
- Create: `lib/agents/cloud-mind/cache.ts`
- Test: `tests/agents/cloud-mind-cache.test.ts`

- [x] **Step 1: Write the failing cache tests**

The test file verifies stable key generation, defensive cloning, TTL expiry, and LRU-style eviction.

Run: `pnpm vitest run tests/agents/cloud-mind-cache.test.ts`

Expected before implementation: fail because `@/lib/agents/cloud-mind/cache` does not exist.

- [x] **Step 2: Implement cache helpers**

Create `buildCloudMindCacheKey`, `getCloudMindCache`, `setCloudMindCache`, `clearCloudMindCache`, and `getCloudMindCacheStats`.

- [x] **Step 3: Run cache tests**

Run: `pnpm vitest run tests/agents/cloud-mind-cache.test.ts`

Expected after implementation: all tests pass.

### Task 2: Unified LLM Routing

**Files:**
- Modify: `lib/agents/cloud-mind/quiz-agent.ts`
- Modify: `lib/agents/cloud-mind/memory-cards-agent.ts`
- Modify: `lib/agents/cloud-mind/slides-agent.ts`
- Modify: `lib/agents/cloud-mind/translate-agent.ts`
- Modify: `lib/agents/cloud-mind/write-agent.ts`

- [x] **Step 1: Replace direct AI SDK calls**

Use `getModel({ providerId: 'deepseek', modelId: 'deepseek-chat', apiKey, baseUrl })` plus `callLLM` for non-streaming calls and `streamLLM` for streaming calls.

- [x] **Step 2: Preserve current behavior**

Keep the same prompts, temperatures, return structures, API route contracts, and parsing behavior.

- [x] **Step 3: Add dynamic token budgets**

Keep generous ceilings for long tasks, but scale quiz output by question count and memory-card output by requested card count.

### Task 3: Cache Agent Results

**Files:**
- Modify: `lib/agents/cloud-mind/quiz-agent.ts`
- Modify: `lib/agents/cloud-mind/memory-cards-agent.ts`
- Modify: `lib/agents/cloud-mind/slides-agent.ts`

- [x] **Step 1: Build cache keys from stable inputs**

Use prompt-shaping inputs such as topic, subject, difficulty, count, content hash, personalization, and profile context.

- [x] **Step 2: Return cached results before LLM work**

Check cache at the start of each generation function so repeat requests skip retrieval and model calls.

- [x] **Step 3: Store normalized parsed results**

Cache only validated final outputs after JSON parsing and normalization succeeds.

### Task 4: Documentation and Verification

**Files:**
- Modify: `docs/cloud-mind-upgrade-plan.md`
- Modify: `docs/superpowers/plans/2026-06-25-cloud-mind-speed.md`

- [x] **Step 1: Document shipped acceleration**

Add a performance section describing unified LLM routing, cache scope, token controls, and the deferred streaming split.

- [x] **Step 2: Run verification**

Run:

```bash
pnpm vitest run tests/agents/cloud-mind-cache.test.ts
npx tsc --noEmit
```

Expected: cache tests pass; typecheck passes or any unrelated pre-existing failures are recorded in the final response.

Result: cache tests pass. Full typecheck is blocked by existing unrelated errors outside this change set, including `app/api/dev/seed-mistakes/route.ts`, `components/account/personalization-form.tsx`, slide-agent pipeline typings, storage provider typings, and multiple legacy integration tests.
