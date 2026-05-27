/**
 * User custom template management (localStorage).
 */

import type { CourseTemplate, LocalizedString } from './types';
import { resolveLocale } from './types';

const STORAGE_KEY = 'openmaic-user-templates';

function getUserTemplates(): CourseTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUserTemplate(template: CourseTemplate): void {
  const templates = getUserTemplates();
  templates.push(template);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function updateUserTemplate(id: string, updates: Partial<CourseTemplate>): boolean {
  const templates = getUserTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  templates[idx] = { ...templates[idx], ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  return true;
}

export function deleteUserTemplate(id: string): boolean {
  const templates = getUserTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  return templates.length < getUserTemplates().length;
}

export function getAllTemplates(): CourseTemplate[] {
  return [...getUserTemplates()];
}

/** Convert a template to course requirements (for generation) */
export function templateToGenerationParams(template: CourseTemplate, locale = 'zh-CN'): Record<string, unknown> {
  return {
    requirement: `${resolveLocale(template.name as LocalizedString, locale)} — ${resolveLocale(template.description as LocalizedString, locale)}`,
    subject: template.subject,
    grade: template.grade,
    outline: template.outline,
    settings: template.suggestedSettings,
  };
}
