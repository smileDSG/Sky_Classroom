# Photo Solver Evaluation Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic offline and opt-in live evaluation framework for the photo-question solver, with 20 seed cases and JSON/Markdown reports.

**Architecture:** A validated JSONL dataset feeds interchangeable offline/live adapters. Pure metric modules score recognition, retrieval, answers, rejection, evidence coverage, and engineering measurements; a runner aggregates results and a CLI writes stable reports.

**Tech Stack:** TypeScript 5, TSX, Zod 4, Vitest 4, existing photo-solver modules.

---

### Task 1: Dataset contracts and loader

**Files:**
- Create: `evals/photo-solver/types.ts`
- Create: `evals/photo-solver/dataset-loader.ts`
- Create: `tests/evals/photo-solver/dataset-loader.test.ts`

- [ ] Write failing tests for valid JSONL loading, invalid required fields, duplicate IDs, and optional missing real-image paths.
- [ ] Run `node_modules\\.bin\\vitest.cmd run tests/evals/photo-solver/dataset-loader.test.ts` and verify failures are caused by missing loader code.
- [ ] Define Zod schemas for cases, documents, adapter results, per-case scores, and reports.
- [ ] Implement line-aware JSONL parsing, duplicate detection, filter support, and dataset validation.
- [ ] Re-run the focused test and verify it passes.
- [ ] Commit with `feat: add photo solver eval dataset contracts`.

### Task 2: Pure recognition, retrieval, and answer metrics

**Files:**
- Create: `evals/photo-solver/metrics/normalization.ts`
- Create: `evals/photo-solver/metrics/recognition.ts`
- Create: `evals/photo-solver/metrics/retrieval.ts`
- Create: `evals/photo-solver/metrics/answer.ts`
- Create: `tests/evals/photo-solver/metrics.test.ts`

- [ ] Write failing table-driven tests for normalized exact match, aliases, numeric tolerance, subject/stage/type accuracy, stem similarity, formula/given recall, Hit@K, Precision@K, Recall@K, MRR, rejection accuracy, and evidence coverage.
- [ ] Run the focused test and verify RED.
- [ ] Implement deterministic pure functions with zero API dependencies.
- [ ] Re-run and verify GREEN.
- [ ] Commit with `feat: add photo solver evaluation metrics`.

### Task 3: Offline adapter and 20 seed cases

**Files:**
- Create: `evals/photo-solver/adapters/types.ts`
- Create: `evals/photo-solver/adapters/offline-adapter.ts`
- Create: `evals/photo-solver/dataset/cases.jsonl`
- Create: `evals/photo-solver/dataset/documents.jsonl`
- Create: `evals/photo-solver/dataset/images/.gitkeep`
- Create: `tests/evals/photo-solver/offline-adapter.test.ts`

- [ ] Write failing tests proving fixture outputs are deterministic and preserve timing/usage defaults.
- [ ] Run and verify RED.
- [ ] Implement the adapter interface and offline fixture adapter.
- [ ] Add 20 schema-valid cases: 10 synthetic and 10 real-image manifests; distribute them across 6 junior-high, 8 senior-high, 6 university cases and 14 science, 6 humanities cases.
- [ ] Add documents covering normal, noisy, no-answer, counterfactual, and multi-document conditions.
- [ ] Re-run and verify GREEN.
- [ ] Commit with `feat: add photo solver offline evaluation fixtures`.

### Task 4: Runner, aggregation, and reports

**Files:**
- Create: `evals/photo-solver/runner.ts`
- Create: `evals/photo-solver/report/report-writer.ts`
- Create: `tests/evals/photo-solver/runner.test.ts`
- Create: `tests/evals/photo-solver/report-writer.test.ts`

- [ ] Write failing tests for complete 20-case execution, subject/stage/tag aggregation, skipped cases, live failures that do not abort the run, and stable JSON/Markdown output.
- [ ] Run and verify RED.
- [ ] Implement per-case scoring and aggregate counters/rates.
- [ ] Implement atomic report writing to `evals/photo-solver/reports/latest.json` and `latest.md`.
- [ ] Re-run and verify GREEN.
- [ ] Commit with `feat: add photo solver evaluation runner`.

### Task 5: CLI and live adapter boundary

**Files:**
- Create: `evals/photo-solver/cli.ts`
- Create: `evals/photo-solver/adapters/live-adapter.ts`
- Modify: `package.json`
- Create: `tests/evals/photo-solver/cli.test.ts`

- [ ] Write failing tests for default offline mode, `--mode live`, subject/stage filters, invalid flags, and report paths.
- [ ] Run and verify RED.
- [ ] Implement argument parsing and `eval:photo-solver` package script.
- [ ] Implement the live adapter boundary using existing recognition/solve modules where callable; mark unavailable browser-only recognition or missing images as skipped with explicit reasons.
- [ ] Ensure credentials and authorization data are never serialized.
- [ ] Re-run and verify GREEN.
- [ ] Commit with `feat: add photo solver evaluation cli`.

### Task 6: Full verification and baseline

**Files:**
- Verify all files above.
- Generate: `evals/photo-solver/reports/latest.json`
- Generate: `evals/photo-solver/reports/latest.md`

- [ ] Run `node_modules\\.bin\\vitest.cmd run tests/evals/photo-solver tests/recognition tests/solve`.
- [ ] Run `node_modules\\.bin\\eslint.cmd evals/photo-solver tests/evals/photo-solver`.
- [ ] Run `pnpm eval:photo-solver` twice and verify deterministic aggregate results.
- [ ] Inspect both reports for all 20 cases, grouped metrics, failure/skip reasons, latency, usage, and no secrets.
- [ ] Run `git diff --check` and confirm unrelated workspace changes remain untouched.
- [ ] Commit with `test: establish photo solver evaluation baseline`.
