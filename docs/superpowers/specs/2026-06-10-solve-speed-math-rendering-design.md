# Solve Speed & Math Rendering Optimization Design

Date: 2026-06-10

## Problem

1. **Solve speed**: Photo-to-first-result takes >10s. Main causes: serial OCR fallback (3 models × 5-10s), serial analyze→solve chain, verify step blocks done signal, knowledge/similar generation blocks completion.
2. **Math rendering**: Formulas show as raw source code, complex formulas render incorrectly, formula/text mixing is broken. Main causes: duplicate server+client preprocessing, no fast-path for already-correct LaTeX, missing environment normalization, no KaTeX output caching.

## Goals

- First step result in <5s (from >10s)
- Math rendering accuracy >90% (from ~70%)

## Design

### A. Solve Speed (6 changes)

#### A1. OCR Parallel Racing

File: `app/api/sky/solve/recognize/route.ts`

Replace serial `for` loop with `Promise.any()`. Each model wrapped in 8s timeout. First success wins. All-fail returns aggregated error.

#### A2. Analyze & Solve Parallel Launch

File: `lib/solve/solve-chain.ts`

Start solve immediately with `universal` model (DeepSeek V4 Flash, fastest). Analyze runs in parallel. If analyze result indicates a different agent type is needed, append a correction step after solve completes using the correct model.

#### A3. Enhanced Verify Skip

File: `lib/solve/solve-chain.ts`

- Lower confidence threshold from 0.8 to 0.7
- Skip verify for pure numeric answers (detected by regex)
- Skip verify for short problems (<50 chars)

#### A4. Non-blocking Done Signal

Files: `app/api/sky/solve/explain-stream/route.ts`, `lib/solve/solve-chain.ts`

Emit `done` event as soon as solve completes (has answer). Knowledge and similar events are emitted asynchronously after `done`. UI shows placeholder states for pending sections.

#### A5. First Token Event

File: `app/api/sky/solve/explain-stream/route.ts`

Add `first_token` SSE event emitted when the LLM stream starts producing output. Client can show "AI 正在解题..." animation earlier.

#### A6. Cache Fast Path

File: `app/api/sky/solve/explain-stream/route.ts`

Cache hits bypass all post-processing. Cache entries store pre-processed content (already postProcessMathContent'd).

### B. Math Rendering (4 changes)

#### B1. Unified Preprocessing — Server Minimal, Client Full

Files: `lib/solve/math-postprocessor.ts`, `components/sky/solve/math-renderer.tsx`

Server-side `postProcessMathContent` reduced to: Unicode→LaTeX conversion + JSON escape fix + double-backslash normalization only. All `$...$` wrapping logic removed from server.

Client-side `wrapBareLatex` remains the single source of truth for wrapping. Eliminates double-wrapping risk.

#### B2. Tiered Rendering — Fast Path + Full Path

File: `components/sky/solve/math-renderer.tsx`

Before running full `wrapBareLatex` (260+ regex patterns), check if content is already well-formed:
- If content only contains `$...$` and `$$...$$` delimited math with no bare `\command` outside delimiters → fast path: parse directly, skip BARE_LATEX_PATTERNS
- Otherwise → full path: existing wrapBareLatex

Reduces rendering time for well-formed LLM output by ~70%.

#### B3. KaTeX Output Cache

File: `components/sky/solve/math-renderer.tsx`

Add module-level `Map<string, string>` cache for KaTeX HTML output. Key = math expression string, Value = rendered HTML. Cache capped at 2000 entries with LRU eviction.

#### B4. Extended Environment Normalization

File: `components/sky/solve/math-renderer.tsx`

Add environment aliases for: `cases`→`cases` (keep), `split`→`aligned`, `array`→`aligned`, `tabular`→`aligned`, `equation*` (keep), `eqnarray*`→`aligned`. Also handle `\begin{cases}` which KaTeX supports natively — ensure it's not incorrectly converted.

## Affected Files

1. `app/api/sky/solve/recognize/route.ts` — A1
2. `lib/solve/solve-chain.ts` — A2, A3
3. `app/api/sky/solve/explain-stream/route.ts` — A4, A5, A6
4. `lib/solve/math-postprocessor.ts` — B1
5. `components/sky/solve/math-renderer.tsx` — B1, B2, B3, B4
6. `components/sky/solve/solution-panel.tsx` — A4 (placeholder states)

## Metrics

- First-step latency: target <5s
- Cache hit rate: monitor via existing logging
- KaTeX cache hit rate: add logging
- Rendering: manual test with 10+ math problems covering fractions, integrals, matrices, Greek letters
