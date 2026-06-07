/**
 * Pluggable JSON repair pipeline orchestrator.
 *
 * Coordinates extraction strategies (pull JSON from raw text) and
 * repair strategies (fix malformed JSON strings). Strategies are
 * registered by priority and executed in order.
 *
 * Usage:
 *   const pipeline = new RepairPipeline({ extraction, repair });
 *   const result = pipeline.parse<MyType>(aiResponse);
 */

import type {
  ExtractionStrategy,
  RepairStrategy,
  RepairContext,
  ParseResult,
  ZodParseResult,
} from './repair-strategies/types';
import type { PipelineConfig } from './repair-strategies/types';
import {
  DEFAULT_EXTRACTION_STRATEGIES,
  DEFAULT_REPAIR_STRATEGIES,
} from './repair-strategies/index';
import { repairTelemetry } from './repair-telemetry';
import { createLogger } from '@/lib/logger';
const log = createLogger('RepairPipeline');

export class RepairPipeline {
  private extractionStrategies: ExtractionStrategy[];
  private repairStrategies: RepairStrategy[];
  private config: PipelineConfig;

  constructor(
    config?: PipelineConfig & {
      extraction?: ExtractionStrategy[];
      repair?: RepairStrategy[];
    },
  ) {
    this.extractionStrategies = config?.extraction ?? [...DEFAULT_EXTRACTION_STRATEGIES];
    this.repairStrategies = (config?.repair ?? [...DEFAULT_REPAIR_STRATEGIES]).sort(
      (a, b) => a.priority - b.priority,
    );
    this.config = { maxRepairPasses: 10, ...config };
  }

  /** Register an additional extraction strategy (appended) */
  addExtractionStrategy(strategy: ExtractionStrategy): void {
    this.extractionStrategies.push(strategy);
  }

  /** Register an additional repair strategy (auto-sorted by priority) */
  addRepairStrategy(strategy: RepairStrategy): void {
    this.repairStrategies.push(strategy);
    this.repairStrategies.sort((a, b) => a.priority - b.priority);
  }

  /** Remove a strategy by name */
  removeStrategy(name: string): void {
    this.extractionStrategies = this.extractionStrategies.filter((s) => s.name !== name);
    this.repairStrategies = this.repairStrategies.filter((s) => s.name !== name);
  }

  /** Parse raw AI response into typed JSON, with extraction + repair */
  parse<T>(rawResponse: string): ParseResult<T> {
    repairTelemetry.recordCall();

    // Phase 1: Extract candidate JSON strings
    const candidates = this.extractCandidates(rawResponse);

    // Phase 2: For each candidate, try parsing with repair chain
    for (const [candIdx, candidate] of candidates.entries()) {
      const result = this.repairAndParse<T>(rawResponse, candidate);
      if (result.success) {
        repairTelemetry.recordSuccess();
        return {
          ...result,
          extractionStrategy: candidate.source,
        };
      }
    }

    return { success: false, repairChain: [] };
  }

  /** Parse with Zod schema validation */
  parseWithZod<T>(rawResponse: string): ZodParseResult<T> {
    const result = this.parse<T>(rawResponse);
    if (!result.success || !this.config.schema) {
      return { ...result, zodErrors: undefined };
    }

    const zodResult = this.config.schema.safeParse(result.data);
    if (!zodResult.success) {
      return {
        ...result,
        success: false,
        zodErrors: zodResult.error.issues.map((e) => `${String(e.path.join('.'))}: ${e.message}`),
      };
    }

    return { ...result, data: zodResult.data as T };
  }

  // ── Private ──

  private extractCandidates(rawResponse: string): Array<{ text: string; source: string }> {
    const seen = new Set<string>();

    for (const strategy of this.extractionStrategies) {
      repairTelemetry.recordStrategyInvocation(strategy.name);
      const extracted = strategy.extract(rawResponse);
      for (const text of extracted) {
        if (!seen.has(text)) {
          seen.add(text);
          // Return immediately on first match — extraction is sequential
          return [{ text, source: strategy.name }];
        }
      }
    }

    // Fallback: whole response as raw
    if (!seen.has(rawResponse.trim())) {
      return [{ text: rawResponse.trim(), source: 'raw' }];
    }

    return [];
  }

  private repairAndParse<T>(
    rawResponse: string,
    candidate: { text: string; source: string },
  ): ParseResult<T> {
    const repairChain: string[] = [];
    const ctx: RepairContext = {
      rawResponse,
      currentText: candidate.text,
      attempt: 0,
    };

    // Try direct parse first
    const parsed = this.tryJsonParse<T>(ctx.currentText);
    if (parsed !== null) {
      log.debug(`Parsed "${candidate.source}" directly`);
      return { success: true, data: parsed, repairChain };
    }

    // Apply repair strategies in priority order
    for (let pass = 0; pass < (this.config.maxRepairPasses ?? 10); pass++) {
      let repairedThisPass = false;

      for (const strategy of this.repairStrategies) {
        ctx.attempt = pass;
        ctx.previousStrategy = repairChain[repairChain.length - 1];

        const t0 = performance.now();
        repairTelemetry.recordStrategyInvocation(strategy.name);

        let repairResult;
        try {
          repairResult = strategy.repair(ctx);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          repairTelemetry.recordError(strategy.name, msg);
          log.warn(`Strategy "${strategy.name}" threw: ${msg}`);
          continue;
        }

        const elapsed = performance.now() - t0;

        if (!repairResult) continue;

        repairTelemetry.recordRepair(strategy.name, elapsed);
        repairChain.push(strategy.name);
        ctx.currentText = repairResult.text ?? ctx.currentText;

        // Try to parse the repaired text
        const result = this.tryJsonParse<T>(ctx.currentText);
        if (result !== null) {
          repairTelemetry.recordStrategySuccess(strategy.name);
          log.debug(
            `Repair chain (${repairChain.join(' → ')}) succeeded for "${candidate.source}"`,
          );
          return { success: true, data: result, repairChain };
        }

        repairedThisPass = true;
      }

      if (!repairedThisPass) break;
    }

    // All attempts failed
    log.warn(
      `Failed to parse after ${repairChain.length > 0 ? 'repair chain: ' + repairChain.join(' → ') : 'all attempts'} for "${candidate.source}"`,
    );
    log.warn('Raw (first 500 chars):', candidate.text.substring(0, 500));

    return { success: false, repairChain };
  }

  private tryJsonParse<T>(text: string): T | null {
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }
}
