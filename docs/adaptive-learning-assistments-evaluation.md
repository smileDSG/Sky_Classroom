# ASSISTments Offline Evaluation

## Purpose

Use a public ASSISTments09 derivative to test the ability-model data path when
real learner data is not available. This validates parsing, ordering, replay,
and metric plumbing. It does not prove that the model improves this product's
real users.

## Source

- Dataset: [Atomi/ASSISTments2009](https://huggingface.co/datasets/Atomi/ASSISTments2009)
- Revision: `c72a664a9693547fb206652ed2ce18e62d320c7d`
- Local source: `data/adaptive-learning/external/assistments09/`

The source contains ordered skill sequences and correctness, but no reliable
timestamps, question IDs, or item difficulty. The normalizer makes those
limitations explicit: sequence order becomes a synthetic timestamp and item
difficulty is neutral (`0`).

## Reproduce

```powershell
python scripts/adaptive-learning/normalize-assistments.py `
  --input data/adaptive-learning/external/assistments09/train-00000-of-00001.parquet `
  --output data/adaptive-learning/external/assistments09/normalized.sample.jsonl `
  --max-events 5000

pnpm vitest run tests/adaptive-learning/assistments-dataset.test.ts
```

The checked-in sample contains 5,000 normalized interactions and is consumed
by a Vitest regression test. The raw source and derived sample must stay out of
the production learner store. Verify upstream terms before redistribution or
commercial use.
