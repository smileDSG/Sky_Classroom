/**
 * Modern Editor Theme Definitions
 *
 * 6 themes matched to real Slidesgo templates:
 *   sky-blue    → 蓝 (Nana Gradients: pink + blue)
 *   minimal     → 白 (Modern Shapes Math: white + green/pink)
 *   academic    → 黄 (HS Electives: warm cream + mint/yellow)
 *   tech-dark   → 紫 (Psoriasis Awareness: deep purple + pink)
 *   nature-fresh→ 绿 (Soft Green Gradient: neon green)
 *   macaron-pink→ 粉 (Lumment Gradient: yellow + pink/purple)
 */

import type { ThemeToken } from '../types';

const coverDecorations = {
  bottomBar: (accent: string): ThemeToken['coverDecorations'][number] => ({
    type: 'shape',
    position: { x: 0, y: 480, w: 1000, h: 82.5 },
    style: { fill: accent, opacity: 0.12 },
  }),
  topAccentLine: (accent: string): ThemeToken['coverDecorations'][number] => ({
    type: 'line',
    position: { x: 100, y: 140, w: 800, h: 4 },
    style: { color: accent, width: 3 },
  }),
  cornerCircle: (accent: string): ThemeToken['coverDecorations'][number] => ({
    type: 'shape',
    position: { x: 780, y: 40, w: 200, h: 200 },
    style: { fill: accent, opacity: 0.08, shape: 'ellipse' },
  }),
  gradientOverlay: (from: string, to: string): ThemeToken['coverDecorations'][number] => ({
    type: 'gradient-overlay',
    position: { x: 0, y: 0, w: 1000, h: 562.5 },
    style: { from, to, angle: 135 },
  }),
  leftBlock: (accent: string): ThemeToken['coverDecorations'][number] => ({
    type: 'shape',
    position: { x: 0, y: 0, w: 60, h: 562.5 },
    style: { fill: accent, opacity: 0.15 },
  }),
};

// ── Theme 1: Sky Blue → 蓝模板 (Nana Gradients: pink + blue) ───────

export const SKY_BLUE_THEME: ThemeToken = {
  id: 'sky-blue',
  name: '天空蓝',
  description: 'Nana Gradients 粉蓝渐变，活泼现代',
  coverBg: '#FFA4AB',
  coverBgGradient: { from: '#FFA4AB', to: '#A9DCE7', angle: 135 },
  contentBg: '#ffffff',
  contentBgGradient: undefined,
  accent: '#222BB1',
  accentSecondary: '#ECAFCC',
  accentLight: '#ffe4e6',
  coverTitleColor: '#222BB1',
  coverSubColor: '#595EAA',
  bodyColor: '#1e293b',
  bodyMutedColor: '#64748b',
  pageNumColor: '#ECAFCC',
  dividerColor: '#ffd1d5',
  fontFamily: 'Microsoft YaHei',
  headingFont: 'Montserrat',
  coverTitleSize: 40,
  coverSubSize: 20,
  titleFontSize: 28,
  bodyFontSize: 16,
  captionFontSize: 12,
  bulletSize: 18,
  useWideContent: false,
  pageMargin: 60,
  contentMaxWidth: 880,
  coverDecorations: [
    coverDecorations.gradientOverlay('#FFA4AB', '#A9DCE7'),
    {
      type: 'shape',
      position: { x: 820, y: 40, w: 180, h: 180 },
      style: { fill: '#D8A387', opacity: 0.15, shape: 'ellipse' },
    },
    {
      type: 'shape',
      position: { x: 60, y: 420, w: 120, h: 120 },
      style: { fill: '#ECAFCC', opacity: 0.25, shape: 'ellipse' },
    },
  ],
  bulletStyle: 'dot',
  shadowColor: 'rgba(34, 43, 177, 0.08)',
  shapeOutlineColor: '#ffd1d5',
};

// ── Theme 2: Minimal → 白模板 (Modern Shapes Math: white + green/pink)

