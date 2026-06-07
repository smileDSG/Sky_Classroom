-- Migration: Create users table for Supabase
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,
  email         TEXT UNIQUE,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('guest', 'user', 'admin')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  guest_id      TEXT UNIQUE,
  plan_type     TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'basic', 'pro', 'enterprise')),

  -- Profile
  avatar        TEXT,
  nickname      TEXT,
  bio           TEXT,

  -- Email verification
  email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  email_verify_token  TEXT,

  -- Password reset
  reset_token         TEXT,
  reset_token_expiry  TIMESTAMPTZ,

  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email_verify_token ON users (email_verify_token);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token);

-- Generic storage table (optional, for the SupabaseStorageProvider)
CREATE TABLE IF NOT EXISTS storage_entries (
  id          TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, table_name)
);

CREATE INDEX IF NOT EXISTS idx_storage_entries_table ON storage_entries (table_name);
