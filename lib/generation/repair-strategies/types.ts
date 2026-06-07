/**
 * Repair strategy interface for the pluggable JSON repair pipeline.
 *
 * Each strategy is a single-responsibility repair step that can be
 * independently tested, reordered, and telemetry-tracked.
 */

import type { ZodSchema } from 'zod';

export interface RepairContext {
  /** Original raw AI response text */
  rawResponse: string;
  /** Current JSON string being repaired */
  currentText: string;
  /** 0-based attempt index */
  attempt: number;
  /** Name of the strategy that was last applied */
  previousStrategy?: string;
}

export interface RepairResult {
  /** The repaired JSON string, or null if unrepairable */
  text: string | null;
  /** Strategy-specific metadata for telemetry */
  meta?: Record<string, unknown>;
}

export interface RepairStrategy {
  /** Unique name for telemetry tracking */
  name: string;
  /** Lower = earlier in the pipeline */
  priority: number;
  /** Attempt repair. Returns null if this strategy doesn't apply. */
  repair(context: RepairContext): RepairResult | null;
}

export interface ExtractionStrategy {
  name: string;
  /** Extract candidate JSON strings from raw response text */
  extract(rawResponse: string): string[];
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  /** Which extraction strategy found the JSON */
  extractionStrategy?: string;
  /** Which repair strategies were triggered (in order) */
  repairChain: string[];
}

export interface ZodParseResult<T> extends ParseResult<T> {
  /** Zod validation errors if schema was provided */
  zodErrors?: string[];
}

/** Repair pipeline configuration */
export interface PipelineConfig {
  /** Maximum number of repair passes (default 10) */
  maxRepairPasses?: number;
  /** Schema to validate final output against */
  schema?: ZodSchema;
  /** Minimum acceptable JSON parse depth */
  minDepth?: number;
}
