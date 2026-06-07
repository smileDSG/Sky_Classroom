export { curiousStudentTemplate } from './curious';
export { analyticalStudentTemplate } from './analytical';
export { creativeStudentTemplate } from './creative';
export { noteTakerStudentTemplate } from './note-taker';

import { curiousStudentTemplate } from './curious';
import { analyticalStudentTemplate } from './analytical';
import { creativeStudentTemplate } from './creative';
import { noteTakerStudentTemplate } from './note-taker';
import type { AgentTemplate } from '../../types';

export const STUDENT_TEMPLATES: Record<string, AgentTemplate> = {
  curious: curiousStudentTemplate,
  analytical: analyticalStudentTemplate,
  creative: creativeStudentTemplate,
  'note-taker': noteTakerStudentTemplate,
};
