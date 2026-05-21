/**
 * Built-in english course templates.
 */

import type { CourseTemplate } from './types';

export const ENGLISH_TEMPLATES: CourseTemplate[] = [
  {
    id: 'eng-tenses',
    name: 'English Tenses',
    nameZh: '语法时态练习',
    subject: 'english',
    grade: '7th',
    description: 'Master past, present, and future tenses with interactive exercises.',
    icon: '📖',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'easy' },
    outline: [
      { id: 'e1', title: 'Simple Present', type: 'slide' },
      { id: 'e2', title: 'Simple Past', type: 'slide' },
      { id: 'e3', title: 'Simple Future', type: 'slide' },
      { id: 'e4', title: 'Continuous Tenses', type: 'slide' },
      { id: 'e5', title: 'Practice', type: 'interactive' },
      { id: 'e6', title: 'Quiz', type: 'quiz' },
    ],
  },
  {
    id: 'eng-reading',
    name: 'Reading Skills',
    nameZh: '阅读理解技巧',
    subject: 'english',
    grade: '8th',
    description: 'Strategies for understanding and analyzing texts.',
    icon: '📖',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'medium' },
    outline: [
      { id: 'r1', title: 'Skimming and Scanning', type: 'slide' },
      { id: 'r2', title: 'Context Clues', type: 'slide' },
      { id: 'r3', title: 'Main Idea vs Details', type: 'slide' },
      { id: 'r4', title: 'Reading Passage', type: 'interactive' },
      { id: 'r5', title: 'Comprehension Quiz', type: 'quiz' },
    ],
  },
];
