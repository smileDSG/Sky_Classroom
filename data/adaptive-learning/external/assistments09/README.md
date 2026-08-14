# ASSISTments09 Offline Evaluation Source

- Source dataset: [Atomi/ASSISTments2009](https://huggingface.co/datasets/Atomi/ASSISTments2009)
- Dataset revision: `c72a664a9693547fb206652ed2ce18e62d320c7d`
- Downloaded file: `data/train-00000-of-00001.parquet`
- Observed rows: 4,148 learner sequences / 274,331 flattened interactions
- Fields used: `user_id`, `skill_ids`, `skill_names`, `grades`, `attempt_counts`, `answer_types`

## Limitations

This derivative dataset does not provide reliable event timestamps, question IDs, or item difficulty.
The normalizer therefore uses sequence order as a synthetic timestamp and `0` as a neutral difficulty.
Results are suitable for offline model plumbing and regression checks, not production claims.

Check the upstream dataset terms before redistribution or commercial use. Keep this data outside the
production learner store.
