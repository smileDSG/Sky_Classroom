/**
 * Unified AI Provider Configuration — server-side model construction.
 *
 * This module is server-only: it builds concrete language-model instances
 * from the AI SDK. It pulls in @ai-sdk/* and key-pool, so it must NOT be
 * imported by client bundles.
 *
 * The static provider catalog (PROVIDERS) and pure lookup helpers live in
 * `./providers-registry`, which is client-safe. Re-export the catalog here
 * so existing server callers can keep importing from this path.
 *
 * Sources:
 * - https://platform.openai.com/docs/models
 * - https://platform.claude.com/docs/en/about-claude/models/overview
 * - https://ai.google.dev/gemini-api/docs/models
 * - https://api-docs.deepseek.com/quick_start/pricing
 * - https://platform.moonshot.cn/docs/pricing/chat
 * - https://platform.minimaxi.com/docs/guides/text-generation
 * - https://platform.minimaxi.com/docs/api-reference/text-anthropic-api
 * - https://docs.bigmodel.cn/cn/guide/start/model-overview
 * - https://help.aliyun.com/zh/model-studio/models (Qwen/DashScope)
 * - https://siliconflow.cn/models
 * - https://siliconflow.cn/pricing
 * - https://www.volcengine.com/docs/82379/1330310
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { LanguageModel } from 'ai';
import type {
  ProviderConfig,
  ProviderId,
  ModelInfo,
  ModelConfig,
  ThinkingConfig,
} from '@/lib/types/provider';
import { createLogger } from '@/lib/logger';
import { getProviderConfig, getModelInfo } from './providers-registry';
import { getCatalogThinkingCapability } from './model-metadata';
import { getDefaultThinkingConfig } from './thinking-config';
import { buildThinkingBodyParams } from './strategies/thinking-strategy';
import { normalizeMiniMaxBaseUrl } from './adapters/minimax-adapter';
import { getKeyPool } from './key-pool';
// NOTE: Do NOT import thinking-context.ts here — it uses node:async_hooks
// which is server-only, and this file is also used on the client via
// settings.ts. The thinking context is read from globalThis instead
// (set by thinking-context.ts at module load time on the server).

const log = createLogger('AIProviders');

// Re-export the client-safe catalog + types for backward compatibility.
export type { ProviderId, ProviderConfig, ModelInfo, ModelConfig };
export {
  PROVIDERS,
  getProviderConfig,
  getModelInfo,
  isProviderKeyRequired,
  parseModelString,
  getAllModels,
  getProvider,
  MONO_LOGO_PROVIDERS,
} from './providers-registry';

// Re-export thinking capability helper from model-metadata.
export { getCatalogThinkingCapability } from './model-metadata';

/**
 * Model instance with its configuration info
 */
export interface ModelWithInfo {
  model: LanguageModel;
  modelInfo: ModelInfo | null;
}

/**
 * Build thinking body params using the strategy pattern.
 * Delegates to lib/ai/strategies/thinking-strategy.ts
 */
function getCompatThinkingBodyParams(
  providerId: ProviderId,
  modelId: string,
  config: ThinkingConfig,
): Record<string, unknown> | undefined {
  const capability = getCatalogThinkingCapability(providerId, modelId);
  if (!capability || capability.control === 'none') return undefined;
  return buildThinkingBodyParams(capability, config);
}

function shouldUseOpenAIResponsesApi(providerId: ProviderId, modelId: string): boolean {
  if (providerId !== 'openai') return false;

  return (
    /^gpt-5\.\d+-pro(?:-|$)/.test(modelId) ||
    /^gpt-5\.5(?:-|$)/.test(modelId) ||
    /^gpt-5\.[3-9]-codex(?:-|$)/.test(modelId)
  );
}

/**
 * Build a proxy-enabled fetch function for Google API.
 * Returns a function that lazily imports undici on first call.
 */
function buildGoogleProxyFetch(proxyUrl: string): typeof fetch {
  let agent: unknown;
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    return (async () => {
      const { ProxyAgent, fetch: undiciFetch } = (await import(
        /* webpackIgnore: true */ 'undici'
      )) as {
        ProxyAgent: new (proxyUrl: string) => unknown;
        fetch: (input: string | URL | Request, init?: Record<string, unknown>) => Promise<unknown>;
      };
      agent ??= new ProxyAgent(proxyUrl);
      const response = await undiciFetch(input, {
        ...(init as Record<string, unknown>),
        dispatcher: agent,
      });
      return response as Response;
    })();
  }) as typeof fetch;
}

