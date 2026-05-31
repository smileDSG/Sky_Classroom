/**
 * Enrichment configuration — subject taxonomy, grade levels,
 * site whitelist, rate limits, and search parameters.
 *
 * All values can be overridden via environment variables.
 */

import type { SubjectConfig, GradeConfig, SubjectId } from './types';

// ── Subjects (priority order: 数学第一) ──────────────────────────────

export const SUBJECTS: SubjectConfig[] = [
  {
    id: 'math',
    label: '数学',
    labelEn: 'Math',
    searchKeywords: [
      '高中数学题',
      '高考数学真题',
      '大学数学题',
      '数学竞赛题',
      '函数题目',
      '几何证明题',
      '微积分习题',
      '线性代数题',
      '概率统计题',
    ],
    gradeLevels: ['junior', 'senior', 'college'],
    priority: 1,
  },
  {
    id: 'physics',
    label: '物理',
    labelEn: 'Physics',
    searchKeywords: [
      '高中物理题',
      '高考物理真题',
      '大学物理题',
      '力学题目',
      '电磁学题',
      '热力学题',
      '光学题',
      '近代物理题',
    ],
    gradeLevels: ['junior', 'senior', 'college'],
    priority: 2,
  },
  {
    id: 'chemistry',
    label: '化学',
    labelEn: 'Chemistry',
    searchKeywords: [
      '高中化学题',
      '高考化学真题',
      '大学化学题',
      '有机化学题',
      '无机化学题',
      '化学方程式',
      '化学反应题',
    ],
    gradeLevels: ['junior', 'senior', 'college'],
    priority: 3,
  },
  {
    id: 'chinese',
    label: '语文',
    labelEn: 'Chinese',
    searchKeywords: [
      '高中语文题',
      '高考语文真题',
      '文言文阅读题',
      '现代文阅读题',
      '作文题目',
    ],
    gradeLevels: ['junior', 'senior'],
    priority: 4,
  },
  {
    id: 'english',
    label: '英语',
    labelEn: 'English',
    searchKeywords: [
      '高中英语题',
      '高考英语真题',
      '英语阅读题',
      '英语完形填空',
      '英语语法题',
    ],
    gradeLevels: ['junior', 'senior'],
    priority: 5,
  },
  {
    id: 'biology',
    label: '生物',
    labelEn: 'Biology',
    searchKeywords: [
      '高中生物题',
      '高考生物真题',
      '遗传学题',
      '细胞生物学题',
    ],
    gradeLevels: ['senior'],
    priority: 6,
  },
  {
    id: 'history',
    label: '历史',
    labelEn: 'History',
    searchKeywords: [
      '高中历史题',
      '高考历史真题',
    ],
    gradeLevels: ['junior', 'senior'],
    priority: 7,
  },
  {
    id: 'geography',
    label: '地理',
    labelEn: 'Geography',
    searchKeywords: [
      '高中地理题',
      '高考地理真题',
    ],
    gradeLevels: ['junior', 'senior'],
    priority: 8,
  },
  {
    id: 'politics',
    label: '政治',
    labelEn: 'Politics',
    searchKeywords: [
      '高中政治题',
      '高考政治真题',
    ],
    gradeLevels: ['senior'],
    priority: 9,
  },
];

export const SUBJECT_MAP: Record<SubjectId, SubjectConfig> = Object.fromEntries(
  SUBJECTS.map((s) => [s.id, s]),
) as Record<SubjectId, SubjectConfig>;

// ── Grade levels ────────────────────────────────────────────────────

export const GRADES: GradeConfig[] = [
  { id: 'junior', label: '初中', searchSuffix: '初中' },
  { id: 'senior', label: '高中', searchSuffix: '高中' },
  { id: 'college', label: '大学', searchSuffix: '大学' },
];

export const GRADE_MAP: Record<string, GradeConfig> = Object.fromEntries(
  GRADES.map((g) => [g.id, g]),
);

// ── Allowed educational domains (robots.txt still checked) ───────────

/**
 * Public educational sites known to allow reasonable crawling.
 * Each entry requires manual verification of robots.txt before fetching.
 */
export const ALLOWED_DOMAINS: string[] = [
  // Public exam question banks
  'easylearn.baidu.com',
  'wenku.baidu.com',
  'jyeoo.com',           // 菁优网 — public question bank
  'zujuan.xkw.com',      // 组卷网
  '21cnjy.com',          // 21世纪教育网
  'zxxk.com',            // 学科网
  'doc88.com',
  'docin.com',
  // GitHub (open-source datasets)
  'github.com',
  'raw.githubusercontent.com',
  // Educational institutions
  'edu.cn',
  'moe.gov.cn',
  'neea.edu.cn',
];

// ── Rate limits ──────────────────────────────────────────────────────

/** Minimum milliseconds between requests to the same domain */
export const DOMAIN_RATE_LIMIT_MS = 5000;

/** Maximum total pages to fetch per enrichment run */
export const MAX_PAGES_PER_RUN = 100;

/** Maximum questions to extract per run */
export const MAX_QUESTIONS_PER_RUN = 200;

/** Maximum questions to store in question bank per run */
export const MAX_STORE_PER_RUN = 100;

/** Bing Search API max results per query */
export const BING_MAX_RESULTS_PER_QUERY = 15;

/** Max concurrent solve operations */
export const MAX_CONCURRENT_SOLVES = 5;

/** Minimum solve confidence to store in question bank */
export const MIN_STORE_CONFIDENCE = 0.65;

// ── Bing Search API ─────────────────────────────────────────────────

export const BING_API_ENDPOINT = 'https://api.bing.microsoft.com/v7.0/search';

/** Bing Search API key from env */
export function getBingApiKey(): string {
  return process.env.BING_API_KEY ?? process.env.BING_SEARCH_API_KEY ?? '';
}

/** Whether Bing Search is configured */
export function isBingConfigured(): boolean {
  return getBingApiKey().length > 0;
}

// ── Search query templates ──────────────────────────────────────────

/**
 * Build search queries for a given subject and grade level.
 * Combines subject keywords with grade-level suffixes.
 */
export function buildSearchQueries(
  subject: SubjectId,
  gradeLevel: string,
  count: number = 3,
): string[] {
  const sub = SUBJECT_MAP[subject];
  if (!sub) return [];

  const grade = GRADE_MAP[gradeLevel];
  const suffix = grade?.searchSuffix ?? '';

  const queries: string[] = [];

  // Use subject-specific keywords
  for (const kw of sub.searchKeywords.slice(0, count)) {
    if (suffix && !kw.includes(suffix)) {
      queries.push(`${kw} ${suffix}`);
    } else {
      queries.push(kw);
    }
  }

  // Add general query
  if (suffix) {
    queries.push(`${sub.label}${suffix}题目 含答案`);
  }

  return queries;
}

// ── Statistics helpers ───────────────────────────────────────────────

import type { EnrichJobStats } from './types';

export function createEmptyStats(): EnrichJobStats {
  return {
    totalSearched: 0,
    totalFetched: 0,
    totalExtracted: 0,
    totalSolved: 0,
    totalStored: 0,
    totalFailed: 0,
    bySubject: {},
  };
}
