/**
 * Personalized Highlighter — 知识点个性化标记引擎
 *
 * 根据学生画像，在授课内容中对知识点进行颜色标记。
 */

import type { StudentProfile } from '@/lib/student/profile-types';

export interface KnowledgePointHighlight {
  point: string;
  level: 'weak' | 'error-prone' | 'strong' | 'normal';
  mastery: number;
  errorCount: number;
}

/**
 * Analyze content and return highlight info for matched knowledge points.
 */
export function analyzeHighlights(
  content: string,
  profile: StudentProfile | null | undefined,
): KnowledgePointHighlight[] {
  if (!profile || !profile.masteryByKnowledge) return [];

  const highlights: KnowledgePointHighlight[] = [];
  for (const [point, mastery] of Object.entries(profile.masteryByKnowledge)) {
    if (!content.includes(point)) continue;

    const errorCount = profile.errorPatterns
      .filter((p) => p.knowledgePoint === point)
      .reduce((sum, p) => sum + p.frequency, 0);

    let level: 'weak' | 'error-prone' | 'strong' | 'normal';
    if (mastery < 30) level = 'weak';
    else if (mastery > 80) level = 'strong';
    else if (errorCount > 0) level = 'error-prone';
    else level = 'normal';

    highlights.push({ point, level, mastery, errorCount });
  }

  // Sort by length descending so longer phrases are matched first
  return highlights.sort((a, b) => b.point.length - a.point.length);
}

/** Split text by highlight points and render each part. */
export function splitHighlightedText(
  text: string,
  highlights: KnowledgePointHighlight[],
): Array<{ text: string; highlight?: KnowledgePointHighlight }> {
  if (highlights.length === 0) return [{ text }];

  const escaped = highlights.map((h) =>
    h.point.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  const regex = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(regex);

  return parts.map((part) => {
    const highlight = highlights.find((h) => h.point === part);
    return { text: part, highlight };
  });
}

export const HIGHLIGHT_STYLES: Record<string, string> = {
  weak: 'border-l-2 border-red-400 bg-red-500/5 px-1 rounded cursor-help',
  'error-prone': 'border-l-2 border-yellow-400 bg-yellow-500/5 px-1 rounded cursor-help',
  strong: 'border-l-2 border-emerald-400 bg-emerald-500/5 px-1 rounded cursor-help',
};

export function getHighlightTooltip(h: KnowledgePointHighlight): string {
  switch (h.level) {
    case 'weak':
      return `掌握度仅 ${h.mastery}%，是你的薄弱点，建议重点听讲`;
    case 'error-prone':
      return `该知识点你曾经答错 ${h.errorCount} 次，注意避免重复犯错`;
    case 'strong':
      return `该知识点你已掌握（${h.mastery}%），可快速浏览`;
    default:
      return `掌握度 ${h.mastery}%`;
  }
}
