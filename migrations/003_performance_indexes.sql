-- Migration: Add performance indexes for high-concurrency operations
-- Run this in the Supabase SQL Editor

-- Storage entries: composite index for table_name + id lookups
CREATE INDEX IF NOT EXISTS idx_storage_table_id ON storage_entries (table_name, id);

-- Users: additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_guest_id ON users (guest_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_plan_type ON users (plan_type);

-- Note: The following indexes already exist from 001_create_users_table.sql:
-- - idx_users_email ON users (email)
-- - idx_users_username ON users (username)
-- - idx_storage_entries_table ON storage_entries (table_name)
