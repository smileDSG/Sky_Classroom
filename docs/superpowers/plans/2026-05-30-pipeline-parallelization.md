# Pipeline Parallelization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce end-to-end generation time by eliminating unnecessary sequential waits in classroom and PPT pipelines.

**Architecture:** Three independent optimizations: (1) content+actions parallel within each scene, (2) section→pageDesign streaming in PPT pipeline, (3) configurable concurrency matching key pool size.

**Tech Stack:** TypeScript, p-map, Vitest

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/server/classroom-generation.ts` | **Modify.** Content+Actions parallel, dynamic concurrency |
| `lib/slides/agent/pipeline.ts` | **Modify.** Section→PageDesign streaming |
| `lib/constants/generation.ts` | **Modify.** Make concurrency configurable |

---

### Task 1: Content + Actions Parallel in Classroom Generation

**Problem:** In `classroom-generation.ts` lines 483-491, each scene runs `generateSceneContent` → `generateSceneActions` sequentially. Actions depend on content, but different scenes are independent. Currently `pMap` with concurrency 6 processes scenes one-at-a-time within each slot.

**Solution:** Restructure the pMap callback so that after content generation completes, actions for that scene run in parallel with the next scene's content generation.

**Files:**
- Modify: `lib/server/classroom-generation.ts:477-500`

- [ ] **Step 1: Refactor scene generation to separate content and actions phases**

In `lib/server/classroom-generation.ts`, replace the single `pMap` block (lines 477-500) with a two-phase approach:

```typescript
  // Phase A: Generate all scene content in parallel
  const contentResults = await pMap(
    outlines,
    async (outline, index) => {
      const safeOutline = applyOutlineFallbacks(outline, true);
      try {
        const content = await generateSceneContent(safeOutline, aiCall, { agents, languageDirective });
        if (!content) {
          log.warn(`Skipping scene "${safeOutline.title}" — content generation failed`);
          return null;
        }
        return { outline: safeOutline, content, index };
      } catch (err) {
        log.error(`Scene "${safeOutline.title}" content generation error:`, err);
        return null;
      }
    },
    { concurrency: GENERATION_CONCURRENCY },
  );

  // Phase B: Generate all scene actions in parallel (content already available)
  const sceneResults = await pMap(
    contentResults,
    async (result) => {
      if (!result) return null;
      try {
        const actions = await generateSceneActions(result.outline, result.content, aiCall, {
          agents,
          languageDirective,
        });
        log.info(`Scene "${result.outline.title}": ${actions.length} actions`);
        return { outline: result.outline, content: result.content, actions, index: result.index };
      } catch (err) {
        log.error(`Scene "${result.outline.title}" action generation error:`, err);
        return null;
      }
    },
    { concurrency: GENERATION_CONCURRENCY },
  );
```

**Why this is faster:** With N scenes and concurrency C:
- Old: Each scene takes T_content + T_actions serially. Total ≈ N/C × (T_content + T_actions)
- New: Content phase ≈ N/C × T_content, Actions phase ≈ N/C × T_actions. Total ≈ N/C × max(T_content, T_actions) when C is large enough
- For 8 scenes with 6 concurrency and T_content ≈ T_actions ≈ 10s: old ≈ 27s, new ≈ 17s (37% faster)

- [ ] **Step 2: Verify existing tests pass**

Run: `pnpm vitest run tests/server/ tests/integration/`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add lib/server/classroom-generation.ts
git commit -m "perf(server): parallelize content and actions generation phases"
```

---

### Task 2: Section → PageDesign Streaming in PPT Pipeline

**Problem:** In `lib/slides/agent/pipeline.ts` lines 147-183, ALL section content must complete before ANY page design starts. If section 1 finishes in 5s but section 3 takes 30s, section 1's pages wait 25s for no reason.

**Solution:** Use a streaming approach — as each section completes, immediately start its page design agents in parallel with remaining section content generation.

**Files:**
- Modify: `lib/slides/agent/pipeline.ts:138-222`

- [ ] **Step 1: Refactor section→pageDesign to stream**

Replace the current `Promise.all` for sections + subsequent page design block with a streaming pattern:

