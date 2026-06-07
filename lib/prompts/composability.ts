/**
 * Prompt Composability Engine
 *
 * Core of the new modular prompt architecture. Replaces the flat template
 * loading model with a layered composition model:
 *
 *   fragments (priority-ordered) → compose → process → final prompt
 *
 * Processing pipeline:
 *   1. Fragment selection + language/version filtering
 *   2. Priority-ordered concatenation
 *   3. Snippet inclusion ({{snippet:name}})
 *   4. Conditional blocks ({{#if flag}}...{{/if}})
 *   5. Variable interpolation ({{varName}})
 */

import fs from 'node:fs';
import path from 'node:path';
import type {
  PromptFragment,
  PromptFragmentCategory,
  ComposeOptions,
  ComposeResult,
  IPromptComposer,
} from './types';
import { createLogger } from '@/lib/logger';

const log = createLogger('Composability');

// ==================== Default Priority Map ====================

const DEFAULT_PRIORITY: Record<PromptFragmentCategory, number> = {
  user: 100,
  persona: 40,
  role: 30,
  generator: 20,
  core: 10,
  snippet: 5,
};

// ==================== Fragment Registry ====================

class FragmentRegistry {
  private fragments = new Map<string, PromptFragment[]>();

  add(fragment: PromptFragment): void {
    const existing = this.fragments.get(fragment.id) || [];
    // Replace if same language + version, otherwise append
    const idx = existing.findIndex(
      (f) => f.language === fragment.language && f.version === fragment.version,
    );
    if (idx >= 0) {
      existing[idx] = fragment;
    } else {
      existing.push(fragment);
    }
    this.fragments.set(fragment.id, existing);
  }

  remove(fragmentId: string): void {
    this.fragments.delete(fragmentId);
  }

  get(fragmentId: string, language?: string, version?: string): PromptFragment | null {
    const candidates = this.fragments.get(fragmentId);
    if (!candidates || candidates.length === 0) return null;

    // Exact match on language + version first
    if (language || version) {
      const exact = candidates.find(
        (f) =>
          (language ? f.language === language : true) &&
          (version ? f.version === version : true),
      );
      if (exact) return exact;
    }

    // Language-only match
    if (language) {
      const langMatch = candidates.find((f) => f.language === language);
      if (langMatch) return langMatch;
    }

    // Fallback: return the first fragment without a language constraint (default)
    const fallback = candidates.find((f) => !f.language);
    if (fallback) return fallback;

    // Last resort: return first candidate
    return candidates[0];
  }

  has(fragmentId: string): boolean {
    return this.fragments.has(fragmentId) && this.fragments.get(fragmentId)!.length > 0;
  }

  list(category?: PromptFragmentCategory): PromptFragment[] {
    const result: PromptFragment[] = [];
    for (const [, variants] of this.fragments) {
      for (const fragment of variants) {
        if (!category || fragment.category === category) {
          result.push(fragment);
        }
      }
    }
    return result;
  }

  clear(): void {
    this.fragments.clear();
  }
}

// ==================== Composer Implementation ====================

export class PromptComposer implements IPromptComposer {
  private registry = new FragmentRegistry();
  private promptsDir: string;
  private fileWatchers = new Map<string, fs.FSWatcher>();

  constructor(promptsDir?: string) {
    this.promptsDir = promptsDir || path.join(process.cwd(), 'lib', 'prompts');
  }

  // ─── IPromptComposer ───

  register(fragment: PromptFragment): void {
    if (fragment.priority === undefined) {
      fragment.priority = DEFAULT_PRIORITY[fragment.category] || 5;
    }
    this.registry.add(fragment);
    log.debug(`Registered fragment: ${fragment.id} [${fragment.category}]`);
  }

  unregister(fragmentId: string): void {
    this.registry.remove(fragmentId);
    log.debug(`Unregistered fragment: ${fragmentId}`);
  }

  list(category?: PromptFragmentCategory): PromptFragment[] {
    return this.registry.list(category);
  }

  async reload(fragmentId: string): Promise<void> {
    // Re-read from the filesystem based on fragment category
    const fragments = this.registry.list();
    const match = fragments.find((f) => f.id === fragmentId);
    if (!match) {
      log.warn(`Cannot reload unknown fragment: ${fragmentId}`);
      return;
    }
    // Reload from the appropriate directory
    const dirMap: Record<string, string> = {
      core: 'core',
      role: 'roles',
      persona: 'student-personas',
      generator: 'generators',
      snippet: 'snippets',
    };
    const dir = dirMap[match.category];
    if (!dir) return;

    const filePath = path.join(this.promptsDir, dir, `${fragmentId}.md`);
    try {
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      this.registry.add({ ...match, content });
      log.info(`Reloaded fragment: ${fragmentId} from ${filePath}`);
    } catch {
      log.error(`Failed to reload fragment: ${fragmentId} from ${filePath}`);
    }
  }

