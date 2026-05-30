-- Knowledge Base table for persistent RAG storage
-- Run this against your MySQL sky_classroom database

CREATE TABLE IF NOT EXISTS knowledge_base (
  id VARCHAR(64) NOT NULL,
  kb_type VARCHAR(32) NOT NULL COMMENT 'solve | slides | cards | classroom',
  doc_id VARCHAR(64) NOT NULL,
  doc_title TEXT NOT NULL,
  chunk_index INT NOT NULL DEFAULT 0,
  total_chunks INT NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  tags JSON DEFAULT NULL,
  source_id VARCHAR(128) DEFAULT NULL COMMENT 'jobId, questionHash, etc.',
  verified TINYINT(1) NOT NULL DEFAULT 0,
  usage_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_kb_type (kb_type),
  INDEX idx_source (source_id),
  INDEX idx_verified (verified),
  INDEX idx_doc_id (doc_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
