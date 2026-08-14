-- Agent capability data: intervention decisions and observed learner outcomes.

CREATE TABLE IF NOT EXISTS intervention_decisions (
  decision_id          VARCHAR(255) PRIMARY KEY,
  user_id              VARCHAR(255) NOT NULL,
  session_id           VARCHAR(255) NOT NULL,
  state_snapshot       JSON NOT NULL,
  reflection_snapshot  JSON,
  candidate_plans      JSON NOT NULL,
  selected_plan        JSON,
  fallback_used        BOOLEAN NOT NULL DEFAULT FALSE,
  model_id             VARCHAR(255),
  correlation_id       VARCHAR(255) NOT NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_intervention_user_created (user_id, created_at),
  INDEX idx_intervention_correlation (correlation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learner_outcomes (
  outcome_id           VARCHAR(255) PRIMARY KEY,
  decision_id          VARCHAR(255) NOT NULL,
  user_id              VARCHAR(255) NOT NULL,
  window_start         DATETIME NOT NULL,
  window_end           DATETIME NOT NULL,
  correct_count        INT NOT NULL DEFAULT 0,
  question_count       INT NOT NULL DEFAULT 0,
  correct_rate         DECIMAL(6,5) NOT NULL DEFAULT 0,
  duration_seconds     INT NOT NULL DEFAULT 0,
  completed            BOOLEAN NOT NULL DEFAULT FALSE,
  exited               BOOLEAN NOT NULL DEFAULT FALSE,
  error_types          JSON NOT NULL,
  next_decision_id     VARCHAR(255),
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_outcome_decision (decision_id),
  INDEX idx_outcome_user_created (user_id, created_at),
  INDEX idx_outcome_decision (decision_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
