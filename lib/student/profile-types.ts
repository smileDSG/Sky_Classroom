/**
 * D-001 Student Profile — Type Definitions
 */

import type { Subject } from '@/lib/solve/agents/analyze-types';
import type { MistakeCause } from '@/lib/solve/types';

export interface StudentProfile {
  userId: string;
  masteryBySubject: Record<Subject, number>; // 0~100 掌握度
  masteryByKnowledge: Record<string, number>; // 知识点 → 掌握度
  weakPoints: string[]; // 薄弱知识点（掌握度 < 30）
  strongPoints: string[]; // 强势知识点（掌握度 > 80）
  errorPatterns: ErrorPattern[]; // 错误模式分析
  totalQuestions: number;
  totalCorrect: number;
  lastUpdated: Date;
}

export interface ErrorPattern {
  knowledgePoint: string;
  errorType: MistakeCause;
  frequency: number;
  lastOccurrence: Date;
}

export interface ProfileCacheEntry {
  profile: StudentProfile;
  cachedAt: number; // timestamp ms
}
