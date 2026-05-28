/**
 * Whiteboard User Store — manages user-drawn elements and toolbar state.
 * Separate from AI-generated whiteboard content (useStageStore).
 */
import { create } from 'zustand';
import { createSelectors } from '@/lib/utils/create-selectors';
import type {
  WhiteboardTool, ShapeSubType, LineSubType,
  PenStroke, PenPoint,
  UserWhiteboardSnapshot,
} from '@/lib/types/whiteboard-tools';
import type { PPTElement } from '@/lib/types/slides';
import { nanoid } from 'nanoid';

// ── Shape path generation ───────────────────────────────────────────

function generateShapePath(shapeType: ShapeSubType, viewBox: string): string {
  const parts = viewBox.split(' ').map(Number);
  const w = parts[2] || 200;
  const h = parts[3] || 200;
  // viewBox format: "minX minY width height"
  const cx = w / 2;
  const cy = h / 2;

  switch (shapeType) {
    case 'rect':
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;

    case 'circle': {
      const rx = w / 2;
      const ry = h / 2;
      return `M ${cx} 0 A ${rx} ${ry} 0 1 1 ${cx} ${h} A ${rx} ${ry} 0 1 1 ${cx} 0 Z`;
    }

    case 'triangle':
      return `M ${cx} 0 L ${w} ${h} L 0 ${h} Z`;

    case 'star': {
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR * 0.382;
      let d = '';
      for (let i = 0; i < 5; i++) {
        const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const innerAngle = outerAngle + Math.PI / 5;
        const ox = cx + outerR * Math.cos(outerAngle);
        const oy = cy + outerR * Math.sin(outerAngle);
        const ix = cx + innerR * Math.cos(innerAngle);
        const iy = cy + innerR * Math.sin(innerAngle);
        if (i === 0) d += `M ${ox} ${oy} `;
        else d += `L ${ox} ${oy} `;
        d += `L ${ix} ${iy} `;
      }
      d += 'Z';
      return d;
    }

    default:
      return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function snapshotState(strokes: PenStroke[], elements: PPTElement[]): UserWhiteboardSnapshot {
  return {
    strokes: strokes.map((s) => ({ ...s, points: [...s.points] })),
    elements: elements.map((e) => ({ ...e }) as PPTElement),
  };
}

let _strokeCounter = 0;
function nextStrokeId(): string {
  _strokeCounter++;
  return `stroke_${Date.now()}_${_strokeCounter}`;
}

// ── Store ────────────────────────────────────────────────────────────

interface UserWhiteboardStore extends Record<string, unknown> {
  activeTool: WhiteboardTool;
  shapeSubType: ShapeSubType;
  lineSubType: LineSubType;
  penColor: string;
  penWidth: number;
  shapeColor: string;
  shapeFill: boolean;
  lineWidth: number;
  fontSize: number;
  strokes: PenStroke[];
  userElements: PPTElement[];
  undoStack: UserWhiteboardSnapshot[];
  redoStack: UserWhiteboardSnapshot[];
  toolbarExpanded: boolean;
  colorPickerOpen: boolean;
  drawingStroke: PenPoint[] | null;
  drawingShape: { type: ShapeSubType; start: PenPoint; end: PenPoint } | null;
  drawingLine: { type: LineSubType; start: PenPoint; end: PenPoint } | null;
  editingTextId: string | null;

  // Actions
  setActiveTool: (tool: WhiteboardTool) => void;
  setShapeSubType: (sub: ShapeSubType) => void;
  setLineSubType: (sub: LineSubType) => void;
  setPenColor: (color: string) => void;
  setPenWidth: (width: number) => void;
  setShapeColor: (color: string) => void;
  setShapeFill: (fill: boolean) => void;
  setLineWidth: (width: number) => void;
  setFontSize: (size: number) => void;
  setToolbarExpanded: (expanded: boolean) => void;
  setColorPickerOpen: (open: boolean) => void;

  // Drawing
  setDrawingStroke: (points: PenPoint[] | null) => void;
  addStrokePoint: (point: PenPoint) => void;
  setDrawingShape: (shape: { type: ShapeSubType; start: PenPoint; end: PenPoint } | null) => void;
  setDrawingLine: (line: { type: LineSubType; start: PenPoint; end: PenPoint } | null) => void;

  // Commit
  commitStroke: () => void;
  commitShape: () => void;
  commitLine: () => void;
  commitTextElement: (element: PPTElement) => void;
  deleteUserElement: (elementId: string) => void;
  deleteStroke: (strokeId: string) => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  pushSnapshot: () => void;

  // Eraser
  eraseAtPoint: (point: PenPoint, radius: number) => void;

  // Clear
  clearUserContent: () => void;

  // Text editing
  editingTextId: string | null;
  setEditingTextId: (id: string | null) => void;
  updateTextContent: (id: string, content: string) => void;
}

const useUserWhiteboardStoreBase = create<UserWhiteboardStore>((set, get) => ({
  activeTool: 'select',
  shapeSubType: 'rect',
  lineSubType: 'straight',
  penColor: '#000000',
  penWidth: 4,
  shapeColor: '#3498db',
  shapeFill: false,
  lineWidth: 2,
  fontSize: 20,
  strokes: [],
  userElements: [],
  undoStack: [],
  redoStack: [],
  toolbarExpanded: false,
  colorPickerOpen: false,
  drawingStroke: null,
  drawingShape: null,
  drawingLine: null,
  editingTextId: null,

  // ── Tool selection ──
  setActiveTool: (tool) => set({ activeTool: tool }),
  setShapeSubType: (sub) => set({ shapeSubType: sub }),
  setLineSubType: (sub) => set({ lineSubType: sub }),
  setPenColor: (color) => set({ penColor: color }),
  setPenWidth: (width) => set({ penWidth: width }),
  setShapeColor: (color) => set({ shapeColor: color }),
  setShapeFill: (fill) => set({ shapeFill: fill }),
  setLineWidth: (width) => set({ lineWidth: width }),
  setFontSize: (size) => set({ fontSize: size }),
  setToolbarExpanded: (expanded) => set({ toolbarExpanded: expanded }),
  setColorPickerOpen: (open) => set({ colorPickerOpen: open }),

  // ── Drawing in-progress ──
  setDrawingStroke: (points) => set({ drawingStroke: points }),
  addStrokePoint: (point) => {
    const current = get().drawingStroke;
    if (current) set({ drawingStroke: [...current, point] });
    else set({ drawingStroke: [point] });
  },
  setDrawingShape: (shape) => set({ drawingShape: shape }),
  setDrawingLine: (line) => set({ drawingLine: line }),

  // ── Commit actions ──
  pushSnapshot: () => {
    const { strokes, userElements, undoStack } = get();
    set({
      undoStack: [...undoStack.slice(-19), snapshotState(strokes, userElements)],
      redoStack: [],
    });
  },

  commitStroke: () => {
    const { drawingStroke, penColor, penWidth, activeTool, strokes } = get();
    if (!drawingStroke || drawingStroke.length < 2) {
      set({ drawingStroke: null });
      return;
    }
    const stroke: PenStroke = {
      id: nextStrokeId(),
      points: [...drawingStroke],
      color: penColor,
      width: penWidth,
      tool: activeTool === 'highlighter' ? 'highlighter' : 'pen',
    };
    get().pushSnapshot();
    set({ strokes: [...strokes, stroke], drawingStroke: null });
  },

  commitShape: () => {
    const { drawingShape, shapeColor, shapeFill, userElements } = get();
    if (!drawingShape) return;
    const { type, start, end } = drawingShape;
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    if (w < 5 || h < 5) { set({ drawingShape: null }); return; }

    const element = {
      id: nextStrokeId(),
      type: 'shape',
      left: x, top: y, width: w, height: h,
      viewBox: '0 0 200 200',
      path: generateShapePath(type, '0 0 200 200'),
      fill: shapeFill ? shapeColor : 'transparent',
      outline: { color: shapeColor, width: 2 },
      fixedRatio: false,
      rotate: 0,
    } as unknown as PPTElement;
    get().pushSnapshot();
    set({ userElements: [...userElements, element], drawingShape: null });
  },

  commitLine: () => {
    const { drawingLine, shapeColor, userElements, lineWidth } = get();
    if (!drawingLine) return;
    const { type, start, end } = drawingLine;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) { set({ drawingLine: null }); return; }
    const element = {
      id: nextStrokeId(),
      type: 'line',
      left: start.x, top: start.y,
      width: lineWidth,
      start: [0, 0] as [number, number],
      end: [dx, dy] as [number, number],
      style: type === 'dashed' ? 'dashed' : 'solid',
      points: type === 'arrow' ? ['', 'arrow'] as ['', 'arrow'] : ['', ''] as ['', ''],
      color: shapeColor,
    } as unknown as PPTElement;
    get().pushSnapshot();
    set({ userElements: [...userElements, element], drawingLine: null });
  },

  commitTextElement: (element) => {
    get().pushSnapshot();
    set({ userElements: [...get().userElements, element] });
  },

  deleteUserElement: (elementId) => {
    get().pushSnapshot();
    set({ userElements: get().userElements.filter((e) => e.id !== elementId) });
  },

  deleteStroke: (strokeId) => {
    get().pushSnapshot();
    set({ strokes: get().strokes.filter((s) => s.id !== strokeId) });
  },

  // ── Undo/redo ──
  undo: () => {
    const { undoStack, strokes, userElements, redoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, snapshotState(strokes, userElements)],
      strokes: prev.strokes,
      userElements: prev.elements,
    });
  },

  redo: () => {
    const { redoStack, strokes, userElements, undoStack } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, snapshotState(strokes, userElements)],
      strokes: next.strokes,
      userElements: next.elements,
    });
  },

  // ── Eraser ──
  eraseAtPoint: (point, radius) => {
    const { strokes } = get();
    const newStrokes: PenStroke[] = [];

    for (const stroke of strokes) {
      const segments: PenPoint[][] = [];
      let currentSegment: PenPoint[] = [];

      for (const p of stroke.points) {
        const dx = p.x - point.x;
        const dy = p.y - point.y;
        const hit = Math.sqrt(dx * dx + dy * dy) < radius;
        if (hit) {
          if (currentSegment.length >= 2) {
            segments.push(currentSegment);
          }
          currentSegment = [];
        } else {
          currentSegment.push(p);
        }
      }
      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }

      for (let i = 0; i < segments.length; i++) {
        newStrokes.push({
          ...stroke,
          id: i === 0 ? stroke.id : nextStrokeId(),
          points: segments[i],
        });
      }
    }

    set({ strokes: newStrokes });
  },

  clearUserContent: () => {
    get().pushSnapshot();
    set({ strokes: [], userElements: [], editingTextId: null });
  },

  // ── Text editing ──
  setEditingTextId: (id) => set({ editingTextId: id }),

  updateTextContent: (id, content) => {
    set({
      userElements: get().userElements.map((e) =>
        e.id === id ? { ...e, content } : e,
      ),
    });
  },
}));

export const useUserWhiteboardStore = createSelectors(useUserWhiteboardStoreBase);
