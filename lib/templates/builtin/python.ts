/**
 * Built-in Python course templates.
 */

import type { CourseTemplate } from '../types';

export const PYTHON_TEMPLATES: CourseTemplate[] = [
  {
    id: 'python-basics',
    name: { 'zh-CN': 'Python基础语法', 'en-US': 'Python Basics' },
    subject: 'programming',
    description: {
      'zh-CN': '从零开始学习 Python 变量、循环、函数和模块',
      'en-US': 'Learn Python variables, loops, functions, and modules from scratch',
    },
    icon: '🐍',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'easy' },
    outline: [
      { id: 'py1', title: 'Python 简介与环境搭建', type: 'slide' },
      { id: 'py2', title: '变量与数据类型', type: 'slide' },
      { id: 'py3', title: '条件语句与循环', type: 'slide' },
      { id: 'py4', title: '函数定义与调用', type: 'slide' },
      { id: 'py5', title: '列表与字典', type: 'interactive' },
      { id: 'py6', title: '模块与包管理', type: 'slide' },
      { id: 'py7', title: '综合练习', type: 'quiz' },
    ],
  },
  {
    id: 'python-data',
    name: { 'zh-CN': 'Python数据分析', 'en-US': 'Python Data Analysis' },
    subject: 'programming',
    description: {
      'zh-CN': '使用 Pandas、NumPy 和 Matplotlib 进行数据分析',
      'en-US': 'Data analysis with Pandas, NumPy, and Matplotlib',
    },
    icon: '🐍',
    isBuiltIn: true,
    suggestedSettings: { difficulty: 'medium' },
    outline: [
      { id: 'pd1', title: '数据分析概述', type: 'slide' },
      { id: 'pd2', title: 'NumPy 数组操作', type: 'slide' },
      { id: 'pd3', title: 'Pandas DataFrame', type: 'slide' },
      { id: 'pd4', title: '数据清洗与处理', type: 'interactive' },
      { id: 'pd5', title: 'Matplotlib 可视化', type: 'slide' },
      { id: 'pd6', title: '实战项目', type: 'quiz' },
    ],
  },
];
