/**
 * Built-in anime course templates.
 */

import type { CourseTemplate } from '../types';

export const ANIME_TEMPLATES: CourseTemplate[] = [
  {
    id: 'anime-appreciation',
    name: { 'zh-CN': '动漫鉴赏', 'en-US': 'Anime Appreciation' },
    subject: 'anime',
    description: {
      'zh-CN': '从经典作品到现代动画，学习动漫的艺术风格与叙事技巧',
      'en-US': 'Learn about anime art styles and storytelling from classics to modern animation',
    },
    icon: '🎬',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'easy' },
    outline: [
      { id: 'an1', title: '动漫发展简史', type: 'slide' },
      { id: 'an2', title: '经典作品赏析', type: 'slide' },
      { id: 'an3', title: '角色设计风格', type: 'slide' },
      { id: 'an4', title: '分镜与叙事技巧', type: 'slide' },
      { id: 'an5', title: '作品讨论', type: 'interactive' },
      { id: 'an6', title: '小测验', type: 'quiz' },
    ],
  },
  {
    id: 'anime-creation',
    name: { 'zh-CN': '动漫创作基础', 'en-US': 'Anime Creation Basics' },
    subject: 'anime',
    description: {
      'zh-CN': '学习动漫角色设计、分镜绘制和基础动画制作',
      'en-US': 'Learn anime character design, storyboarding, and basic animation production',
    },
    icon: '🎨',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'medium' },
    outline: [
      { id: 'ac1', title: '角色设计基础', type: 'slide' },
      { id: 'ac2', title: '人体比例与表情', type: 'slide' },
      { id: 'ac3', title: '分镜绘制', type: 'slide' },
      { id: 'ac4', title: '色彩与光影', type: 'slide' },
      { id: 'ac5', title: '角色设计练习', type: 'interactive' },
      { id: 'ac6', title: '作品展示与评测', type: 'quiz' },
    ],
  },
];
