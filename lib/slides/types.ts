/**
 * Shared types for the Sky Classroom slides/avatar module.
 */

import type { Slide, PPTElement, PPTElementOutline } from '@/lib/types/slides';
import type { SlideLayoutType } from './layouts';

// ── Avatar configuration ─────────────────────────────────────────

export interface AvatarConfig {
  id: string;
  name: string; // "严肃教授"、"温柔学姐"、"幽默学渣"
  avatarUrl: string; // 静态图片或 Lottie 动画
  voiceConfig: AvatarVoiceConfig;
  personality: string; // 人设描述
  /** Injected into AI slide generation prompt to shape teaching style */
  teachingStylePrompt: string;
}

export interface AvatarVoiceConfig {
  providerId: string;
  voiceId: string;
  speed: number; // 0.5-2.0
  pitch: number; // 0.5-2.0
}

// ── Avatar speech ────────────────────────────────────────────────

export interface AvatarSpeech {
  avatarId: string;
  segments: {
    text: string;
    audioUrl: string;
    duration: number; // ms
    highlightElementId?: string; // element to highlight during playback
    slideIndex?: number; // which slide this segment belongs to
  }[];
}

// ── Slide generation ─────────────────────────────────────────────

export interface SlideGenerationOptions {
  topic?: string;
  difficulty?: 'junior' | 'senior' | 'college';
  slideCount?: number;
  language?: string;
  layout?: SlideLayoutType;
  /** Optional teaching style prompt from avatar config */
  personaPrompt?: string;
  /** Selected theme for the generated deck */
  themeId?: PptxThemeId;
  /** Target audience education level from user personalization settings */
  educationLevel?: string;
}

export interface SlideGenerationResult {
  slides: Slide[];
  generationTime: number; // ms
}

// ── Theme System ─────────────────────────────────────────────────

export type PptxThemeId =
  | 'sky-blue'
  | 'minimal'
  | 'academic'
  | 'tech-dark'
  | 'nature-fresh'
  | 'macaron-pink'
  | 'handdrawn';

/** Gradient definition for backgrounds */
export interface ThemeGradient {
  from: string;
  to: string;
  angle: number; // degrees, 0 = top-to-bottom
}

/** Decorative element definition for cover slides */
export interface DecorationDef {
  type: 'shape' | 'line' | 'gradient-overlay';
  position: { x: number; y: number; w: number; h: number };
  style: Record<string, unknown>;
}

/** Complete theme token system for slides and PPTX export */
export interface ThemeToken {
  id: PptxThemeId;
  name: string;
  description: string;
  // Colors
  coverBg: string;
  coverBgGradient?: ThemeGradient;
  contentBg: string;
  contentBgGradient?: ThemeGradient;
  accent: string;
  accentSecondary: string;
  accentLight: string;
  coverTitleColor: string;
  coverSubColor: string;
  bodyColor: string;
  bodyMutedColor: string;
  pageNumColor: string;
  dividerColor: string;
  // Typography
  fontFamily: string;
  headingFont: string;
  // Font size scale (pt)
  coverTitleSize: number;
  coverSubSize: number;
  titleFontSize: number;
  bodyFontSize: number;
  captionFontSize: number;
  bulletSize: number;
  // Layout
  useWideContent: boolean;
  pageMargin: number; // px
  contentMaxWidth: number; // px
  // Decorative
  coverDecorations: DecorationDef[];
  bulletStyle: 'dot' | 'square' | 'check' | 'arrow';
  // PPTX specific
  shadowColor: string;
  shapeOutlineColor: string;
}

// ── Template System ──────────────────────────────────────────────

