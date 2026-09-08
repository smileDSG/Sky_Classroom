/**
 * Client-safe utilities for recommending classroom configuration
 * based on a finished lesson plan.
 */

import type { LessonPlan } from '@/lib/teaching/lesson-types';
import type { GeneratedSectionData } from '@/lib/server/teaching-job-store';

export interface TeachingToClassroomConfig {
  selectedTeacherId: string;
  selectedStudentIds: string[];
  enableTTS: boolean;
  enableImageGeneration: boolean;
  enableVideoGeneration: boolean;
  enableWebSearch: boolean;
}

const DEFAULT_TEACHER_ID = 'default-1';
const DEFAULT_STUDENT_IDS = ['default-3', 'default-4'];

export const DEFAULT_CLASSROOM_CONFIG: TeachingToClassroomConfig = {
  selectedTeacherId: DEFAULT_TEACHER_ID,
  selectedStudentIds: [...DEFAULT_STUDENT_IDS],
  enableTTS: true,
  enableImageGeneration: true,
  enableVideoGeneration: false,
  enableWebSearch: false,
};

/**
 * Recommend a teacher/student combination based on the lesson plan content.
 */
export function recommendAgentsFromLessonPlan(
  plan: LessonPlan | null | undefined,
  sections: GeneratedSectionData[],
): { teacherId: string; studentIds: string[] } {
  const teacherId = DEFAULT_TEACHER_ID;
  const studentIds = [...DEFAULT_STUDENT_IDS];

  const topic = (plan?.title || '').toLowerCase();
  const allKps = sections
    .flatMap((s) => s.section.knowledgePoints)
    .join(' ')
    .toLowerCase();
  const text = `${topic} ${allKps}`;

  const isMathScienceCode = /数学|物理|化学|编程|代码|python|算法|几何|函数|方程|统计|微积分/.test(
    text,
  );
  const isLanguageHumanities = /语文|英语|历史|地理|文学|单词|背诵|语法|阅读|政治|经济/.test(text);
  const isArt = /美术|音乐|设计|绘画|创意|艺术|摄影/.test(text);

  if (isMathScienceCode && !studentIds.includes('default-5')) {
    studentIds.push('default-5');
  }
  if (isLanguageHumanities && !studentIds.includes('default-6')) {
    studentIds.push('default-6');
  }
  if (isArt && !studentIds.includes('default-5')) {
    studentIds.push('default-5');
  }

  const duration = plan?.estimatedDuration || sections.length * 5;
  if (duration > 20 || sections.length > 5) {
    if (!studentIds.includes('default-7')) {
      studentIds.push('default-7');
    }
  }

  return {
    teacherId,
    studentIds: studentIds.slice(0, 4),
  };
}
