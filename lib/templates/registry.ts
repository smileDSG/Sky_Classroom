/**
 * Template registry — built-in + user templates.
 */

import type { CourseTemplate, LocalizedString } from './types';
import { resolveLocale } from './types';
import {
  MATH_TEMPLATES,
  PHYSICS_TEMPLATES,
  CHEMISTRY_TEMPLATES,
  ENGLISH_TEMPLATES,
  AI_INTRO_TEMPLATES,
  PYTHON_TEMPLATES,
  FASTAPI_TEMPLATES,
  ANIME_TEMPLATES,
  GAMING_TEMPLATES,
} from './builtin';

const BUILT_IN: CourseTemplate[] = [
  ...MATH_TEMPLATES,
  ...PHYSICS_TEMPLATES,
  ...CHEMISTRY_TEMPLATES,
  ...ENGLISH_TEMPLATES,
  ...AI_INTRO_TEMPLATES,
  ...PYTHON_TEMPLATES,
  ...FASTAPI_TEMPLATES,
  ...ANIME_TEMPLATES,
  ...GAMING_TEMPLATES,
];

/** Resolve template name for a given locale */
export function getTemplateName(template: CourseTemplate, locale = 'zh-CN'): string {
  return resolveLocale(template.name as LocalizedString, locale);
}

/** Resolve template description for a given locale */
export function getTemplateDescription(template: CourseTemplate, locale = 'zh-CN'): string {
  return resolveLocale(template.description as LocalizedString, locale);
}

/** Get all built-in templates */
export function getBuiltInTemplates(): CourseTemplate[] {
  return [...BUILT_IN];
}

/** Get template by ID (built-in only) */
export function getTemplateById(id: string): CourseTemplate | null {
  return BUILT_IN.find((t) => t.id === id) ?? null;
}

/** Search templates by query (matches name, description, subject — locale-aware) */
export function searchTemplates(query: string, locale = 'zh-CN'): CourseTemplate[] {
  const q = query.toLowerCase();
  return BUILT_IN.filter((t) => {
    const name = getTemplateName(t, locale).toLowerCase();
    const desc = getTemplateDescription(t, locale).toLowerCase();
    return name.includes(q) || desc.includes(q) || t.subject.includes(q);
  });
}

/** Filter templates by subject */
export function getTemplatesBySubject(subject: CourseTemplate['subject']): CourseTemplate[] {
  if (subject === 'custom') return [];
  return BUILT_IN.filter((t) => t.subject === subject);
}

/** Get all unique subjects from built-in templates */
export function getAvailableSubjects(): CourseTemplate['subject'][] {
  return [...new Set(BUILT_IN.map((t) => t.subject))];
}
