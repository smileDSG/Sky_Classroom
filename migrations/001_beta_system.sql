-- 001_beta_system.sql
-- Beta 内测系统数据库迁移

-- 1. 邀请码表
CREATE TABLE IF NOT EXISTS invitation_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  type        TEXT NOT NULL DEFAULT 'direct',
  status      TEXT NOT NULL DEFAULT 'active',
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by     UUID,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  max_uses    INT NOT NULL DEFAULT 1,
  current_uses INT NOT NULL DEFAULT 0,
  notes       TEXT
);

ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON invitation_codes FOR ALL USING (true);

-- 2. 内测申请记录
CREATE TABLE IF NOT EXISTS beta_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE beta_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON beta_requests FOR ALL USING (true);

-- 3. 遥测事件表
CREATE TABLE IF NOT EXISTS telemetry_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,
  session_id  TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  event_data  JSONB NOT NULL,
  page        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON telemetry_events FOR ALL USING (true);

-- 4. 性能每日汇总表
CREATE TABLE IF NOT EXISTS performance_daily (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL,
  user_id        UUID,
  avg_fcp        FLOAT,
  avg_lcp        FLOAT,
  avg_cls        FLOAT,
  avg_ttfb       FLOAT,
  avg_inp        FLOAT,
  error_count    INT DEFAULT 0,
  api_call_count INT DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, user_id)
);

ALTER TABLE performance_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON performance_daily FOR ALL USING (true);

-- 5. AI 任务表
CREATE TABLE IF NOT EXISTS ai_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  task_type       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'queued',
  input_summary   JSONB,
  output_summary  JSONB,
  input_tokens    INT DEFAULT 0,
  output_tokens   INT DEFAULT 0,
  cost_usd        FLOAT DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  progress        INT DEFAULT 0,
  progress_detail TEXT
);

ALTER TABLE ai_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access for authenticated users" ON ai_tasks FOR ALL USING (true);

-- 6. 索引
CREATE INDEX IF NOT EXISTS idx_telemetry_events_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_user ON telemetry_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_created ON telemetry_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_user ON ai_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_tasks(status, started_at);
CREATE INDEX IF NOT EXISTS idx_beta_requests_status ON beta_requests(status, applied_at DESC);

-- 7. users 表扩展（如果 users 表存在）
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_status TEXT NOT NULL DEFAULT 'none';
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_invited_by UUID REFERENCES invitation_codes(id);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS beta_joined_at TIMESTAMPTZ;

-- 8. 90 天 TTL 清理函数
CREATE OR REPLACE FUNCTION cleanup_old_telemetry() RETURNS void AS $$
BEGIN
  DELETE FROM telemetry_events WHERE created_at < now() - INTERVAL '90 days';
  DELETE FROM performance_daily WHERE date < CURRENT_DATE - INTERVAL '90 days';
  DELETE FROM ai_tasks WHERE completed_at < now() - INTERVAL '90 days' AND status IN ('completed', 'failed', 'cancelled');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public;
