-- API Key Pool: 按 provider 分组管理多个 API Key，支持轮询负载均衡

CREATE TABLE IF NOT EXISTS api_keys (
  id                 VARCHAR(36) PRIMARY KEY,
  provider           VARCHAR(50) NOT NULL,
  api_key            VARCHAR(512) NOT NULL,
  base_url           VARCHAR(512),
  label              VARCHAR(100),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  priority           INT NOT NULL DEFAULT 0,
  request_count      BIGINT NOT NULL DEFAULT 0,
  error_count        BIGINT NOT NULL DEFAULT 0,
  last_used_at       DATETIME,
  last_error_at      DATETIME,
  rate_limited_until DATETIME,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_provider_active (provider, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