export const MINIMAL_THEME: ThemeToken = {
  id: 'minimal',
  name: '极简白',
  description: 'Modern Shapes 纯白背景，绿粉几何点缀',
  coverBg: '#ffffff',
  coverBgGradient: { from: '#ffffff', to: '#f0fdf4', angle: 135 },
  contentBg: '#ffffff',
  accent: '#49DE93',
  accentSecondary: '#E962D1',
  accentLight: '#f0fdf4',
  coverTitleColor: '#424242',
  coverSubColor: '#49DE93',
  bodyColor: '#424242',
  bodyMutedColor: '#888888',
  pageNumColor: '#49DE93',
  dividerColor: '#e0ffee',
  fontFamily: 'Microsoft YaHei',
  headingFont: 'Inter',
  coverTitleSize: 42,
  coverSubSize: 20,
  titleFontSize: 30,
  bodyFontSize: 17,
  captionFontSize: 12,
  bulletSize: 18,
  useWideContent: true,
  pageMargin: 60,
  contentMaxWidth: 920,
  coverDecorations: [
    {
      type: 'shape',
      position: { x: 0, y: 0, w: 60, h: 562.5 },
      style: { fill: '#49DE93', opacity: 0.15 },
    },
    {
      type: 'shape',
      position: { x: 780, y: 380, w: 180, h: 180 },
      style: { fill: '#E962D1', opacity: 0.1, shape: 'ellipse' },
    },
    {
      type: 'shape',
      position: { x: 850, y: 60, w: 100, h: 100 },
      style: { fill: '#49DE93', opacity: 0.12, shape: 'ellipse' },
    },
  ],
  bulletStyle: 'square',
  shadowColor: 'rgba(73, 222, 147, 0.08)',
  shapeOutlineColor: '#e0ffee',
};

// ── Theme 3: Academic → 黄模板 (HS Electives: warm cream + mint/yellow)

export const ACADEMIC_THEME: ThemeToken = {
  id: 'academic',
  name: '学术风',
  description: 'HS Electives 暖白底色，薄荷绿与暖黄',
  coverBg: '#FAF5F2',
  coverBgGradient: { from: '#FAF5F2', to: '#FFE49E', angle: 135 },
  contentBg: '#FAF5F2',
  accent: '#B0E4CE',
  accentSecondary: '#FFA4A1',
  accentLight: '#f0fdf4',
  coverTitleColor: '#2C2C2C',
  coverSubColor: '#B0E4CE',
  bodyColor: '#2C2C2C',
  bodyMutedColor: '#666666',
  pageNumColor: '#FFA4A1',
  dividerColor: '#ffe4e1',
  fontFamily: 'Microsoft YaHei',
  headingFont: 'Georgia',
  coverTitleSize: 38,
  coverSubSize: 18,
  titleFontSize: 26,
  bodyFontSize: 15,
  captionFontSize: 12,
  bulletSize: 16,
  useWideContent: false,
  pageMargin: 60,
  contentMaxWidth: 880,
  coverDecorations: [
    {
      type: 'shape',
      position: { x: 0, y: 520, w: 1000, h: 42.5 },
      style: { fill: '#FFE49E', opacity: 0.3 },
    },
    {
      type: 'shape',
      position: { x: 820, y: 40, w: 160, h: 160 },
      style: { fill: '#B0E4CE', opacity: 0.2, shape: 'ellipse' },
    },
    {
      type: 'line',
      position: { x: 100, y: 420, w: 800, h: 2 },
      style: { color: '#FFA4A1', width: 2 },
    },
  ],
  bulletStyle: 'dot',
  shadowColor: 'rgba(176, 228, 206, 0.1)',
  shapeOutlineColor: '#ffe4e1',
};

// ── Theme 4: Tech Dark → 紫模板 (Psoriasis Awareness: deep purple + pink)

