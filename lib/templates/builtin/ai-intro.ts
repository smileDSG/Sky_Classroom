/**
 * Built-in AI introduction course templates.
 */

import type { CourseTemplate } from '../types';

export const AI_INTRO_TEMPLATES: CourseTemplate[] = [
  {
    id: 'ai-basics',
    name: { 'zh-CN': 'AI入门基础', 'en-US': 'AI Fundamentals' },
    subject: 'ai',
    description: {
      'zh-CN': '了解人工智能的基本概念、发展历程和核心原理',
      'en-US': 'Understand the basic concepts, history, and core principles of artificial intelligence',
    },
    icon: '🤖',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'easy' },
    outline: [
      { id: 'ai1', title: '什么是人工智能？', type: 'slide' },
      { id: 'ai2', title: 'AI 发展历程', type: 'slide' },
      { id: 'ai3', title: '机器学习基础', type: 'slide' },
      { id: 'ai4', title: '深度学习简介', type: 'slide' },
      { id: 'ai5', title: 'AI 应用场景', type: 'interactive' },
      { id: 'ai6', title: '小测验', type: 'quiz' },
    ],
  },
  {
    id: 'ai-ethics',
    name: { 'zh-CN': 'AI伦理与安全', 'en-US': 'AI Ethics & Safety' },
    subject: 'ai',
    description: {
      'zh-CN': '探讨人工智能的伦理问题、偏见与安全挑战',
      'en-US': 'Explore ethical issues, bias, and safety challenges in artificial intelligence',
    },
    icon: '🤖',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'easy' },
    outline: [
      { id: 'ae1', title: '什么是 AI 伦理？', type: 'slide' },
      { id: 'ae2', title: '算法偏见案例', type: 'slide' },
      { id: 'ae3', title: '数据隐私与安全', type: 'slide' },
      { id: 'ae4', title: 'AI 治理框架', type: 'slide' },
      { id: 'ae5', title: '案例讨论', type: 'interactive' },
      { id: 'ae6', title: '小测验', type: 'quiz' },
    ],
  },
];