export interface TemplateParamsV2 extends Record<string, unknown> {
  title?: string;
  subtitle?: string;
  bodyText?: string;
  leftText?: string;
  rightText?: string;
  bullets?: string[];
  formula?: string;
  formulaNote?: string;
  steps?: { title: string; text: string }[];
  quote?: string;
  quoteAuthor?: string;
  gridItems?: { title: string; text: string }[];
  tableHeaders?: string[];
  tableRows?: string[][];
  keyPoints?: string[];
  imageUrl?: string;
  imagePosition?: 'left' | 'right' | 'full' | 'top';
  imageCaption?: string;
  timelineItems?: { date: string; event: string }[];
  pros?: string[];
  cons?: string[];
  code?: string;
  codeLanguage?: string;
  // ── Teaching-specific params ──
  /** 目录页：章节列表 */
  sections?: { title: string; description?: string }[];
  /** 学习目标页：目标列表 */
  objectives?: { text: string; icon?: string }[];
  /** 章节过渡页：章节编号 */
  sectionNumber?: string;
  /** 章节过渡页：章节标题 */
  sectionTitle?: string;
  /** 章节过渡页：简短引言 */
  intro?: string;
  /** 练习页：题目 */
  question?: string;
  /** 练习页：选项 */
  options?: string[];
  /** 练习页：正确答案 */
  answer?: string;
  /** 练习页：答案解析 */
  explanation?: string;
}

export type CoverTemplateIdV2 =
  | 'cover-classic'
  | 'cover-modern'
  | 'cover-bold'
  | 'cover-full-image'
  | 'cover-gradient';

export type ContentTemplateIdV2 =
  | 'content-title-body'
  | 'content-two-col'
  | 'content-bullets'
  | 'content-formula'
  | 'content-steps'
  | 'content-quote'
  | 'content-grid2x2'
  | 'content-image'
  | 'content-table'
  | 'content-full-image'
  | 'content-timeline'
  | 'content-pros-cons'
  | 'content-code'
  | 'content-big-idea'
  | 'content-stats'
  | 'content-highlight'
  | 'content-diagram'
  | 'content-bar-chart'
  | 'content-pie-chart'
  | 'content-line-chart'
  | 'content-gradient-cards'
  | 'content-macaron-bullets'
  | 'content-infographic-3'
  | 'content-process-h'
  | 'content-pyramid'
  | 'content-venn'
  | 'content-split-highlight'
  // ── Teaching-specific templates ──
  | 'content-toc'
  | 'content-objectives'
  | 'content-section'
  | 'content-quiz';

export type EndTemplateIdV2 = 'end-summary' | 'end-thanks' | 'end-qa';

export type TemplateIdV2 = CoverTemplateIdV2 | ContentTemplateIdV2 | EndTemplateIdV2;

export interface TemplateDescriptorV2 {
  id: TemplateIdV2;
  name: string;
  description: string;
  category: 'cover' | 'content' | 'end';
  requiredParams: (keyof TemplateParamsV2)[];
  visualHint: string; // Description for AI prompt
}

/** 课件页面在教学流程中的角色 */
export type PageRole =
  | 'cover'
  | 'toc'
  | 'objectives'
  | 'introduction'
  | 'concept'
  | 'comparison'
  | 'example'
  | 'quiz'
  | 'summary'
  | 'end';

export interface TemplateSlotV2 {
  template: TemplateIdV2;
  /** 教学流程角色，用于指导模板选择和课件结构 */
  pageRole?: PageRole;
  params: TemplateParamsV2;
  /** Optional English prompt for AI image generation (cover / introduction slides) */
  imagePrompt?: string;
}

// ── PPT export ───────────────────────────────────────────────────

export interface CourseExportConfig {
  title: string;
  includeSlides: boolean;
  includeSpeakerNotes: boolean;
  includeKnowledgePoints: boolean;
  includeSimilarQuestions: boolean;
  avatarName?: string; // 虚拟形象名称（水印）
  themeId?: PptxThemeId;
}

export interface CourseExportResult {
  fileUrl: string;
  fileName: string;
}

// ── PPTX Element Handlers ────────────────────────────────────────

export interface PptxShapeMapping {
  shapeType: string;
  points?: Array<{ x: number; y: number }>;
}

export interface PptxImageOptions {
  data?: string; // base64 or URL
  path?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
