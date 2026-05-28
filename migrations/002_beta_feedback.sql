-- 002_beta_feedback.sql
-- Beta 内测反馈系统

-- 反馈表
CREATE TABLE IF NOT EXISTS beta_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('bug', 'suggestion', 'complaint', 'praise')),
  severity        TEXT NOT NULL CHECK (severity IN ('blocker', 'major', 'minor', 'trivial')),
  test_case_ref   TEXT,
  page_context    JSONB,
  quick_tags      TEXT[],
  description     TEXT NOT NULL,
  screenshot_urls TEXT[],
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'wontfix')),
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable insert for all" ON beta_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable select for all" ON beta_feedback FOR SELECT USING (true);
CREATE POLICY "Enable update for authenticated users" ON beta_feedback FOR UPDATE USING (true);

-- 索引
CREATE INDEX IF NOT EXISTS idx_beta_feedback_category ON beta_feedback(category);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_severity ON beta_feedback(severity);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created ON beta_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_session ON beta_feedback(session_id);
