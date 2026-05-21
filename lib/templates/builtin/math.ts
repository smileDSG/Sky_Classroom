/**
 * Built-in math course templates.
 */

import type { CourseTemplate } from './types';

export const MATH_TEMPLATES: CourseTemplate[] = [
  {
    id: 'math-quadratic',
    name: 'Quadratic Functions',
    nameZh: '二次函数专题',
    subject: 'math',
    grade: '9th',
    description: 'Explore quadratic equations, parabolas, vertex form, and real-world applications.',
    icon: '📐',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'medium' },
    outline: [
      { id: 'm1', title: 'Introduction to Quadratics', type: 'slide', description: 'What is a quadratic function?' },
      { id: 'm2', title: 'Standard Form', type: 'slide', description: 'y = ax² + bx + c' },
      { id: 'm3', title: 'Vertex Form', type: 'slide', description: 'y = a(x-h)² + k' },
      { id: 'm4', title: 'Graphing Practice', type: 'interactive', description: 'Plot parabolas' },
      { id: 'm5', title: 'Quiz', type: 'quiz', description: 'Test your understanding' },
    ],
  },
  {
    id: 'math-trigonometry',
    name: 'Trigonometry Basics',
    nameZh: '三角函数入门',
    subject: 'math',
    grade: '10th',
    description: 'Sine, cosine, tangent — the foundations of trigonometry.',
    icon: '📐',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'medium' },
    outline: [
      { id: 't1', title: 'Right Triangle Ratios', type: 'slide' },
      { id: 't2', title: 'Sine Function', type: 'slide' },
      { id: 't3', title: 'Cosine Function', type: 'slide' },
      { id: 't4', title: 'Tangent Function', type: 'slide' },
      { id: 't5', title: 'Unit Circle', type: 'interactive' },
      { id: 't6', title: 'Practice Quiz', type: 'quiz' },
    ],
  },
  {
    id: 'math-linear-equations',
    name: 'Linear Equations',
    nameZh: '一元一次方程',
    subject: 'math',
    grade: '7th',
    description: 'Solve linear equations step by step.',
    icon: '📐',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'easy' },
    outline: [
      { id: 'l1', title: 'What is an Equation?', type: 'slide' },
      { id: 'l2', title: 'Solving ax + b = c', type: 'slide' },
      { id: 'l3', title: 'Word Problems', type: 'interactive' },
      { id: 'l4', title: 'Quick Quiz', type: 'quiz' },
    ],
  },
];
