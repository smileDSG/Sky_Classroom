/**
 * Template registry — built-in + user templates.
 */

import type { CourseTemplate } from './types';
import { MATH_TEMPLATES } from './builtin/math';
import { PHYSICS_TEMPLATES } from './builtin/physics';
import { CHEMISTRY_TEMPLATES } from './builtin/chemistry';
import { ENGLISH_TEMPLATES } from './builtin/english';

const BUILT_IN: CourseTemplate[] = [
  ...MATH_TEMPLATES,
  ...PHYSICS_TEMPLATES,
  ...CHEMISTRY_TEMPLATES,
  ...ENGLISH_TEMPLATES,
];

/** Get all built-in templates */
export function getBuiltInTemplates(): CourseTemplate[] {
  return [...BUILT_IN];
}

/** Get template by ID (built-in only) */
export function getTemplateById(id: string): CourseTemplate | null {
  return BUILT_IN.find((t) => t.id === id) ?? null;
}

/** Search templates by query (matches name, nameZh, description, subject) */
export function searchTemplates(query: string): CourseTemplate[] {
  const q = query.toLowerCase();
  return BUILT_IN.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.nameZh.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.subject.includes(q),
  );
}

/** Filter templates by subject */
export function getTemplatesBySubject(subject: CourseTemplate['subject']): CourseTemplate[] {
  if (subject === 'custom') return [];
  return BUILT_IN.filter((t) => t.subject === subject);
}
