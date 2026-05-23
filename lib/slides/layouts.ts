/**
 * Sky Classroom — Slide Layout Templates (B-001)
 *
 * Layouts define how elements are arranged within a content slide.
 * They are orthogonal to slide types (cover/content/end):
 * a "content" slide can use title-content, quiz, or image-caption layout.
 */

// ── Layout Types ───────────────────────────────────────────────────────

export type SlideLayoutType = 'title-content' | 'quiz' | 'image-caption';

export interface SlideLayout {
  id: SlideLayoutType;
  description: string;
  expectedElementTypes: string[];
  minElements: number;
  maxElements: number;
  /** Text describing the layout to the AI for prompt inclusion */
  aiPromptHint: string;
}

// ── Default Layout Configurations ──────────────────────────────────────

export const LAYOUTS: Record<SlideLayoutType, SlideLayout> = {
  'title-content': {
    id: 'title-content',
    description: 'Standard instructional slide with a title and content area',
    expectedElementTypes: ['text'],
    minElements: 2,
    maxElements: 30,
    aiPromptHint:
      'Use Simple Layout Mode: one title text at the top, one wide content area below containing all body text. No scattered card boxes.',
  },

  quiz: {
    id: 'quiz',
    description: 'Quiz slide with question text and answer choices',
    expectedElementTypes: ['text', 'shape'],
    minElements: 3,
    maxElements: 20,
    aiPromptHint:
      'Quiz layout: question text at top, answer choices below as labeled text elements. Use shapes for option backgrounds if desired.',
  },

  'image-caption': {
    id: 'image-caption',
    description: 'Visual slide with an image and descriptive caption or annotations',
    expectedElementTypes: ['text', 'image', 'shape', 'line'],
    minElements: 2,
    maxElements: 15,
    aiPromptHint:
      'Image-caption layout: place the image centrally or to one side, with caption text or annotations nearby. Use lines or shapes for emphasis.',
  },
};

// ── Layout Helpers ─────────────────────────────────────────────────────

export function getSlideLayout(type: SlideLayoutType): SlideLayout {
  return LAYOUTS[type];
}

export function getAllLayoutTypes(): SlideLayoutType[] {
  return Object.keys(LAYOUTS) as SlideLayoutType[];
}

export function isValidLayoutType(value: string): value is SlideLayoutType {
  return value in LAYOUTS;
}

export function getLayoutAIPromptHint(layoutType: SlideLayoutType): string {
  return LAYOUTS[layoutType]?.aiPromptHint ?? LAYOUTS['title-content'].aiPromptHint;
}
