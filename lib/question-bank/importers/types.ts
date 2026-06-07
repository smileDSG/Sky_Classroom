/**
 * Question Bank Importers — unified types and interfaces.
 *
 * All format-specific importers (JSON, CSV, Excel, PDF) implement the
 * `Importer` interface so the batch-import API can treat them uniformly.
 */

import type { QuestionBankInsert } from '@/lib/question-bank/types';

// ── Importer interface ──────────────────────────────────────────────

export interface Importer<T = unknown> {
  name: string;
  supportedExtensions: string[];
  supportedMimeTypes: string[];
  parse(source: T, options?: ImportOptions): Promise<ImportPipelineResult>;
}

// ── Options ─────────────────────────────────────────────────────────

export interface ImportOptions {
  /** Custom column name → canonical field mapping. Overrides auto-detection. */
  fieldMapping?: Record<string, keyof QuestionBankInsert | string>;
  /** Skip validation (internal use only). */
  skipValidation?: boolean;
  /** Default values for missing fields. */
  defaultValues?: Partial<QuestionBankInsert>;
  /** Maximum rows to process (safety limit). */
  maxRows?: number;
}

// ─o Pipeline result ─────────────────────────────────────────────────

export interface ImportPipelineResult {
  entries: QuestionBankInsert[];
  rawErrors: ImportRowError[];
  meta: ImportMeta;
}

export interface ImportRowError {
  row: number;
  field?: string;
  value?: unknown;
  reason: string;
}

export interface ImportMeta {
  totalRows: number;
  parsedRows: number;
  sheetName?: string;
  fileName?: string;
}

// ── Field mapping ───────────────────────────────────────────────────

export interface FieldMappingResult {
  mapping: Record<string, string>;      // raw column → canonical field
  unmapped: string[];                    // columns that could not be mapped
  conflicts: string[];                   // multiple raw columns mapped to same canonical field
}
