ALTER TABLE users
  ADD COLUMN IF NOT EXISTS favorite_subjects JSONB,
  ADD COLUMN IF NOT EXISTS learning_onboarding JSONB;
