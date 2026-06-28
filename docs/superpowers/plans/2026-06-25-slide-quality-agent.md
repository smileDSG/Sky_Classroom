# Slide Quality Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make classroom slide generation richer, more polished, and continuously checked for thin content, weak visuals, poor readability, and layout defects.

**Architecture:** Extend the existing deterministic `layout-guard-agent` into a broader slide quality gate, then feed those signals into `quality-scorer` and `slide-polish`. Prompt contracts remain the first line of defense; deterministic checks catch model drift after generation.

**Tech Stack:** TypeScript, Vitest, Markdown prompt templates, existing OpenMAIC-style element DSL.

---

### Task 1: Add Slide Quality Audit Tests

**Files:**
- Modify: `tests/slides/agent/layout-guard-agent.test.ts`
- Modify: `tests/generation/quality-scorer.test.ts`

- [x] Add tests that expect the guard to report:
  - text-only or nearly text-only slides
  - missing dominant visual anchor
  - too few learning text blocks
  - insufficient visual hierarchy
- [x] Add tests that expect `scoreSlideContent` to penalize thin slides and reward rich OpenMAIC-style slides.
- [x] Run `pnpm vitest run tests/slides/agent/layout-guard-agent.test.ts tests/generation/quality-scorer.test.ts` and confirm the new tests fail for the expected reason.

### Task 2: Implement Deterministic Slide Richness Checks

**Files:**
- Modify: `lib/slides/agent/layout-guard-agent.ts`
- Modify: `lib/generation/quality-scorer.ts`

- [x] Add issue types for `missing_visual_anchor`, `low_content_richness`, and `weak_visual_hierarchy`.
- [x] Detect meaningful visual anchors by element type and area coverage.
- [x] Count meaningful text blocks after stripping HTML.
- [x] Penalize slides that are all text, too sparse, or have flat typography.
- [x] Keep existing repair behavior for small text, low contrast, and text outside cards.
- [x] Re-run the tests and confirm they pass.

### Task 3: Strengthen Prompt Contracts And Documentation

**Files:**
- Modify: `lib/prompts/templates/slide-content/system.md`
- Modify: `lib/prompts/templates/slide-content/user.md`
- Modify: `lib/prompts/templates/requirements-to-outlines/system.md`
- Modify: `lib/prompts/templates/requirements-to-outlines/user.md`
- Create: `docs/slide-quality-agent.md`

- [x] Add a concise “Slide Richness Contract” to prompt templates.
- [x] Document the quality agent’s checks, thresholds, and generation flow.
- [x] Run targeted Vitest and ESLint on touched TypeScript files.
