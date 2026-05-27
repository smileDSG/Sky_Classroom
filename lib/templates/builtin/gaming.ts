/**
 * Built-in gaming course templates.
 */

import type { CourseTemplate } from '../types';

export const GAMING_TEMPLATES: CourseTemplate[] = [
  {
    id: 'game-design',
    name: { 'zh-CN': '游戏设计基础', 'en-US': 'Game Design Fundamentals' },
    subject: 'gaming',
    description: {
      'zh-CN': '学习游戏设计的核心原则：机制、关卡设计与玩家体验',
      'en-US': 'Learn core game design principles: mechanics, level design, and player experience',
    },
    icon: '🎮',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'easy' },
    outline: [
      { id: 'gd1', title: '什么是好的游戏设计？', type: 'slide' },
      { id: 'gd2', title: '核心游戏机制', type: 'slide' },
      { id: 'gd3', title: '关卡设计原则', type: 'slide' },
      { id: 'gd4', title: '玩家心理学', type: 'slide' },
      { id: 'gd5', title: '游戏分析练习', type: 'interactive' },
      { id: 'gd6', title: '小测验', type: 'quiz' },
    ],
  },
  {
    id: 'game-dev',
    name: { 'zh-CN': '游戏开发入门', 'en-US': 'Game Development Basics' },
    subject: 'gaming',
    description: {
      'zh-CN': '从零开始学习游戏开发，了解引擎选择与开发流程',
      'en-US': 'Start learning game development from scratch — engine selection and development workflow',
    },
    icon: '🕹️',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'medium' },
    outline: [
      { id: 'gdev1', title: '游戏引擎概览', type: 'slide' },
      { id: 'gdev2', title: 'Unity 入门', type: 'slide' },
      { id: 'gdev3', title: '游戏对象与脚本', type: 'slide' },
      { id: 'gdev4', title: '物理与碰撞系统', type: 'slide' },
      { id: 'gdev5', title: '小游戏实战', type: 'interactive' },
      { id: 'gdev6', title: '发布与测试', type: 'slide' },
      { id: 'gdev7', title: '综合测试', type: 'quiz' },
    ],
  },
];
