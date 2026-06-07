/**
 * JSON repair and parsing for AI-generated responses.
 *
 * Now powered by a pluggable RepairPipeline. Each repair strategy
 * is an independent module that can be tested, reordered, and
 * tracked via telemetry.
 *
 * Public API (backward compatible):
 *   parseJsonResponse<T>(response) → T | null
 *   tryParseJson<T>(jsonStr)        → T | null
 *
 * New with Zod support:
 *   parseWithSchema<T>(response, schema) → ZodParseResult<T>
 */

import type { ZodSchema } from 'zod';
import type {
  ParseResult,
  ZodParseResult,
  RepairStrategy,
  ExtractionStrategy,
} from './repair-strategies/types';
import { RepairPipeline } from './repair-pipeline';
import { repairTelemetry, annotateWithTelemetry } from './repair-telemetry';
import { createLogger } from '@/lib/logger';
const log = createLogger('Generation');

// ── Default pipeline instance ──

let defaultPipeline: RepairPipeline;

function getPipeline(): RepairPipeline {
  if (!defaultPipeline) {
    defaultPipeline = new RepairPipeline();
  }
  return defaultPipeline;
}

// ── Public: backward-compatible API ──

/**
 * Parse AI response text into typed JSON.
 * Tries code blocks first, then JSON windows, then raw text.
 */
export function parseJsonResponse<T>(response: string): T | null {
  const result = getPipeline().parse<T>(response);
  if (result.success && result.data !== undefined) {
    // Log repair chain for observability
    if (result.repairChain.length > 0) {
      log.debug(`JSON repair chain triggered: ${result.repairChain.join(' → ')}`);
    }
    return result.data;
  }
  return null;
}

/**
 * Try to parse a single JSON string with the repair chain.
 * Used by callers that already have an extracted JSON string.
 */
export function tryParseJson<T>(jsonStr: string): T | null {
  // Create a fresh pipeline that skips extraction (already done by caller)
  const pipeline = new RepairPipeline({
    extraction: [
      {
        name: 'provided',
        extract: (_raw: string) => [jsonStr],
      },
    ],
  });

  const result = pipeline.parse<T>(jsonStr);
  if (result.success && result.data !== undefined) {
    if (result.repairChain.length > 0) {
      log.debug(`tryParseJson repair chain: ${result.repairChain.join(' → ')}`);
    }
    return result.data;
  }
  return null;
}

// ── Public: Zod-validated API ──

/**
 * Parse + validate against a Zod schema.
 * Returns the full ParseResult with zodErrors on schema mismatch.
 */
export function parseWithSchema<T>(response: string, schema: ZodSchema<T>): ZodParseResult<T> {
  const pipeline = new RepairPipeline({ schema });
  return pipeline.parseWithZod<T>(response);
}

/**
 * Parse with schema using the global pipeline.
 */
export function parseJsonResponseWithSchema<T>(response: string, schema: ZodSchema<T>): T | null {
  const result = parseWithSchema<T>(response, schema);
  if (result.success && result.data !== undefined) {
    return result.data;
  }
  return null;
}

// ── Public: pipeline customization ──

/**
 * Get the default (singleton) pipeline for inspection or modification.
 */
export function getDefaultPipeline(): RepairPipeline {
  return getPipeline();
}

/**
 * Add a custom repair strategy to the default pipeline.
 */
export function registerRepairStrategy(strategy: RepairStrategy): void {
  getPipeline().addRepairStrategy(strategy);
}

/**
 * Add a custom extraction strategy to the default pipeline.
 */
export function registerExtractionStrategy(strategy: ExtractionStrategy): void {
  getPipeline().addExtractionStrategy(strategy);
}

/**
 * Remove a strategy by name from the default pipeline.
 */
export function unregisterStrategy(name: string): void {
  getPipeline().removeStrategy(name);
}

// ── Public: telemetry ──

export { repairTelemetry } from './repair-telemetry';
export type { TelemetrySnapshot, StrategyStats } from './repair-telemetry';

/**
 * Parse and annotate with telemetry snapshot for debugging.
 */
export function parseWithTelemetry<T>(
  response: string,
): ParseResult<T> & { telemetry: import('./repair-telemetry').TelemetrySnapshot } {
  const result = getPipeline().parse<T>(response);
  return annotateWithTelemetry(result);
}