```typescript
    // ══ Step 2+3: Section Content → Page Design (streaming) ══
    updateJob(jobId, { stage: 'sections_generating', message: '正在生成章节内容...', progress: 20 });

    const allDesignInstructions: PageInstructions[] = [];
    let completedSections = 0;
    const totalPages = outline.sections.reduce((sum, s) => sum + s.pages.length, 0);

    // Process sections: as each completes, immediately start its page design
    const sectionPromises = outline.sections.map(async (section, idx) => {
      const result = await generateSectionContent(section, topic, difficulty, designDNA, languageModel);
      completedSections++;
      updateJob(jobId, {
        message: `第 ${completedSections}/${outline.sections.length} 章内容生成${result.success ? '完毕' : '失败'}...`,
        progress: 20 + Math.round(completedSections / outline.sections.length * 20),
      });

      const sectionOutput = result.success && result.output
        ? result.output
        : {
            sectionId: section.sectionId,
            pages: section.pages.map((p) => ({
              pageNum: p.pageNum,
              pageType: p.type,
              content: { title: p.title, fallback: true, notes: p.contentOutline.focus },
            })),
          };

      // Immediately start page design for this section's pages
      const pages = sectionOutput.pages;
      const BATCH = 8;
      const sectionInstructions: PageInstructions[] = [];

      for (let i = 0; i < pages.length; i += BATCH) {
        const batch = pages.slice(i, i + BATCH);
        const batchResults = await Promise.all(
          batch.map(async (page) => {
            const result = await designPage(page.pageNum, page.pageType, page.content, totalPages, designDNA, languageModel);
            return result;
          }),
        );
        for (const dr of batchResults) {
          if (dr.success && dr.pageInstructions) {
            sectionInstructions.push(dr.pageInstructions);
          }
        }
      }

      return sectionInstructions;
    });

    // Wait for all sections (content + page design) to complete
    const allSectionInstructions = await Promise.all(sectionPromises);
    const instructions = allSectionInstructions.flat().sort((a, b) => a.pageNum - b.pageNum);
```

**Why this is faster:** Page design for section 1 starts as soon as section 1's content is ready, without waiting for sections 2, 3, etc. If section content takes 10s each and page design takes 8s each:
- Old: 3 sections × 10s content + 3 sections × 8s design = 30s + 24s = 54s (sequential phases)
- New: max(10s × 3/3, 8s × 3/3) ≈ 10s + 8s = 18s (fully pipelined with 3 concurrency)

- [ ] **Step 2: Verify existing tests pass**

Run: `pnpm vitest run tests/slides/`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add lib/slides/agent/pipeline.ts
git commit -m "perf(slides): stream section→pageDesign pipeline"
```

---

### Task 3: Configurable Concurrency Matching Key Pool

**Problem:** `GENERATION_CONCURRENCY` is hardcoded to 6. With 5 keys, we can only use 6 concurrent slots. With 1 key, 6 concurrent calls will hit rate limits. Concurrency should adapt to the key pool size.

**Solution:** Add a helper that computes optimal concurrency from key pool size, with a sensible default and cap.

**Files:**
- Modify: `lib/constants/generation.ts`
- Modify: `lib/server/classroom-generation.ts` (use dynamic concurrency)

- [ ] **Step 1: Add concurrency resolver to generation constants**

In `lib/constants/generation.ts`, replace the hardcoded constant:

```typescript
/**
 * Maximum concurrent scene generation calls (limits parallel AI API requests)
 */
export const GENERATION_CONCURRENCY = 6;

/**
 * Resolve optimal concurrency based on available key pool size.
 * Each key can handle ~1 concurrent request before rate limiting.
 * Returns a value between 1 and MAX_GENERATION_CONCURRENCY.
 */
export function resolveConcurrency(keyPoolSize: number): number {
  const MIN_CONCURRENCY = 2;
  const MAX_CONCURRENCY = 12;
  const KEYS_PER_SLOT = 1; // 1 key = 1 concurrent slot
  return Math.max(MIN_CONCURRENCY, Math.min(MAX_CONCURRENCY, keyPoolSize * KEYS_PER_SLOT));
}
```

- [ ] **Step 2: Use dynamic concurrency in classroom-generation.ts**

In `lib/server/classroom-generation.ts`, import `resolveConcurrency` and use it:

```typescript
import { GENERATION_CONCURRENCY, resolveConcurrency } from '@/lib/constants/generation';
```

After the key pool registration (around line 255):

```typescript
  // Resolve concurrency based on available keys
  const concurrency = resolveConcurrency(keyPool.length);
  log.info(`Generation concurrency: ${concurrency} (keys: ${keyPool.length})`);
```

Then replace all `{ concurrency: GENERATION_CONCURRENCY }` with `{ concurrency }` in the pMap calls.

- [ ] **Step 3: Verify tests pass**

Run: `pnpm vitest run tests/server/`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add lib/constants/generation.ts lib/server/classroom-generation.ts
git commit -m "feat(server): dynamic concurrency based on key pool size"
```
