/**
 * Shared types for the Sky Classroom slides/avatar module.
 */

import type { Slide } from '@/lib/types/slides';

// ── Avatar configuration ─────────────────────────────────────────

export interface AvatarConfig {
  id: string;
  name: string;               // "严肃教授"、"温柔学姐"、"幽默学渣"
  avatarUrl: string;          // 静态图片或 Lottie 动画
  voiceConfig: AvatarVoiceConfig;
  personality: string;        // 人设描述
}

export interface AvatarVoiceConfig {
  providerId: string;
  voiceId: string;
  speed: number;              // 0.5-2.0
  pitch: number;              // 0.5-2.0
}

// ── Avatar speech ────────────────────────────────────────────────

export interface AvatarSpeech {
  avatarId: string;
  segments: {
    text: string;
    audioUrl: string;
    duration: number;         // ms
  }[];
}

// ── Slide generation ─────────────────────────────────────────────

export interface SlideGenerationOptions {
  topic?: string;
  difficulty?: 'junior' | 'senior' | 'college';
  slideCount?: number;
  language?: string;
}

export interface SlideGenerationResult {
  slides: Slide[];
  generationTime: number;     // ms
}

// ── PPT export ───────────────────────────────────────────────────

export interface CourseExportConfig {
  title: string;
  includeSlides: boolean;
  includeSpeakerNotes: boolean;
  includeKnowledgePoints: boolean;
  includeSimilarQuestions: boolean;
  avatarName?: string;        // 虚拟形象名称（水印）
}

export interface CourseExportResult {
  fileUrl: string;
  fileName: string;
}
