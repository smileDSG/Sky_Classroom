/**
 * Course template types (legacy).
 * For PPTD template types, see ./pptd-types.ts.
 */

export type LocalizedString = Record<string, string>;

export type CourseTemplateSubject =
  | 'math'
  | 'physics'
  | 'chemistry'
  | 'english'
  | 'ai'
  | 'programming'
  | 'anime'
  | 'gaming'
  | 'custom';

export interface CourseTemplateOutlineItem {
  id: string;
  title: string;
  type: 'slide' | 'quiz' | 'interactive' | 'pbl';
  description?: string;
}

export interface CourseTemplate {
  id: string;
  name: LocalizedString;
  subject: CourseTemplateSubject;
  description: LocalizedString;
  icon?: string;
  isBuiltIn?: boolean;
  grade?: string;
  suggestedSettings?: Record<string, unknown>;
  outline: CourseTemplateOutlineItem[];
}

export function resolveLocale(ls: LocalizedString, locale = 'zh-CN'): string {
  return ls[locale] ?? ls['en-US'] ?? ls['zh-CN'] ?? Object.values(ls)[0] ?? '';
}
