/**
 * Built-in physics course templates.
 */

import type { CourseTemplate } from '../types';

export const PHYSICS_TEMPLATES: CourseTemplate[] = [
  {
    id: 'physics-newton',
    name: "Newton's Laws",
    nameZh: '牛顿运动定律',
    subject: 'physics',
    grade: '10th',
    description: "Understand Newton's three laws of motion with interactive examples.",
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
    name: 'Optics Basics',
    nameZh: '光学基础',
    subject: 'physics',
    grade: '10th',
    description: 'Light, reflection, refraction, and lenses.',
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
