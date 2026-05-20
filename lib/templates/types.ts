/**
 * Course template types.
 */

export interface SceneOutlineItem {
  id: string;
  title: string;
  type: 'slide' | 'quiz' | 'interactive' | 'pbl';
  description?: string;
}

export interface CourseTemplate {
  id: string;
  name: string;
  nameZh: string;
  subject: 'math' | 'physics' | 'chemistry' | 'english' | 'biology' | 'history' | 'custom';
  grade?: string;
  description: string;
  outline: SceneOutlineItem[];
  suggestedSettings: {
    teacherAgent?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
  };
  isBuiltIn: boolean;
  icon: string;
}