export const TECH_DARK_THEME: ThemeToken = {
  id: 'tech-dark',
  name: '科技暗色',
  description: '深紫底色搭配柔粉高光，沉稳不失温度',
  coverBg: '#4A388E',
  coverBgGradient: { from: '#4A388E', to: '#662E77', angle: 135 },
  contentBg: '#3d2d7a',
  contentBgGradient: undefined,
  accent: '#6E53CF',
  accentSecondary: '#FF8E9E',
  accentLight: 'rgba(110, 83, 207, 0.2)',
  coverTitleColor: '#ffffff',
  coverSubColor: '#FFB5C0',
  bodyColor: '#e8e0f5',
  bodyMutedColor: '#a89fd6',
  pageNumColor: '#FF8E9E',
  dividerColor: '#695A9F',
  fontFamily: 'Microsoft YaHei',
  headingFont: 'JetBrains Mono',
  coverTitleSize: 40,
  coverSubSize: 20,
  titleFontSize: 28,
  bodyFontSize: 16,
  captionFontSize: 12,
  bulletSize: 18,
  useWideContent: true,
  pageMargin: 60,
  contentMaxWidth: 920,
  coverDecorations: [
    {
      type: 'shape',
      position: { x: 700, y: 50, w: 250, h: 250 },
      style: { fill: '#6E53CF', opacity: 0.15, shape: 'ellipse' },
    },
    {
      type: 'shape',
      position: { x: 0, y: 500, w: 1000, h: 62.5 },
      style: { fill: '#FF8E9E', opacity: 0.1 },
    },
    {
      type: 'line',
      position: { x: 100, y: 360, w: 800, h: 1 },
      style: { color: '#FFB5C0', width: 1, opacity: 0.4 },
    },
  ],
  bulletStyle: 'arrow',
  shadowColor: 'rgba(0, 0, 0, 0.3)',
  shapeOutlineColor: '#695A9F',
};

// ── Theme 5: Nature Fresh → 清新模板 (浅绿/浅蓝，python-pptx 原生生成)

export const NATURE_FRESH_THEME: ThemeToken = {
  id: 'nature-fresh',
  name: '清新自然',
  description: '浅绿与浅蓝的自然搭配，护眼舒适',
  coverBg: '#E3F2FD',
  coverBgGradient: { from: '#E3F2FD', to: '#C8E6C9', angle: 135 },
  contentBg: '#ffffff',
  contentBgGradient: undefined,
  accent: '#4CAF50',
  accentSecondary: '#81C784',
  accentLight: '#E8F5E9',
  coverTitleColor: '#2E7D32',
  coverSubColor: '#4CAF50',
  bodyColor: '#212121',
  bodyMutedColor: '#757575',
  pageNumColor: '#81C784',
  dividerColor: '#C8E6C9',
  fontFamily: 'Microsoft YaHei',
  headingFont: 'Microsoft YaHei',
  coverTitleSize: 40,
  coverSubSize: 20,
  titleFontSize: 28,
  bodyFontSize: 16,
  captionFontSize: 12,
  bulletSize: 18,
  useWideContent: false,
  pageMargin: 60,
  contentMaxWidth: 880,
  coverDecorations: [
    {
      type: 'shape',
      position: { x: 820, y: 60, w: 160, h: 160 },
      style: { fill: '#4CAF50', opacity: 0.15, shape: 'ellipse' },
    },
    {
      type: 'shape',
      position: { x: 0, y: 480, w: 1000, h: 82.5 },
      style: { fill: '#81C784', opacity: 0.12 },
    },
    {
      type: 'shape',
      position: { x: 60, y: 60, w: 100, h: 100 },
      style: { fill: '#E3F2FD', opacity: 0.5, shape: 'ellipse' },
    },
  ],
  bulletStyle: 'check',
  shadowColor: 'rgba(76, 175, 80, 0.08)',
  shapeOutlineColor: '#C8E6C9',
};

// ── Theme 6: Macaron Pink → 粉模板 (Lumment Gradient: yellow + pink/purple)

