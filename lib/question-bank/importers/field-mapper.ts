/**
 * Question Bank — field mapper for importers.
 *
 * Automatically maps raw column names (Chinese or English) to canonical
 * QuestionBankInsert field names.
 */

import type { FieldMappingResult, ImportOptions } from './types';
import { extractMultiColumnOptions } from './post-processor';

const log = { warn: console.warn, info: console.info };

// ── Canonical field aliases ─────────────────────────────────────────

const FIELD_ALIASES: Record<string, string[]> = {
  subject: ['subject', '学科', '科目', '课程', '学科名称'],
  grade: ['grade', '年级', '学段', '班级'],
  difficulty: ['difficulty', '难度', '难易度', '难度等级'],
  questionType: ['questionType', 'type', '题型', '题目类型', 'question_type', 'question type'],
  content: ['content', '题目', '题干', '问题', 'question', '题目内容', '试题'],
  answer: ['answer', '答案', '解答', '正确答案', '标准答案'],
  explanation: ['explanation', '解析', '说明', '答案解析', '题目解析'],
  knowledgePoints: [
    'knowledgePoints',
    '知识点',
    '考点',
    '知识要点',
    'knowledge_points',
    'knowledge points',
  ],
  image: ['image', '图片', '图像', '配图'],
  options: ['options', '选项', 'choices', '备选答案', 'choice'],
  source: ['source', '来源', '出处', '试卷来源'],
  tags: ['tags', '标签', '标记'],
};

const CANONICAL_FIELDS = Object.keys(FIELD_ALIASES);

// ── Auto-detect mapping ─────────────────────────────────────────────

/**
 * Build a mapping from raw column names to canonical QuestionBankInsert fields.
 *
 * Matching priority:
 * 1. Exact match (case-insensitive)
 * 2. Substring match (e.g. "学科" matches "subject")
 * 3. Unmapped columns are collected for manual review
 */
export function detectFieldMapping(rawColumns: string[]): FieldMappingResult {
  const mapping: Record<string, string> = {};
  const unmapped: string[] = [];
  const usedCanonical = new Set<string>();

  for (const raw of rawColumns) {
    const normalizedRaw = raw.trim().toLowerCase();
    if (!normalizedRaw) continue;

    // 1. Try custom mapping first (if provided by caller)
    //    (handled in applyFieldMapping, not here)

    // 2. Exact match
    let matched = false;
    for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
      const lowerAliases = aliases.map((a) => a.toLowerCase());
      if (lowerAliases.includes(normalizedRaw)) {
        mapping[raw] = canonical;
        usedCanonical.add(canonical);
        matched = true;
        break;
      }
    }

    if (matched) continue;

    // 3. Substring match (fuzzy fallback)
    for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
      const lowerAliases = aliases.map((a) => a.toLowerCase());
      if (
        lowerAliases.some((alias) => normalizedRaw.includes(alias) || alias.includes(normalizedRaw))
      ) {
        mapping[raw] = canonical;
        usedCanonical.add(canonical);
        matched = true;
        break;
      }
    }

    if (!matched) {
      unmapped.push(raw);
    }
  }

  // Detect conflicts: multiple raw columns mapped to same canonical field
  const reverseMap = new Map<string, string[]>();
  for (const [raw, canonical] of Object.entries(mapping)) {
    if (!reverseMap.has(canonical)) reverseMap.set(canonical, []);
    reverseMap.get(canonical)!.push(raw);
  }
  const conflicts = Array.from(reverseMap.entries())
    .filter(([, raws]) => raws.length > 1)
    .map(([canonical]) => canonical);

  if (unmapped.length > 0) {
    log.warn(`Unmapped columns: ${unmapped.join(', ')}`);
  }
  if (conflicts.length > 0) {
    log.warn(`Conflicting mappings for fields: ${conflicts.join(', ')}`);
  }

  return { mapping, unmapped, conflicts };
}

// ── Apply mapping to a row ──────────────────────────────────────────

/**
 * Convert a raw row (keyed by raw column names) into a partial
 * QuestionBankInsert using the detected mapping.
 */
export function applyFieldMapping(
  rawRow: Record<string, unknown>,
  mapping: Record<string, string>,
  options?: Pick<ImportOptions, 'defaultValues'>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [rawKey, value] of Object.entries(rawRow)) {
    const canonical = mapping[rawKey];
    if (canonical && CANONICAL_FIELDS.includes(canonical)) {
      result[canonical] = value;
    }
  }

  // Merge multi-column options (e.g. columns named "A", "B", "C", "D")
  const multiOptions = extractMultiColumnOptions(rawRow, mapping);
  if (multiOptions && multiOptions.length > 0) {
    const existing = result.options;
    if (!existing || (Array.isArray(existing) && existing.length === 0)) {
      result.options = multiOptions;
    }
  }

  // Apply defaults
  if (options?.defaultValues) {
    for (const [key, val] of Object.entries(options.defaultValues)) {
      if (result[key] === undefined || result[key] === null || result[key] === '') {
        result[key] = val;
      }
    }
  }

  return result;
}

// ── Merge custom mapping ────────────────────────────────────────────

/**
 * Merge user-provided custom mapping on top of auto-detected mapping.
 */
export function mergeMappings(
  autoDetected: FieldMappingResult,
  custom: Record<string, string>,
): FieldMappingResult {
  const merged: Record<string, string> = { ...autoDetected.mapping };

  for (const [raw, canonical] of Object.entries(custom)) {
    const trimmedRaw = raw.trim();
    const trimmedCanonical = canonical.trim();
    if (CANONICAL_FIELDS.includes(trimmedCanonical)) {
      merged[trimmedRaw] = trimmedCanonical;
    }
  }

  // Recompute conflicts
  const reverseMap = new Map<string, string[]>();
  for (const [raw, canonical] of Object.entries(merged)) {
    if (!reverseMap.has(canonical)) reverseMap.set(canonical, []);
    reverseMap.get(canonical)!.push(raw);
  }
  const conflicts = Array.from(reverseMap.entries())
    .filter(([, raws]) => raws.length > 1)
    .map(([canonical]) => canonical);

  return {
    mapping: merged,
    unmapped: autoDetected.unmapped.filter((u) => !(u in merged)),
    conflicts,
  };
}