  async loadUserOverride(fragmentId: string, filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      this.registry.add({
        id: fragmentId,
        category: 'user',
        content,
        priority: DEFAULT_PRIORITY.user,
      });
      log.info(`Loaded user override: ${fragmentId} from ${filePath}`);
    } catch {
      log.error(`Failed to load user override: ${fragmentId} from ${filePath}`);
    }
  }

  // ─── Composition ───

  compose(options: ComposeOptions): ComposeResult {
    const missingFragments: string[] = [];
    const resolvedIds: string[] = [];

    // 1. Resolve fragment IDs to actual fragments
    const resolved: PromptFragment[] = [];
    for (const id of options.fragments) {
      const fragment = this.registry.get(id, options.language, options.version);
      if (fragment) {
        resolved.push(fragment);
        resolvedIds.push(id);
      } else {
        missingFragments.push(id);
      }
    }

    // 2. Sort by priority (user overrides always win)
    resolved.sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5));

    // 3. Concatenate
    const systemParts: string[] = [];
    const userParts: string[] = [];

    for (const fragment of resolved) {
      // Fragments starting with "# User:" or matching user-role patterns go to user prompt
      // Generator fragments with user.md semantics go to user prompt
      if (fragment.id.startsWith('user:') || fragment.category === 'snippet') {
        userParts.push(fragment.content);
      } else {
        systemParts.push(fragment.content);
      }
    }

    let system = systemParts.join('\n\n');
    let user = userParts.join('\n\n');

    // 4. Process snippets
    system = this.processSnippets(system);
    user = this.processSnippets(user);

    // 5. Process conditional blocks
    system = this.processConditionals(system, options.variables);
    user = this.processConditionals(user, options.variables);

    // 6. Interpolate variables
    system = this.interpolateVariables(system, options.variables);
    user = this.interpolateVariables(user, options.variables);

    return {
      system,
      user,
      meta: {
        fragmentIds: resolvedIds,
        version: options.version,
        language: options.language,
        resolvedFragments: resolved.length,
        missingFragments,
      },
    };
  }

  // ─── File Watching (hot-reload) ───

  startWatching(): void {
    const dirs = ['core', 'roles', 'student-personas', 'generators', 'snippets'];
    for (const dir of dirs) {
      const fullPath = path.join(this.promptsDir, dir);
      try {
        const watcher = fs.watch(fullPath, { recursive: false }, (_event, filename) => {
          if (!filename || !filename.endsWith('.md')) return;
          const fragmentId = filename.replace('.md', '');
          log.info(`[hot-reload] Detected change: ${dir}/${filename}`);
          this.reload(fragmentId);
        });
        this.fileWatchers.set(dir, watcher);
        log.info(`Watching ${fullPath} for changes`);
      } catch {
        // Directory may not exist yet — that's fine
      }
    }
  }

  stopWatching(): void {
    for (const [dir, watcher] of this.fileWatchers) {
      watcher.close();
      log.info(`Stopped watching ${dir}`);
    }
    this.fileWatchers.clear();
  }

  // ─── Static Helpers (mirrors loader.ts for independent use) ───

  private processSnippets(template: string): string {
    return template.replace(/\{\{snippet:(\w[\w-]*)\}\}/g, (_match, snippetId) => {
      const snippet = this.registry.get(snippetId);
      if (snippet) return snippet.content;
      // Try loading from disk as a fallback
      try {
        const snippetPath = path.join(this.promptsDir, 'snippets', `${snippetId}.md`);
        return fs.readFileSync(snippetPath, 'utf-8').trim();
      } catch {
        log.warn(`Snippet not found: ${snippetId}`);
        return `[snippet:${snippetId}]`;
      }
    });
  }

  private processConditionals(
    template: string,
    conditions: Record<string, unknown>,
  ): string {
    return template.replace(
      /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (_match, conditionName: string, content: string) => {
        return conditions[conditionName] ? content : '';
      },
    );
  }

  private interpolateVariables(
    template: string,
    variables: Record<string, unknown>,
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      if (value === undefined) return match;
      if (typeof value === 'object') return JSON.stringify(value, null, 2);
      return String(value);
    });
  }
}

// ==================== Singleton ====================

let _composer: PromptComposer | null = null;

export function getPromptComposer(): PromptComposer {
  if (!_composer) {
    _composer = new PromptComposer();
  }
  return _composer;
}

export function resetPromptComposer(): void {
  if (_composer) {
    _composer.stopWatching();
  }
  _composer = null;
}
