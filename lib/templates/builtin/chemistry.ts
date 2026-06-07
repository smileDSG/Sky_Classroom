/**
 * Built-in chemistry course templates.
 */

import type { CourseTemplate } from '../types';

export const CHEMISTRY_TEMPLATES: CourseTemplate[] = [
  {
    id: 'chem-equations',
    name: { 'zh-CN': '化学方程式配平', 'en-US': 'Balancing Equations' },
    subject: 'chemistry',
    grade: '9th',
    description: {
      'zh-CN': '逐步学习化学方程式配平',
      'en-US': 'Learn to balance chemical equations step by step',
    },
    icon: '🧪',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'medium' },
    outline: [
      { id: 'c1', title: 'What is a Chemical Equation?', type: 'slide' },
      { id: 'c2', title: 'Law of Conservation of Mass', type: 'slide' },
      { id: 'c3', title: 'Balancing Steps', type: 'slide' },
      { id: 'c4', title: 'Practice', type: 'interactive' },
      { id: 'c5', title: 'Quiz', type: 'quiz' },
    ],
  },
  {
    id: 'chem-periodic',
    name: { 'zh-CN': '元素周期表', 'en-US': 'Periodic Table' },
    subject: 'chemistry',
    grade: '9th',
    description: {
      'zh-CN': '探索元素周期表与元素性质',
      'en-US': 'Explore the periodic table and element properties',
    },
    icon: '🧪',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'easy' },
    outline: [
      { id: 'p1', title: 'Organization of the Table', type: 'slide' },
      { id: 'p2', title: 'Groups and Periods', type: 'slide' },
      { id: 'p3', title: 'Element Properties', type: 'slide' },
      { id: 'p4', title: 'Quiz', type: 'quiz' },
    ],
  },
];
