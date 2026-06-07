/**
 * Course template types.
 */

export interface SceneOutlineItem {
  id: string;
  title: string;
  type: 'slide' | 'quiz' | 'interactive' | 'pbl';
  description?: string;
}

/** Localized string — values keyed by locale code. */
export type LocalizedString = {
  'zh-CN': string;
  'en-US': string;
  'zh-TW'?: string;
  'ja-JP'?: string;
  'ru-RU'?: string;
  'ar-SA'?: string;
};

/** Resolve a LocalizedString to a plain string for the given locale. */
export function resolveLocale(str: LocalizedString, locale: string): string {
  return (
    str[locale as keyof LocalizedString] ??
    str['zh-CN'] ??
    Object.values(str)[0] ??
    ''
  );
}

export type CourseTemplateSubject =
  | 'math'
  | 'physics'
  | 'chemistry'
  | 'english'
  | 'biology'
  | 'history'
  | 'ai'
  | 'programming'
  | 'anime'
  | 'gaming'
  | 'custom';

export interface CourseTemplate {
  id: string;
  name: LocalizedString;
  subject: CourseTemplateSubject;
  grade?: string;
  description: LocalizedString;
  outline: SceneOutlineItem[];
  suggestedSettings: {
    teacherAgent?: string;
    difficulty?: 'easy' | 'medium' | 'hard';
  };
  isBuiltIn: boolean;
  icon: string;
}
