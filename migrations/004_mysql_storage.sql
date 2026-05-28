-- Migration: Create storage tables for MySQL
-- Run this in your MySQL client

CREATE DATABASE IF NOT EXISTS sky_classroom
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE sky_classroom;

-- Generic key-value storage table (used by all DAOs)
CREATE TABLE IF NOT EXISTS storage_entries (
  id          VARCHAR(255) NOT NULL,
  table_name  VARCHAR(128) NOT NULL,
  data        JSON NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id, table_name),
  INDEX idx_storage_table (table_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
