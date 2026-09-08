/**
 * Built-in FastAPI course templates.
 */

import type { CourseTemplate } from '../types';

export const FASTAPI_TEMPLATES: CourseTemplate[] = [
  {
    id: 'fastapi-basics',
    name: { 'zh-CN': 'FastAPI入门', 'en-US': 'FastAPI Getting Started' },
    subject: 'programming',
    description: {
      'zh-CN': '学习使用 FastAPI 构建高性能 RESTful API',
      'en-US': 'Learn to build high-performance RESTful APIs with FastAPI',
    },
    icon: '⚡',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'medium' },
    outline: [
      { id: 'fa1', title: 'FastAPI 简介', type: 'slide' },
      { id: 'fa2', title: '安装与第一个 API', type: 'slide' },
      { id: 'fa3', title: '路由与路径参数', type: 'slide' },
      { id: 'fa4', title: '请求体与 Pydantic 模型', type: 'slide' },
      { id: 'fa5', title: 'API 实践练习', type: 'interactive' },
      { id: 'fa6', title: '小测验', type: 'quiz' },
    ],
  },
  {
    id: 'fastapi-advanced',
    name: { 'zh-CN': 'FastAPI进阶实战', 'en-US': 'FastAPI Advanced Patterns' },
    subject: 'programming',
    description: {
      'zh-CN': '深入 FastAPI 中间件、认证、数据库集成与部署',
      'en-US':
        'Deep dive into FastAPI middleware, authentication, database integration, and deployment',
    },
    icon: '⚡',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'hard' },
    outline: [
      { id: 'faa1', title: '中间件与依赖注入', type: 'slide' },
      { id: 'faa2', title: 'JWT 认证与授权', type: 'slide' },
      { id: 'faa3', title: 'SQLAlchemy 数据库集成', type: 'slide' },
      { id: 'faa4', title: '异步编程', type: 'slide' },
      { id: 'faa5', title: '项目实战', type: 'interactive' },
      { id: 'faa6', title: 'Docker 部署', type: 'slide' },
      { id: 'faa7', title: '综合测试', type: 'quiz' },
    ],
  },
];
