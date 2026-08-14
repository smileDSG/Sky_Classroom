CREATE TABLE IF NOT EXISTS learner_reflections (
  reflection_id       VARCHAR(255) PRIMARY KEY,
  user_id             VARCHAR(255) NOT NULL,
  window_start        DATETIME NOT NULL,
  window_end          DATETIME NOT NULL,
  hypotheses          JSON NOT NULL,
  source_event_ids    JSON NOT NULL,
  model_id            VARCHAR(255) NOT NULL,
  generated_at        DATETIME NOT NULL,
  input_event_watermark INT NOT NULL DEFAULT 0,
  INDEX idx_reflection_user_generated (user_id, generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
