/**
 * D-002 Lesson Planner — Type Definitions
 */

export interface LessonPlan {
  title: string;
  sections: LessonSection[];
  estimatedDuration: number; // 分钟
  focusPoints: string[]; // 重点强化知识点
}

export interface LessonSection {
  id: string;
  title: string;
  contentType: 'explanation' | 'example' | 'diagram' | 'quiz';
  depth: 'basic' | 'intermediate' | 'advanced';
  knowledgePoints: string[];
  estimatedDuration: number; // 分钟
  hasQuiz: boolean;
}

/** Content depth strategy based on student mastery */
export function getDepthForMastery(mastery: number): 'basic' | 'intermediate' | 'advanced' {
  if (mastery < 30) return 'basic';
  if (mastery <= 70) return 'intermediate';
  return 'advanced';
}
