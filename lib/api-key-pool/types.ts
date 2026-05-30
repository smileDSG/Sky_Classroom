/**
 * API Key Pool — Type Definitions
 */

export interface ApiKeyEntry {
  id: string;
  provider: string;
  apiKey: string;
  baseUrl?: string;
  label?: string;
  isActive: boolean;
  priority: number;
  requestCount: number;
  errorCount: number;
  lastUsedAt?: Date;
  lastErrorAt?: Date;
  rateLimitedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Stored in DB — api_key is encrypted */
export interface ApiKeyRow {
  id: string;
  provider: string;
  api_key: string;
  base_url: string | null;
  label: string | null;
  is_active: number;
  priority: number;
  request_count: number;
  error_count: number;
  last_used_at: Date | null;
  last_error_at: Date | null;
  rate_limited_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PickResult {
  key: ApiKeyEntry;
  index: number;
}

export class NoAvailableKeyError extends Error {
  constructor(public provider: string) {
    super(`No available API key for provider: ${provider}`);
    this.name = 'NoAvailableKeyError';
  }
}
