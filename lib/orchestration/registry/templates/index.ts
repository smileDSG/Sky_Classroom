export { teacherTemplate } from './teacher';
export { assistantTemplate } from './assistant';
export { STUDENT_TEMPLATES } from './students';

import { teacherTemplate } from './teacher';
import { assistantTemplate } from './assistant';
import { STUDENT_TEMPLATES } from './students';
import type { AgentTemplate } from '../types';

/** All default agent templates, keyed by template ID. */
export const ALL_DEFAULT_TEMPLATES: Record<string, AgentTemplate> = {
  teacher: teacherTemplate,
  assistant: assistantTemplate,
  ...STUDENT_TEMPLATES,
};

/** Default agent IDs used to seed the registry. */
export const DEFAULT_AGENT_IDS = [
  'default-1', // teacher
  'default-2', // assistant
  'default-3', // curious
  'default-4', // analytical
  'default-5', // creative
  'default-6', // note-taker
];

/** Map default agent IDs to their template IDs. */
export const DEFAULT_AGENT_TEMPLATE_MAP: Record<string, string> = {
  'default-1': 'teacher',
  'default-2': 'assistant',
  'default-3': 'curious',
  'default-4': 'analytical',
  'default-5': 'creative',
  'default-6': 'note-taker',
};
