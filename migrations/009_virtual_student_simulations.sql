CREATE TABLE IF NOT EXISTS virtual_student_simulations (
  run_id       VARCHAR(255) PRIMARY KEY,
  profile_id   VARCHAR(80) NOT NULL,
  topic        VARCHAR(255) NOT NULL,
  model_mode   VARCHAR(40) NOT NULL,
  turns        JSON NOT NULL,
  events       JSON NOT NULL,
  completed    BOOLEAN NOT NULL DEFAULT FALSE,
  exited       BOOLEAN NOT NULL DEFAULT FALSE,
  failure_reasons JSON NOT NULL,
  metrics      JSON NOT NULL,
  source       VARCHAR(40) NOT NULL DEFAULT 'simulation',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_virtual_sim_profile_created (profile_id, created_at),
  INDEX idx_virtual_sim_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
