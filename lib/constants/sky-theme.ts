/**
 * Sky Classroom — 云端智囊 主题设计系统
 *
 * 设计方向：星空科技 + 东方意境
 * - 深邃星空蓝为主色调，搭配星光金点缀
 * - 玻璃拟态 + 微光效果营造氛围感
 * - 圆角卡片 + 柔和阴影提升质感
 */

// ── 主色调 ────────────────────────────────────────────────────────

export const SKY_COLORS = {
  // 主色 — 星空蓝紫渐变系
  primary: {
    50: '#f0f4ff',
    100: '#e0e9ff',
    200: '#c7d7fe',
    300: '#a5b8fc',
    400: '#818cf8',
    500: '#6366f1', // 主色
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },

  //  accent — 星光金/琥珀
  accent: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b', // 强调色
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // 背景色 — 深邃星空
  bg: {
    light: '#f8fafc',
    lightGradient: 'linear-gradient(135deg, #f0f4ff 0%, #f8fafc 50%, #e0e7ff 100%)',
    dark: '#0f172a',
    darkGradient: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #1e293b 100%)',
    cardLight: 'rgba(255, 255, 255, 0.7)',
    cardDark: 'rgba(30, 41, 59, 0.6)',
  },

  // 文字色
  text: {
    light: {
      primary: '#1e293b',
      secondary: '#64748b',
      muted: '#94a3b8',
    },
    dark: {
      primary: '#f1f5f9',
      secondary: '#cbd5e1',
      muted: '#94a3b8',
    },
  },

  // 功能色
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
};

// ── 玻璃拟态 ──────────────────────────────────────────────────────

export const GLASS = {
  light: {
    background: 'rgba(255, 255, 255, 0.7)',
    backgroundStrong: 'rgba(255, 255, 255, 0.85)',
    border: 'rgba(255, 255, 255, 0.5)',
    borderStrong: 'rgba(226, 232, 240, 0.8)',
    shadow: '0 8px 32px rgba(99, 102, 241, 0.08)',
    shadowHover: '0 12px 40px rgba(99, 102, 241, 0.15)',
  },
  dark: {
    background: 'rgba(15, 23, 42, 0.7)',
    backgroundStrong: 'rgba(15, 23, 42, 0.85)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.15)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    shadowHover: '0 12px 40px rgba(0, 0, 0, 0.4)',
  },
};

// ── 动画 ──────────────────────────────────────────────────────────

export const ANIMATIONS = {
  duration: {
    fast: '0.15s',
    normal: '0.3s',
    slow: '0.5s',
    slower: '0.8s',
  },
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  },
};

// ── 圆角 ──────────────────────────────────────────────────────────

export const RADIUS = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
  full: '9999px',
};

// ── 导航配置 ──────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  description?: string;
  badge?: string;
}

/** 主导航 — 云端智囊模块 */
export const MAIN_NAV_ITEMS: NavItem[] = [
  { label: '首页', href: '/sky', icon: 'Home', description: '学习概览' },
  {
    label: '云端智囊',
    href: '/sky/cloud-mind',
    icon: 'Brain',
    description: 'AI 工具集',
    badge: 'New',
  },
  { label: '学习数据', href: '/sky/learning', icon: 'BarChart3', description: '知识图谱' },
  { label: '小镜课堂', href: '/sky/assistant', icon: 'Sparkles', description: 'AI 助教' },
];

/** 云端智囊子功能 */
export const CLOUD_MIND_TOOLS = [
  {
    id: 'solve',
    label: '拍照搜题',
    description: '拍照识别题目，AI 智能解答',
    href: '/sky/cloud-mind/solve',
    icon: 'Camera',
    color: 'from-violet-500 to-purple-600',
    bgGlow: 'violet',
  },
  {
    id: 'slides',
    label: '幻灯片讲解',
    description: '上传课件，AI 生成精美讲解',
    href: '/sky/cloud-mind/slides',
    icon: 'Presentation',
    color: 'from-cyan-500 to-blue-600',
    bgGlow: 'cyan',
  },
  {
    id: 'quiz',
    label: '智能出题',
    description: '根据知识点自动生成练习',
    href: '/sky/cloud-mind/quiz',
    icon: 'FileQuestion',
    color: 'from-amber-500 to-orange-600',
    bgGlow: 'amber',
  },
  {
    id: 'memory',
    label: '记忆卡片',
    description: 'AI 生成记忆卡片，高效复习',
    href: '/sky/cloud-mind/memory',
    icon: 'Brain',
    color: 'from-rose-500 to-pink-600',
    bgGlow: 'rose',
  },
];
