/**
 * D-003 Content Types — Teaching Content Block Definitions
 */

export interface ContentChunk {
  sectionId: string;
  type: 'text' | 'formula' | 'example' | 'quiz' | 'diagram';
  content: string; // 支持 Markdown + LaTeX
  order: number;
  failed?: boolean; // 标记生成失败的 chunk
  isFollowUp?: boolean; // 标记为追问补充内容
  // Quiz-specific fields (optional, for structured quiz)
  options?: string[];
  correctAnswer?: number; // Index of the correct option (0-based)
  answerHash?: string; // Hash of the answer, not the answer itself
  explanationHash?: string; // Hash of the explanation
  question?: string; // Structured question text
}

export interface PrecedingSection {
  title: string;
  knowledgePoints: string[];
  depth: string;
  contentSummary: string; // 前 200 字摘要
}

export interface TeachingStreamEvent {
  type: 'chunk' | 'section_start' | 'section_end' | 'done' | 'error';
  data: Record<string, unknown>;
}
