import type { StructuredContent } from '@/lib/generation/classroom-content-agent';
import type { TemplatePage } from './pptd-types';

export type TemplatePageName =
  | 'cover'
  | 'chapter'
  | 'text'
  | 'split'
  | 'bullets'
  | 'cards'
  | 'image_large'
  | 'image_half'
  | 'steps'
  | 'compare'
  | 'table'
  | 'formula'
  | 'ending';

const CONTENT_TYPE_TO_PAGE: Record<string, TemplatePageName> = {
  cover: 'cover',
  concept: 'text',
  case: 'split',
  compare: 'compare',
  process: 'steps',
  summary: 'bullets',
  table: 'table',
  formula: 'formula',
  quote: 'text',
  sidebar: 'split',
  image_large: 'image_large',
  image_half: 'image_half',
};

export function selectTemplatePage(
  content: StructuredContent,
  availablePages: Record<string, TemplatePage>
): { pageName: TemplatePageName; page: TemplatePage } {
  const type = content.type as string;
  const pageName = CONTENT_TYPE_TO_PAGE[type] ?? 'text';
  const page = availablePages[pageName];

  if (!page) {
    throw new Error(`Template page "${pageName}" not found in available pages`);
  }

  return { pageName: pageName as TemplatePageName, page };
}
