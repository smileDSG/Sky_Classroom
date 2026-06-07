/**
 * Prompt Loader - Loads prompts from markdown files
 *
 * Supports:
 * - Loading prompts from templates/{promptId}/ directory
 * - Snippet inclusion via {{snippet:name}} syntax
 * - Conditional blocks via {{#if condition}}...{{/if}} syntax
 * - Variable interpolation via {{variable}} syntax
 * - Optional in-memory caching with TTL + watcher-based invalidation
 * - File watching for hot-reload (no restart needed)
 */

import fs from 'fs';
import path from 'path';
import type { PromptId, LoadedPrompt, SnippetId } from './types';
import { createLogger } from '@/lib/logger';
const log = createLogger('PromptLoader');

// ==================== Cache Layer ====================

interface CacheEntry<T> {
  data: T;
  loadedAt: number;
}

const cache = new Map<string, CacheEntry<LoadedPrompt>>();
const snippetCache = new Map<string, CacheEntry<string>>();
let cacheTTL = 0; // 0 = disabled by default (backward-compatible: read every time)
let watchers: fs.FSWatcher[] = [];

/**
 * Enable in-memory caching with optional TTL.
 * When TTL is 0, cache is disabled (default — disk read every call).
 * When TTL > 0, entries are reused for that many ms before re-reading.
 */
export function enableCache(ttlMs: number = 60_000): void {
  cacheTTL = ttlMs;
  log.info(`Cache enabled with TTL=${ttlMs}ms`);
}

/** Disable caching and clear all cached entries. */
export function disableCache(): void {
  cacheTTL = 0;
  cache.clear();
  snippetCache.clear();
  log.info('Cache disabled');
}

/** Clear all cached prompt and snippet entries. */
export function clearCache(): void {
  cache.clear();
  snippetCache.clear();
  log.info('Cache cleared');
}

/** Return cache statistics for monitoring. */
export function getCacheStats(): { prompts: number; snippets: number; ttl: number } {
  return { prompts: cache.size, snippets: snippetCache.size, ttl: cacheTTL };
}

// ==================== File Watching ====================

/**
 * Start watching the templates and snippets directories for changes.
 * When a file is modified, the corresponding cache entry is invalidated.
 */
export function startFileWatcher(): void {
  stopFileWatcher();
  const promptsDir = getPromptsDir();

  const dirs = ['templates', 'snippets'];
  for (const dir of dirs) {
    const fullPath = path.join(promptsDir, dir);
    try {
      const watcher = fs.watch(fullPath, { recursive: true }, (_event, filename) => {
        if (!filename || !filename.endsWith('.md')) return;
        log.info(`[hot-reload] Detected change: ${dir}/${filename}`);
        // Invalidate all cache entries — granular invalidation would need
        // mapping file paths to prompt IDs, which isn't worth the complexity
        // given that prompt files are small and load time is negligible.
        clearCache();
      });
      watchers.push(watcher);
      log.info(`[hot-reload] Watching ${fullPath} for changes`);
    } catch {
      // Directory may not exist yet
    }
  }
}

/** Stop all file watchers. */
export function stopFileWatcher(): void {
  for (const w of watchers) {
    w.close();
  }
  watchers = [];
}

/**
 * Get the prompts directory path
 */
function getPromptsDir(): string {
  // In Next.js, use process.cwd() for the project root
  return path.join(process.cwd(), 'lib', 'prompts');
}

/**
 * Load a snippet by ID.
 * Results are cached when cacheTTL > 0; cleared by file watcher on changes.
 */
export function loadSnippet(snippetId: SnippetId): string {
  // Check cache
  if (cacheTTL > 0) {
    const entry = snippetCache.get(snippetId);
    if (entry && Date.now() - entry.loadedAt < cacheTTL) {
      return entry.data;
    }
  }

  const snippetPath = path.join(getPromptsDir(), 'snippets', `${snippetId}.md`);

  try {
    const content = fs.readFileSync(snippetPath, 'utf-8').trim();
    if (cacheTTL > 0) {
      snippetCache.set(snippetId, { data: content, loadedAt: Date.now() });
    }
    return content;
  } catch {
    // Fail loud rather than silently shipping `{{snippet:foo}}` to the LLM.
    // A missing snippet is always a config/typo bug — surface at load time.
    throw new Error(`Snippet not found: ${snippetId}`);
  }
}

