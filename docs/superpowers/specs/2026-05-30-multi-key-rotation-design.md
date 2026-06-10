# Multi-Key Rotation for LLM Provider Speed Optimization

Date: 2026-05-30

## Problem

The generation pipelines (classroom + PPT) are bottlenecked by single API key rate limits. Current architecture:
- Each provider has exactly one API key
- `GENERATION_CONCURRENCY = 6` parallel LLM calls all share the same key
- Rate limiting (HTTP 429) blocks all concurrent requests

## Solution: Multi-Key Round-Robin Rotation

### 1. Configuration Format

**server-providers.yml** — new `apiKeys` array (backward compatible with single `apiKey`):

```yaml
providers:
  deepseek:
    apiKeys:
      - sk-key1
      - sk-key2
      - sk-key3
    baseUrl: https://api.deepseek.com
```

**Environment variable** — comma-separated:

```bash
DEEPSEEK_API_KEY=sk-key1,sk-key2,sk-key3
```

**Priority**: `apiKeys` array > single `apiKey` > env var (comma-separated)

### 2. Key Rotator Module

**File**: `lib/ai/key-rotator.ts`

```
KeyRotator
├── keys: Map<providerId, KeyEntry[]>
├── getNextKey(providerId) → LRU selection
├── markFailed(key, providerId) → cooldown on 429
├── markSuccess(key, providerId) → reset failure count
└── getState() → debug/monitoring
```

**Selection strategy**: Least-Recently-Used (LRU) — prefer the key used longest ago.

**Failure handling**:
- HTTP 429 (Rate Limit) → mark key cooldown 60s, try next key
- 3 consecutive failures → cooldown escalates to 5min
- Cooldown expires → key automatically becomes available again

**Relationship with existing failover**:
- Key Rotator = intra-provider multi-key rotation (new)
- Failover = inter-provider fallback (existing, unchanged)
- Key Rotator tries first; if ALL keys fail, then failover triggers

### 3. Integration Points

| File | Change |
|------|--------|
| `lib/ai/key-rotator.ts` | **New** — key pool management |
| `lib/server/provider-config.ts` | `resolveApiKey` → support returning key pool; parse `apiKeys` array + env comma-separated |
| `lib/ai/llm.ts` | `callLLM` adds key rotation retry: on 429, get next key from pool, rebuild model instance, retry |
| `lib/ai/providers.ts` | `getModel` supports single key (unchanged interface); new `getModelWithKey` for key rotation |
| `server-providers.yml` | Example config with apiKeys |

### 4. Key Flow

```
callLLM(params)
  → generateText(params) with current key
  → catch HTTP 429
  → keyRotator.markFailed(currentKey, providerId)
  → keyRotator.getNextKey(providerId) → next available key
  → getModel({ ...config, apiKey: nextKey }) → new model instance
  → generateText(params) with new key
  → success → markSuccess
  → all keys exhausted → throw error (triggers existing failover)
```

### 5. Scope

**In scope**:
- Multi-key configuration parsing
- Key rotator module with LRU + cooldown
- callLLM integration with 429 retry
- Monitoring/logging of key usage

**Out of scope** (future optimization):
- Pipeline parallelization (streaming outlines, content+actions parallel)
- Dynamic concurrency adjustment based on rate limit signals
- Key usage analytics dashboard

### 6. Expected Impact

- 2 keys → ~2x throughput (bypass single-key rate limit)
- 3 keys → ~3x throughput
- No change to pipeline structure, minimal risk
- Foundation for future pipeline optimizations
