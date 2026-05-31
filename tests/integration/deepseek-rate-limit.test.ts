/**
 * DeepSeek API Rate Limit 隔离粒度测试
 *
 * 验证 DeepSeek 的 rate limit 是按 API key 隔离还是按账号/IP 隔离。
 *
 * 测试设计：
 * - Test A: 24 个不同 key 并发请求（每个 key 1 个请求）
 *   → 如果按 key 隔离，应该全部成功（或极少失败）
 *   → 如果按账号隔离，会出现大量 429
 * - Test B: 同一个 key 并发 6 个请求
 *   → 验证单个 key 的并发极限
 * - Test C: 逐步加压（1 → 4 → 8 → 16 并发，混合使用 key）
 *   → 观察失败率随并发数的变化曲线
 *
 * 注意：这是 integration test，会实际调用 API，消耗少量 token。
 * 运行前确保 .env.local 中 DEEPSEEK_API_KEYS 已配置。
 */
import { describe, it, expect } from 'vitest';

// DeepSeek API 配置
const BASE_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-v4-pro';

// 从环境变量读取 keys
function resolveKeys(): string[] {
  const keysEnv = process.env.DEEPSEEK_API_KEYS || process.env.DEEPSEEK_API_KEY || '';
  return keysEnv
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.startsWith('sk-'));
}

interface TestResult {
  keyIndex: number;
  status: number;
  statusText: string;
  durationMs: number;
  error?: string;
  body?: unknown;
}

async function callDeepSeek(
  apiKey: string,
  signal?: AbortSignal,
): Promise<TestResult> {
  const start = Date.now();
  try {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
        temperature: 0,
      }),
      signal,
    });
    const durationMs = Date.now() - start;
    const body = await response.json().catch(() => undefined);
    return {
      keyIndex: -1,
      status: response.status,
      statusText: response.statusText,
      durationMs,
      body,
    };
  } catch (err) {
    return {
      keyIndex: -1,
      status: 0,
      statusText: 'NETWORK_ERROR',
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function summarize(results: TestResult[]): string {
  const total = results.length;
  const success = results.filter((r) => r.status === 200).length;
  const rateLimited = results.filter((r) => r.status === 429).length;
  const errors = results.filter((r) => r.status >= 500 || r.status === 0).length;
  const avgDuration = Math.round(
    results.reduce((sum, r) => sum + r.durationMs, 0) / total,
  );
  const maxDuration = Math.max(...results.map((r) => r.durationMs));

  return `
    总请求: ${total}
    成功(200): ${success}
    限流(429): ${rateLimited}
    其他错误: ${errors}
    平均耗时: ${avgDuration}ms
    最大耗时: ${maxDuration}ms
  `.trim();
}

describe('DeepSeek Rate Limit 隔离粒度测试', () => {
  const keys = resolveKeys();

  it.beforeAll(() => {
    console.log(`[RateLimitTest] 已加载 ${keys.length} 个 API keys`);
    if (keys.length === 0) {
      console.warn('[RateLimitTest] 未找到 DEEPSEEK_API_KEYS，跳过测试');
    }
  });

  it.skipIf(keys.length === 0)(
    'Test A: 24 个不同 key 并发（验证按 key 隔离）',
    async () => {
      const testKeys = keys.slice(0, 24);
      console.log(`[RateLimitTest] Test A: ${testKeys.length} keys 并发`);

      const results = await Promise.all(
        testKeys.map((key, i) =>
          callDeepSeek(key).then((r) => ({ ...r, keyIndex: i })),
        ),
      );

      const summary = summarize(results);
      console.log(`[RateLimitTest] Test A 结果:\n${summary}`);

      // 详细打印每个失败请求
      results
        .filter((r) => r.status !== 200)
        .forEach((r) => {
          console.log(
            `[RateLimitTest] Test A 失败 key#${r.keyIndex}: status=${r.status}, error=${r.error || JSON.stringify(r.body)}`,
          );
        });

      // 断言：如果按 key 隔离，成功率应 > 80%
      const successRate = results.filter((r) => r.status === 200).length / results.length;
      console.log(`[RateLimitTest] Test A 成功率: ${(successRate * 100).toFixed(1)}%`);

      // 我们不 hard fail，只记录数据供分析
      expect(results.length).toBe(testKeys.length);
    },
    60_000,
  );

  it.skipIf(keys.length === 0)(
    'Test B: 同一个 key 并发 6 次（验证单 key 极限）',
    async () => {
      const key = keys[0];
      console.log(`[RateLimitTest] Test B: 单 key 并发 6 次`);

      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          callDeepSeek(key).then((r) => ({ ...r, keyIndex: i })),
        ),
      );

      const summary = summarize(results);
      console.log(`[RateLimitTest] Test B 结果:\n${summary}`);

      results
        .filter((r) => r.status !== 200)
        .forEach((r) => {
          console.log(
            `[RateLimitTest] Test B 失败 #${r.keyIndex}: status=${r.status}, error=${r.error || JSON.stringify(r.body)}`,
          );
        });

      expect(results.length).toBe(6);
    },
    60_000,
  );

  it.skipIf(keys.length < 4)(
    'Test C: 逐步加压（1→4→8→16 并发，混合 key）',
    async () => {
      const levels = [1, 4, 8, 16];
      const report: string[] = [];

      for (const concurrency of levels) {
        console.log(`[RateLimitTest] Test C: 并发=${concurrency}`);

        // 轮询使用 keys
        const tasks = Array.from({ length: concurrency }, (_, i) => {
          const key = keys[i % keys.length];
          return callDeepSeek(key).then((r) => ({ ...r, keyIndex: i % keys.length }));
        });

        const results = await Promise.all(tasks);
        const success = results.filter((r) => r.status === 200).length;
        const rateLimited = results.filter((r) => r.status === 429).length;
        const avgDuration = Math.round(
          results.reduce((sum, r) => sum + r.durationMs, 0) / results.length,
        );

        const line = `并发=${concurrency.toString().padStart(2)} | 成功=${success.toString().padStart(2)}/${concurrency} | 429=${rateLimited} | 平均=${avgDuration}ms`;
        report.push(line);
        console.log(`[RateLimitTest] ${line}`);
      }

      console.log(`[RateLimitTest] Test C 汇总:\n${report.join('\n')}`);

      // 分析：如果按账号隔离，并发 8/16 时 429 会显著增加
      expect(report.length).toBe(4);
    },
    120_000,
  );
});
