/**
 * Built-in physics course templates.
 */

import type { CourseTemplate } from '../types';

export const PHYSICS_TEMPLATES: CourseTemplate[] = [
  {
    id: 'physics-newton',
    name: { 'zh-CN': '牛顿运动定律', 'en-US': "Newton's Laws" },
    subject: 'physics',
    grade: '10th',
    description: {
      'zh-CN': '通过互动示例理解牛顿三大运动定律',
      'en-US': "Understand Newton's three laws of motion with interactive examples",
    },
    icon: '⚡',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'medium' },
    outline: [
      { id: 'n1', title: "Newton's First Law — Inertia", type: 'slide' },
      { id: 'n2', title: "Newton's Second Law — F=ma", type: 'slide' },
      { id: 'n3', title: "Newton's Third Law — Action & Reaction", type: 'slide' },
      { id: 'n4', title: 'Simulation', type: 'interactive' },
      { id: 'n5', title: 'Practice Problems', type: 'quiz' },
    ],
  },
  {
    id: 'physics-optics',
    name: { 'zh-CN': '光学基础', 'en-US': 'Optics Basics' },
    subject: 'physics',
    grade: '10th',
    description: {
      'zh-CN': '光、反射、折射与透镜',
      'en-US': 'Light, reflection, refraction, and lenses',
    },
    icon: '⚡',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'medium' },
    outline: [
      { id: 'o1', title: 'Nature of Light', type: 'slide' },
      { id: 'o2', title: 'Reflection', type: 'slide' },
      { id: 'o3', title: 'Refraction', type: 'slide' },
      { id: 'o4', title: 'Lenses', type: 'slide' },
      { id: 'o5', title: 'Quiz', type: 'quiz' },
    ],
  },
];