/**
 * Get a configured language model instance with its info
 * Accepts individual parameters for flexibility and security
 */
export function getModel(config: ModelConfig): ModelWithInfo {
  // providerType can come from client for custom providers; fall back to registry.
  let providerType = config.providerType;
  const provider = getProviderConfig(config.providerId);
  const requiresApiKey = provider?.requiresApiKey ?? true;

  if (!providerType) {
    if (provider) {
      providerType = provider.type;
    } else {
      throw new Error(`Unknown provider: ${config.providerId}. Please provide providerType.`);
    }
  }

  // Validate API key if required
  if (requiresApiKey && !config.apiKey) {
    throw new Error(`API key required for provider: ${config.providerId}`);
  }

  // Use provided API key, or empty string for providers that don't require one
  const effectiveApiKey = config.apiKey || '';

  // Resolve base URL: explicit > provider default > SDK default
  const effectiveBaseUrl = normalizeMiniMaxBaseUrl(
    config.providerId,
    config.baseUrl || provider?.defaultBaseUrl || undefined,
  );

  let model: LanguageModel;

  switch (providerType) {
    case 'openai': {
      const openaiOptions: Parameters<typeof createOpenAI>[0] = {
        apiKey: effectiveApiKey,
        baseURL: effectiveBaseUrl,
      };

      // For OpenAI-compatible providers (not native OpenAI), add a fetch
      // wrapper that injects vendor-specific thinking params into the HTTP
      // body. The thinking config is read from AsyncLocalStorage, set by
      // callLLM / streamLLM at call time.
      if (config.providerId !== 'openai') {
        const providerId = config.providerId;

        // Multi-key load balancing: resolve all keys for this provider
        // Server-only: provider-config.ts uses fs, must not be bundled client-side
        let apiKeys: string[] = [];
        if (typeof window === 'undefined') {
          try {
            const { resolveApiKeyPool } = require('@/lib/server/provider-config');
            // If client explicitly passes comma-separated keys, split and respect them.
            // Otherwise let server-side env/YAML config (including key pool)
            // take precedence over a single fallback key.
            if (config.apiKey?.includes(',')) {
              apiKeys = config.apiKey
                .split(',')
                .map((k: string) => k.trim())
                .filter(Boolean);
            } else {
              apiKeys = resolveApiKeyPool(providerId);
            }
          } catch {
            apiKeys = config.apiKey ? [config.apiKey] : [];
          }
        } else {
          apiKeys = config.apiKey ? [config.apiKey] : [];
        }
        const keyPool = apiKeys.length > 0 ? getKeyPool(providerId, apiKeys) : null;

        openaiOptions.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
          // Read thinking config from globalThis (set by thinking-context.ts)
          const thinkingCtx = (globalThis as Record<string, unknown>).__thinkingContext as
            | { getStore?: () => unknown }
            | undefined;
          const thinkingFromContext = thinkingCtx?.getStore?.() as ThinkingConfig | undefined;
          const thinking =
            thinkingFromContext ??
            (providerId === 'lemonade'
              ? getDefaultThinkingConfig(getCatalogThinkingCapability(providerId, config.modelId))
              : undefined);
          if (thinking && init?.body && typeof init.body === 'string') {
            const extra = getCompatThinkingBodyParams(providerId, config.modelId, thinking);
            if (extra) {
              try {
                const body = JSON.parse(init.body);
                if (providerId === 'lemonade' && 'stream_options' in body) {
                  delete body.stream_options;
                }
                Object.assign(body, extra);
                init = { ...init, body: JSON.stringify(body) };
              } catch {
                /* leave body as-is */
              }
            }
          }
          // Multi-key load balancing: select key and override Authorization header
          let selectedKey: string | null = null;
          if (keyPool) {
            selectedKey = keyPool.select();
            keyPool.acquire(selectedKey);
          }

          const newInit: RequestInit = init ? { ...init } : {};
          if (selectedKey) {
            const headers = new Headers(newInit.headers || {});
            headers.set('Authorization', `Bearer ${selectedKey}`);
            newInit.headers = headers;
          }

          const fetchStart = Date.now();
          let response: Response;
          try {
            response = await globalThis.fetch(url, newInit);
          } catch (fetchErr) {
            if (keyPool && selectedKey) {
              keyPool.markFailed(
                selectedKey,
                fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr)),
              );
            }
            throw fetchErr;
          }
          const fetchDuration = Date.now() - fetchStart;

          // Detect rate limit and mark key failed
          if (response.status === 429 && keyPool && selectedKey) {
            keyPool.markFailed(selectedKey, new Error('Rate limited'));
          }

          // For non-streaming OpenAI-compatible providers, strip non-standard
          // fields (e.g. reasoning_content) from the response body that would
          // cause the @ai-sdk/openai Chat Completion schema validation to fail.
          let isStreamingRequest = false;
          if (newInit?.body && typeof newInit.body === 'string') {
            try {
              isStreamingRequest = JSON.parse(newInit.body)?.stream === true;
            } catch {
              /* ignore */
            }
          }

          if (isStreamingRequest) {
            // Streaming: pass through (SSE parser handles chunk-level validation)
            // Do NOT release key here — stream may be consumed for minutes.
            // Key will be released when the consumer finishes reading.
            // Note: this inflates inflight count for streaming; acceptable for
            // now since PPT generation uses non-streaming calls exclusively.
            log.info(`[FetchWrapper] streaming request, passthrough in ${fetchDuration}ms`);
            return response;
          }

          // Non-streaming: transform response to strip incompatible fields
          let transformErrorLogged = false;
          let bodyReadTimer: ReturnType<typeof setTimeout> | null = null;
          try {
            log.info(
              `[FetchWrapper] reading response body... status=${response.status} fetch=${fetchDuration}ms`,
            );
            const textStart = Date.now();
            // Page design outputs up to 24k tokens; DeepSeek can take 3-7 min.
            // Because Node.js fetch cannot cancel response.text() via AbortSignal
            // once the response headers have arrived, this timeout acts as the
            // *real* deadline for body consumption. 600s covers large outputs
            // (8192 tokens ~ 4-5 min at 30 tps) while preventing indefinite hangs.
            const BODY_READ_TIMEOUT_MS = 600_000;
            const textPromise = response.text();
            const text = await Promise.race([
              textPromise.then((t) => {
                if (bodyReadTimer) {
                  clearTimeout(bodyReadTimer);
                  bodyReadTimer = null;
                }
                return t;
              }),
              new Promise<never>((_, reject) => {
                bodyReadTimer = setTimeout(() => {
                  bodyReadTimer = null;
                  // Cancel the body reader to free the TCP connection
                  textPromise.catch(() => {}); // swallow late rejection
                  if (response.body) {
                    response.body.cancel(new Error('Response body read timeout')).catch(() => {});
                  }
                  reject(new Error('Response body read timeout'));
                }, BODY_READ_TIMEOUT_MS);
              }),
            ]);
            log.info(
              `[FetchWrapper] response.text() done in ${Date.now() - textStart}ms, length=${text.length}`,
            );
            // Detect encoding corruption: look for Unicode replacement char (U+FFFD) or
            // bare question-mark sequences that often appear when UTF-8 bytes are mis-decoded.
            if (text.includes('\uFFFD') || /\?{4,}/.test(text)) {
              log.warn(
                `[FetchWrapper] Possible encoding corruption detected in response body (U+FFFD or ???? found). Provider=${providerId} model=${config.modelId}`,
              );
            }
            const parsed = JSON.parse(text);

            // 1. Detect error-in-200 response (some providers' load-balancers
            //    return errors with HTTP 200; label with the real provider)
            if (parsed.error) {
              log.error(
                `${providerId} API returned error in HTTP 200 body: ${JSON.stringify(parsed.error)}`,
              );
              throw new Error(`${providerId} API error: ${JSON.stringify(parsed.error)}`);
            }

            // 2. Guard empty / malformed choices — DO NOT fabricate empty content
            if (!parsed.choices || !Array.isArray(parsed.choices) || parsed.choices.length === 0) {
              log.error(
                `DeepSeek response missing choices. Body keys: ${Object.keys(parsed).join(',')}`,
              );
              throw new Error(
                `DeepSeek response missing choices: ${Object.keys(parsed).join(',')}`,
              );
            }

            // 3. Deep-clean each choice — whitelist approach
            const allowedMessageFields = ['role', 'content', 'tool_calls', 'function_call'];
            for (const choice of parsed.choices) {
              // Handle delta format (sometimes returned even for non-streaming by some proxies)
              if (!choice.message && choice.delta && typeof choice.delta === 'object') {
                const delta = choice.delta as Record<string, unknown>;
                choice.message = {
                  role: 'assistant',
                  content: typeof delta.content === 'string' ? delta.content : '',
                };
              }
              if (!choice.message || typeof choice.message !== 'object') {
                choice.message = { role: 'assistant', content: '' };
              }
              const msg = choice.message as Record<string, unknown>;

              // content: null / undefined / non-string → ''
              if (
                msg.content === null ||
                msg.content === undefined ||
                typeof msg.content !== 'string'
              ) {
                msg.content = '';
              }

              // Strip known non-standard fields
              delete msg.reasoning_content;
              delete msg.reasoning;

              // Strip any other unknown fields on message
              for (const key of Object.keys(msg)) {
                if (!allowedMessageFields.includes(key)) {
                  delete msg[key];
                }
              }

              // Guard finish_reason
              if (choice.finish_reason === null) choice.finish_reason = 'stop';
            }

            // 4. Strip top-level non-standard fields
            delete parsed.reasoning_content;
            delete parsed.reasoning;

            // 5. Strip non-standard usage fields
            if (parsed.usage && typeof parsed.usage === 'object') {
              const usage = parsed.usage as Record<string, unknown>;
              if (
                usage.completion_tokens_details &&
                typeof usage.completion_tokens_details === 'object'
              ) {
                delete (usage.completion_tokens_details as Record<string, unknown>)
                  .reasoning_tokens;
              }
              delete usage.prompt_cache_hit_tokens;
              delete usage.prompt_cache_miss_tokens;
            }

            if (keyPool && selectedKey) keyPool.release(selectedKey);
            return new Response(JSON.stringify(parsed), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          } catch (err) {
            if (bodyReadTimer) {
              clearTimeout(bodyReadTimer);
              bodyReadTimer = null;
            }
            if (keyPool && selectedKey) keyPool.release(selectedKey);
            // Re-throw abort/timeout errors so postToApi can recognize them via isAbortError
            // NOTE: Node.js AbortError message may be 'The operation was aborted' or
            // 'This operation was aborted'; DOMException may have name 'AbortError'.
            // Also guard against 'Response body read timeout' from our own timer.
            const isAbortOrTimeout =
              err instanceof Error &&
              (err.name === 'AbortError' ||
                err.name === 'TimeoutError' ||
                err.message.toLowerCase().includes('abort') ||
                err.message.toLowerCase().includes('timeout') ||
                err.message.toLowerCase().includes('operation was aborted'));
            if (isAbortOrTimeout) {
              throw err;
            }
            const errMsg = err instanceof Error ? err.message : String(err);
            // Provider-terminated connections (e.g. DeepSeek 60s limit) should mark key failed
            // so retries can pick a different key / provider.
            const isTerminated = errMsg.toLowerCase().includes('terminated');
            if (isTerminated && keyPool && selectedKey) {
              keyPool.markFailed(
                selectedKey,
                new Error(`Provider terminated connection after ${fetchDuration}ms`),
              );
            }
            if (!transformErrorLogged) {
              transformErrorLogged = true;
              // Try to capture raw response preview for debugging
              let rawPreview = '';
              try {
                // Clone response to re-read body (response.text() may have been consumed)
                // If body was consumed, we can't re-read; but we log what we can.
              } catch {
                /* ignore */
              }
              log.error(
                `Response transform failed: ${errMsg}. status=${response.status} fetch=${fetchDuration}ms. Raw response preview unavailable (body consumed).`,
              );
            }
            // Body already consumed by response.text(); returning raw response would
            // cause downstream readers to see empty body. Always throw.
            throw err;
          }
        };
      }

      const openai = createOpenAI(openaiOptions);
      model = shouldUseOpenAIResponsesApi(config.providerId, config.modelId)
        ? openai.responses(config.modelId)
        : openai.chat(config.modelId);
      break;
    }

    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: effectiveApiKey,
        baseURL: effectiveBaseUrl,
      });
      model = anthropic.chat(config.modelId);
      break;
    }

    case 'google': {
      const googleOptions: Parameters<typeof createGoogleGenerativeAI>[0] = {
        apiKey: effectiveApiKey,
        baseURL: effectiveBaseUrl,
      };
      if (config.proxy) {
        googleOptions.fetch = buildGoogleProxyFetch(config.proxy);
      }
      const google = createGoogleGenerativeAI(googleOptions);
      model = google.chat(config.modelId);
      break;
    }

    default:
      throw new Error(`Unsupported provider type: ${providerType}`);
  }

  // Look up model info from the provider registry
  const modelInfo = getModelInfo(config.providerId, config.modelId) ?? null;

  return { model, modelInfo };
}
