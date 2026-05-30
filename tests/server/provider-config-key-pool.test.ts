import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveApiKeyPool } from '@/lib/server/provider-config';

// Type for global cache
const globalForConfigs = globalThis as unknown as {
  _providerConfigs: Map<string, unknown> | undefined;
};

describe('resolveApiKeyPool', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    // Clear provider config cache so env changes take effect
    globalForConfigs._providerConfigs?.clear();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    globalForConfigs._providerConfigs?.clear();
  });

  it('returns single key as array when only apiKey is set', () => {
    const result = resolveApiKeyPool('deepseek', undefined);
    expect(Array.isArray(result)).toBe(true);
  });

  it('parses comma-separated env var into multiple keys', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-a,sk-b,sk-c';
    const result = resolveApiKeyPool('deepseek', undefined);
    expect(result).toContain('sk-a');
    expect(result).toContain('sk-b');
    expect(result).toContain('sk-c');
  });

  it('trims whitespace from comma-separated keys', () => {
    process.env.DEEPSEEK_API_KEY = ' sk-a , sk-b , sk-c ';
    const result = resolveApiKeyPool('deepseek', undefined);
    expect(result).toContain('sk-a');
    expect(result).toContain('sk-b');
    expect(result).toContain('sk-c');
  });

  it('client keys take priority over server keys', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-server';
    const result = resolveApiKeyPool('deepseek', 'sk-client');
    expect(result).toEqual(['sk-client']);
  });

  it('filters out empty strings from comma-separated', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-a,,sk-b,';
    const result = resolveApiKeyPool('deepseek', undefined);
    expect(result).toEqual(expect.arrayContaining(['sk-a', 'sk-b']));
    expect(result.every((k: string) => k.length > 0)).toBe(true);
  });
});