/**
 * Process snippet includes in a template.
 * Replaces {{snippet:name}} with actual snippet content.
 */
export function processSnippets(template: string): string {
  return template.replace(/\{\{snippet:(\w[\w-]*)\}\}/g, (_, snippetId) => {
    return loadSnippet(snippetId as SnippetId);
  });
}

/**
 * Process conditional blocks in a template.
 * Replaces {{#if conditionName}}...{{/if}} with the inner content when the
 * named condition is truthy, or removes the entire block when it is falsy.
 *
 * Blocks do not nest — this is intentional to keep the prompt templating
 * language simple and reviewable.
 */
export function processConditionalBlocks(
  template: string,
  conditions: Record<string, unknown>,
): string {
  return template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, conditionName: string, content: string) => {
      return conditions[conditionName] ? content : '';
    },
  );
}

/**
 * Load a prompt by ID.
 * Results are cached when cacheTTL > 0; cleared by file watcher on changes.
 */
export function loadPrompt(promptId: PromptId): LoadedPrompt | null {
  // Check cache
  if (cacheTTL > 0) {
    const entry = cache.get(promptId);
    if (entry && Date.now() - entry.loadedAt < cacheTTL) {
      return entry.data;
    }
  }

  const promptsDir = getPromptsDir();

  // Phase 4: Support new generators/{id}.md single-file format
  if (promptId.startsWith('generators/')) {
    const filename = promptId.replace('generators/', '');
    const genPath = path.join(promptsDir, 'generators', `${filename}.md`);
    try {
      let systemPrompt = fs.readFileSync(genPath, 'utf-8').trim();
      systemPrompt = processSnippets(systemPrompt);

      const result: LoadedPrompt = {
        id: promptId,
        systemPrompt,
        userPromptTemplate: '',
      };

      if (cacheTTL > 0) {
        cache.set(promptId, { data: result, loadedAt: Date.now() });
      }
      return result;
    } catch (error) {
      log.error(`Failed to load generator ${promptId}:`, error);
      return null;
    }
  }

  // Legacy: templates/{promptId}/system.md + user.md
  const promptDir = path.join(promptsDir, 'templates', promptId);

  try {
    // Load system.md
    const systemPath = path.join(promptDir, 'system.md');
    let systemPrompt = fs.readFileSync(systemPath, 'utf-8').trim();
    systemPrompt = processSnippets(systemPrompt);

    // Load user.md (optional, may not exist)
    const userPath = path.join(promptDir, 'user.md');
    let userPromptTemplate = '';
    try {
      userPromptTemplate = fs.readFileSync(userPath, 'utf-8').trim();
      userPromptTemplate = processSnippets(userPromptTemplate);
    } catch {
      // user.md is optional
    }

    const result: LoadedPrompt = {
      id: promptId,
      systemPrompt,
      userPromptTemplate,
    };

    if (cacheTTL > 0) {
      cache.set(promptId, { data: result, loadedAt: Date.now() });
    }

    return result;
  } catch (error) {
    log.error(`Failed to load prompt ${promptId}:`, error);
    return null;
  }
}

/**
 * Interpolate variables in a template
 * Replaces {{variable}} with values from the variables object
 */
export function interpolateVariables(template: string, variables: Record<string, unknown>): string {
  // `\w+` only matches [A-Za-z0-9_], so kebab-case placeholders like
  // `{{next-agent}}` pass through unchanged. Convention (per README) is
  // camelCase; tests in tests/prompts/templates.test.ts scan templates
  // for non-conforming placeholders.
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined) return match;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  });
}

/**
 * Build a complete prompt with variables.
 *
 * Processing order:
 *   1. Snippet includes ({{snippet:name}}) — file content spliced in
 *   2. Conditional blocks ({{#if flag}}...{{/if}}) — gated on `variables`
 *   3. Variable interpolation ({{varName}}) — values substituted
 */
export function buildPrompt(
  promptId: PromptId,
  variables: Record<string, unknown>,
): { system: string; user: string } | null {
  const prompt = loadPrompt(promptId);
  if (!prompt) return null;

  return {
    system: interpolateVariables(
      processConditionalBlocks(prompt.systemPrompt, variables),
      variables,
    ),
    user: interpolateVariables(
      processConditionalBlocks(prompt.userPromptTemplate, variables),
      variables,
    ),
  };
}
