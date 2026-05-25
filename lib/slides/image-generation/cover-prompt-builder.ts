/**
 * Cover & Concept Image Prompt Builders
 *
 * Constructs English prompts for image generation tailored to
 * educational slide covers and concept illustrations.
 */

import type { ThemeToken } from '@/lib/slides/types';

/**
 * Build a prompt for a cover background image.
 */
export function buildCoverPrompt(topic: string, theme: ThemeToken): string {
  const palette = [theme.accent, theme.accentSecondary, theme.coverBg]
    .filter(Boolean)
    .join(', ');

  return `Educational presentation cover illustration for "${topic}".
Style: Clean, modern, flat design with subtle gradients. Abstract conceptual art.
Color palette: ${palette}.
No text, no letters, no words, no watermark.
16:9 widescreen composition, high quality, suitable for PowerPoint cover slide background.
Avoid: cluttered details, realistic photographs, people faces.`;
}

/**
 * Build a prompt for a concept illustration (diagram / infographic style).
 */
export function buildConceptPrompt(
  topic: string,
  conceptSummary: string,
  theme: ThemeToken,
): string {
  const palette = [theme.accent, theme.coverBg].filter(Boolean).join(', ');

  return `Educational illustration explaining "${conceptSummary}" in the context of "${topic}".
Style: Clean infographic style, simple diagrams, flat icons, minimal decorative elements.
Color palette: ${palette} on white background.
16:9 widescreen, no text labels, no letters, no watermark.
Suitable for insertion into a PowerPoint slide.`;
}

/**
 * Select the appropriate prompt builder based on page role.
 */
export function buildSlideImagePrompt(
  topic: string,
  contentSummary: string,
  theme: ThemeToken,
  pageRole: string,
): string {
  if (pageRole === 'cover' || pageRole === 'introduction') {
    return buildCoverPrompt(topic, theme);
  }
  return buildConceptPrompt(topic, contentSummary, theme);
}
