---
dataset_info:
  features:
  - name: user_id
    dtype: int64
  - name: skill_ids
    sequence: string
  - name: skill_names
    sequence: string
  - name: grades
    sequence: string
  - name: attempt_counts
    sequence: int64
  - name: answer_types
    sequence: string
  splits:
  - name: train
    num_bytes: 16652159
    num_examples: 4148
  download_size: 532565
  dataset_size: 16652159
configs:
- config_name: default
  data_files:
  - split: train
    path: data/train-*
---
