/**
 * Whiteboard tool types — user interaction tools for the interactive whiteboard.
 */

import type { PPTElement } from '@/lib/types/slides';

// ── Tool definitions ─────────────────────────────────────────────────

export type WhiteboardTool =
  | 'select'
  | 'pen'
  | 'eraser'
  | 'shape'
  | 'line'
  | 'text'
  | 'highlighter'
  | 'laser';

export type ShapeSubType = 'rect' | 'circle' | 'triangle' | 'star';
export type LineSubType = 'straight' | 'arrow' | 'dashed';

export const SHAPE_SUB_TYPES: { key: ShapeSubType; label: string }[] = [
  { key: 'rect', label: '矩形' },
  { key: 'circle', label: '圆形' },
  { key: 'triangle', label: '三角形' },
  { key: 'star', label: '星形' },
];

export const LINE_SUB_TYPES: { key: LineSubType; label: string }[] = [
  { key: 'straight', label: '直线' },
  { key: 'arrow', label: '箭头' },
  { key: 'dashed', label: '虚线' },
];

// ── Color presets ────────────────────────────────────────────────────

export const PEN_COLORS = [
  '#000000',
  '#e74c3c',
  '#e67e22',
  '#f1c40f',
  '#2ecc71',
  '#3498db',
  '#9b59b6',
  '#1abc9c',
  '#ffffff',
  '#95a5a6',
];

export const PEN_WIDTHS = [2, 4, 6, 10];

// ── Pen stroke ───────────────────────────────────────────────────────

export interface PenPoint {
  x: number;
  y: number;
}

export interface PenStroke {
  id: string;
  points: PenPoint[];
  color: string;
  width: number;
  tool: 'pen' | 'highlighter';
}

// ── User whiteboard state ────────────────────────────────────────────

export interface UserWhiteboardSnapshot {
  strokes: PenStroke[];
  elements: PPTElement[];
}

export interface UserWhiteboardState {
  // Active tool
  activeTool: WhiteboardTool;
  shapeSubType: ShapeSubType;
  lineSubType: LineSubType;

  // Pen settings
  penColor: string;
  penWidth: number;

  // Shape/line settings
  shapeColor: string;
  shapeFill: boolean;
  fontSize: number;

  // Raw data
  strokes: PenStroke[];
  userElements: PPTElement[];

  // Undo/redo
  undoStack: UserWhiteboardSnapshot[];
  redoStack: UserWhiteboardSnapshot[];

  // Toolbar UI
  toolbarExpanded: boolean;
  colorPickerOpen: boolean;

  // Drawing-in-progress (ephemeral, not persisted)
  drawingStroke: PenPoint[] | null;
  drawingShape: { type: ShapeSubType; start: PenPoint; end: PenPoint } | null;
  drawingLine: { type: LineSubType; start: PenPoint; end: PenPoint } | null;
}
