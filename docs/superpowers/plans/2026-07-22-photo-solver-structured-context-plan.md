# Photo Solver Structured Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry recognized `ProblemSpec` through the photo-question workflow so routing and solver prompts use reliable subject, stage, conditions, formulas, and ambiguities.

**Architecture:** Add `ProblemSpec` to shared contracts, preserve it in client recognition, propagate it as an optional field through APIs/jobs/LangGraph, and centralize subject-first routing. Solver prompts receive a bounded structured-context block while legacy text-only requests remain supported.

**Tech Stack:** Next.js 16, React 19, TypeScript, LangGraph, Vitest.

---

### Task 1: Shared ProblemSpec and subject routing

**Files:** `lib/solve/types.ts`, `lib/solve/solver-constants.ts`, `tests/solve/solver-constants.test.ts`

- [ ] Write failing subject-aware routing tests.
- [ ] Run the focused test and verify RED.
- [ ] Define shared structured types and implement subject-first routing with text fallback.
- [ ] Re-run and verify GREEN.

### Task 2: Structured solver prompt grounding

**Files:** `lib/solve/solver-prompts.ts`, `tests/solve/solver-prompts.test.ts`

- [ ] Write a failing test for all structured context fields and the image-conflict rule.
- [ ] Run the focused test and verify RED.
- [ ] Add an optional `problemSpec` parameter and controlled context serializer.
- [ ] Re-run and verify GREEN.

### Task 3: LangGraph propagation and unified routing

**Files:** `lib/solve/solve-graph-state.ts`, `lib/solve/solve-graph.ts`, `lib/solve/solver-agent.ts`, `lib/solve/streaming-solver.ts`, `tests/solve/solve-graph.test.ts`

- [ ] Write failing state/routing tests.
- [ ] Run and verify RED.
- [ ] Propagate `problemSpec`, centralize routing, and pass it to solver prompts.
- [ ] Re-run and verify GREEN.

### Task 4: API, job, and client propagation

**Files:** `lib/recognition/image-recognizer.ts`, `components/sky/solve/solve-page.tsx`, solve API routes, `lib/server/solve-job-runner.ts`, relevant tests.

- [ ] Write failing propagation and legacy-compatibility tests.
- [ ] Run and verify RED.
- [ ] Retain `structuredProblems`, select the active spec, and forward it through sync, stream, and job paths.
- [ ] Re-run and verify GREEN.

### Task 5: Verification

- [ ] Run recognition and solve tests.
- [ ] Run ESLint on changed files.
- [ ] Review diff and preserve unrelated user files.
