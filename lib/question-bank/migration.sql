-- Migration: Create question_bank dedicated table
-- Run this in your MySQL client after 004_mysql_storage.sql

USE sky_classroom;

CREATE TABLE IF NOT EXISTS question_bank (
  id               VARCHAR(64)  PRIMARY KEY,
  subject          VARCHAR(64)  NOT NULL DEFAULT '',
  grade            VARCHAR(32)  NOT NULL DEFAULT '',
  difficulty       VARCHAR(16)  NOT NULL DEFAULT 'medium'
                   CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question_type    VARCHAR(16)  NOT NULL DEFAULT 'solve'
                   CHECK (question_type IN ('choice', 'fill', 'solve', 'judge')),
  content          TEXT         NOT NULL,
  answer           TEXT         NOT NULL,
  explanation      TEXT         NOT NULL,
  knowledge_points JSON         NOT NULL,
  image            TEXT,
  options          JSON,
  source           VARCHAR(255),
  tags             JSON         NOT NULL,
  problem_hash     VARCHAR(64)  NOT NULL,
  verified         BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Dedup index: same content hash cannot be inserted twice
  UNIQUE INDEX uq_problem_hash (problem_hash),

  -- Filter indexes
  INDEX idx_subject    (subject),
  INDEX idx_difficulty (difficulty),
  INDEX idx_grade      (grade),
  INDEX idx_type       (question_type),
  INDEX idx_verified   (verified),

  -- Full-text search on content + explanation
  FULLTEXT INDEX ft_content (content, explanation) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
