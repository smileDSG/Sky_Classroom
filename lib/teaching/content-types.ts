/**
 * D-003 Content Types — Teaching Content Block Definitions
 */

export interface ContentChunk {
  sectionId: string;
  type: 'text' | 'formula' | 'example' | 'quiz' | 'diagram';
  content: string; // 支持 Markdown + LaTeX
  order: number;
}

export interface TeachingStreamEvent {
  type: 'chunk' | 'section_start' | 'section_end' | 'done' | 'error';
  data: Record<string, unknown>;
}