export const MACARON_PINK_THEME: ThemeToken = {
  id: 'macaron-pink',
  name: '马卡龙粉',
  description: 'Lumment 黄粉紫渐变，温柔甜美',
  coverBg: '#fdf2f8',
  coverBgGradient: { from: '#f5ef9e', to: '#eea2b9', angle: 135 },
  contentBg: '#ffffff',
  contentBgGradient: undefined,
  accent: '#844085',
  accentSecondary: '#ee82b2',
  accentLight: '#fce7f3',
  coverTitleColor: '#5f1968',
  coverSubColor: '#844085',
  bodyColor: '#1e293b',
  bodyMutedColor: '#64748b',
  pageNumColor: '#d8b4d9',
  dividerColor: '#f5d0fe',
  fontFamily: 'Microsoft YaHei',
  headingFont: 'Montserrat',
  coverTitleSize: 40,
  coverSubSize: 20,
  titleFontSize: 28,
  bodyFontSize: 16,
  captionFontSize: 12,
  bulletSize: 18,
  useWideContent: false,
  pageMargin: 60,
  contentMaxWidth: 880,
  coverDecorations: [
    {
      type: 'gradient-overlay',
      position: { x: 0, y: 0, w: 1000, h: 562.5 },
      style: { from: '#f5ef9e', to: '#eea2b9', angle: 135 },
    },
    {
      type: 'shape',
      position: { x: 820, y: 40, w: 180, h: 180 },
      style: { fill: '#bfe0eb', opacity: 0.25, shape: 'ellipse' },
    },
    {
      type: 'shape',
      position: { x: 60, y: 420, w: 120, h: 120 },
      style: { fill: '#f5ef9e', opacity: 0.4, shape: 'ellipse' },
    },
    {
      type: 'line',
      position: { x: 100, y: 360, w: 800, h: 2 },
      style: { color: '#844085', width: 2, opacity: 0.3 },
    },
  ],
  bulletStyle: 'dot',
  shadowColor: 'rgba(132, 64, 133, 0.08)',
  shapeOutlineColor: '#f5d0fe',
};

// ── Theme 7: Handdrawn → 手绘风 (暖黄纸张 + 咖啡线条 + 手账感) ───────

export const HANDDRAWN_THEME: ThemeToken = {
  id: 'handdrawn',
  name: '手绘风',
  description: '暖黄纸张底色，手绘线条与涂鸦点缀，亲切自然',
  coverBg: '#F5F0E6',
  coverBgGradient: { from: '#F5F0E6', to: '#EDE4D3', angle: 135 },
  contentBg: '#FDFCF8',
  contentBgGradient: undefined,
  accent: '#D4A574',
  accentSecondary: '#8B9A7C',
  accentLight: '#F0E6D3',
  coverTitleColor: '#5C4033',
  coverSubColor: '#8B6F5C',
  bodyColor: '#3D3229',
  bodyMutedColor: '#A09080',
  pageNumColor: '#D4A574',
  dividerColor: '#E8DCC8',
  fontFamily: 'Microsoft YaHei',
  headingFont: 'Comic Sans MS',
  coverTitleSize: 38,
  coverSubSize: 18,
  titleFontSize: 26,
  bodyFontSize: 15,
  captionFontSize: 12,
  bulletSize: 16,
  useWideContent: false,
  pageMargin: 60,
  contentMaxWidth: 880,
  coverDecorations: [
    {
      type: 'shape',
      position: { x: 780, y: 30, w: 200, h: 200 },
      style: { fill: '#D4A574', opacity: 0.08, shape: 'ellipse' },
    },
    {
      type: 'shape',
      position: { x: 40, y: 400, w: 140, h: 140 },
      style: { fill: '#8B9A7C', opacity: 0.1, shape: 'ellipse' },
    },
    {
      type: 'line',
      position: { x: 120, y: 380, w: 760, h: 2 },
      style: { color: '#D4A574', width: 2, opacity: 0.25 },
    },
    {
      type: 'shape',
      position: { x: 880, y: 480, w: 60, h: 60 },
      style: { fill: '#D4A574', opacity: 0.15, shape: 'ellipse' },
    },
  ],
  bulletStyle: 'dot',
  shadowColor: 'rgba(92, 64, 51, 0.06)',
  shapeOutlineColor: '#D4A574',
};

// ── Registry ───────────────────────────────────────────────────────

export const ALL_THEMES: ThemeToken[] = [
  SKY_BLUE_THEME,
  MINIMAL_THEME,
  ACADEMIC_THEME,
  TECH_DARK_THEME,
  NATURE_FRESH_THEME,
  MACARON_PINK_THEME,
  HANDDRAWN_THEME,
];

export const THEME_MAP: Record<string, ThemeToken> = Object.fromEntries(
  ALL_THEMES.map((t) => [t.id, t]),
);

export function getThemeById(id: string): ThemeToken {
  return THEME_MAP[id] || NATURE_FRESH_THEME;
}

export function getAllThemeIds(): string[] {
  return ALL_THEMES.map((t) => t.id);
}

export function getAllThemes(): ThemeToken[] {
  return ALL_THEMES;
}
