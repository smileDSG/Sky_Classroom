# Photo Solver Evaluation Framework Design

**Date:** 2026-07-22

## Goal

Build a repeatable evaluation framework for the photo-question solver that measures recognition, retrieval, answer quality, robustness, latency, and cost before introducing model training.

## Scope

The first release contains 20 seed cases:

- 10 real-photo cases with annotated manifests and replaceable image paths.
- 10 deterministic synthetic cases that run immediately in CI.
- Stage distribution: 6 junior-high, 8 senior-high, 6 university.
- Subject distribution: 14 science and 6 humanities cases.
- Question types include choice, fill, calculation, proof, and subjective response.

The first release does not train models, depend on an external evaluation platform, or use an LLM judge for subjective answers.

## Operating Modes

### Offline

Uses deterministic recognition, retrieval, and solver fixtures. It runs without model API keys and is suitable for CI and regression comparisons.

### Live

Calls the real recognition, retrieval, and solver pipeline. It records accuracy, latency, token use, estimated cost, and failures. A missing image or unavailable provider skips only the affected case.

## Architecture

```text
Dataset manifest
  -> case loader and validator
  -> offline or live runner
  -> recognition metrics
  -> retrieval metrics
  -> answer and robustness metrics
  -> JSON report and Markdown summary
```

The implementation remains inside the existing TypeScript/Vitest toolchain. Metric functions are pure and independently testable. Runners depend on adapters so the offline fixtures and live application pipeline share the same scoring code.

## Dataset Contract

Each JSONL case contains:

```json
{
  "id": "high-physics-001",
  "mode": "real",
  "stage": "高中",
  "subject": "物理",
  "questionType": "选择题",
  "imagePath": "images/high-physics-001.png",
  "inputText": "",
  "expectedProblemSpec": {},
  "offlineRecognition": {},
  "standardAnswer": "B",
  "answerAliases": ["B", "选项B"],
  "goldDocumentIds": ["physics-001"],
  "requiredEvidence": ["机械能守恒"],
  "shouldReject": false,
  "tags": ["clear", "formula"]
}
```

Required identifiers and labels are validated before execution. Real-image cases may temporarily reference missing files; offline mode uses `offlineRecognition`, while live mode marks them skipped with a reason.

## Metrics

### Recognition

- Stage accuracy.
- Subject accuracy.
- Question-type accuracy.
- Normalized stem similarity.
- Formula recall.
- Given-condition recall.
- Option accuracy.

### Retrieval

- Hit@1, Hit@3, Hit@5.
- Precision@K.
- Recall@K.
- Mean reciprocal rank.

### Generation

- Exact match after normalization.
- Answer-alias match.
- Numeric match with configurable absolute and relative tolerance.
- Evidence coverage as the initial deterministic faithfulness proxy.
- Rejection accuracy for cases whose evidence is insufficient.
- Subjective cases are marked for human review instead of receiving an unreliable automatic score.

### Robustness

Cases may be tagged or expanded into:

- Normal evidence.
- Noisy evidence.
- No-answer evidence.
- Counterfactual evidence.
- Multi-document evidence.

Reports aggregate accuracy by robustness category and noise level.

### Engineering

- Per-stage latency and total latency.
- Token usage where providers expose it.
- Estimated cost where model pricing is configured.
- Failure rate and skipped-case rate.

## Modules

```text
evals/photo-solver/
├── dataset/
│   ├── cases.jsonl
│   ├── documents.jsonl
│   └── images/
├── adapters/
│   ├── types.ts
│   ├── offline-adapter.ts
│   └── live-adapter.ts
├── metrics/
│   ├── recognition.ts
│   ├── retrieval.ts
│   └── answer.ts
├── report/
│   └── report-writer.ts
├── runner.ts
└── cli.ts
```

Tests mirror these modules under `tests/evals/photo-solver/`.

## Data Flow

1. CLI parses mode and filters.
2. Loader reads and validates JSONL cases.
3. Adapter returns recognition, retrieved documents, answer, evidence, timing, and usage.
4. Metric modules compare results with gold annotations.
5. Runner aggregates individual and grouped scores.
6. Writer produces `reports/latest.json` and `reports/latest.md`.
7. The process exits non-zero only for invalid configuration, invalid dataset structure, or an offline regression threshold failure. Individual live-provider failures remain report entries.

## Commands

```bash
pnpm eval:photo-solver
pnpm eval:photo-solver -- --mode live
pnpm eval:photo-solver -- --subject math
```

The default command uses offline mode.

## Error Handling

- Invalid dataset records fail before evaluation starts and identify the record and field.
- Missing real images are accepted offline and skipped live.
- Provider failures are recorded per case with provider and error message.
- Reports are still produced after individual live-case failures.
- Secret keys, full authorization headers, and raw provider credentials are never written to reports.

## Testing

- TDD for every metric function.
- Dataset schema and malformed-record tests.
- Deterministic offline end-to-end runner test.
- Report snapshot/structure tests.
- CLI filter tests.
- Live adapter remains opt-in and is excluded from standard CI.

## Success Criteria

- All 20 seed cases load successfully in offline mode.
- Offline evaluation is deterministic across repeated runs.
- JSON and Markdown reports contain per-case details and aggregate scores.
- Recognition, retrieval, answer, rejection, robustness, latency, and skip metrics are represented.
- Existing photo-solver tests remain green.
