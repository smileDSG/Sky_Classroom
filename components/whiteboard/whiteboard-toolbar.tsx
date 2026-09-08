'use client';

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MousePointer2,
  Pencil,
  Eraser,
  Square,
  Minus,
  Type,
  Highlighter,
  CircleDot,
  Undo2,
  Redo2,
  ChevronUp,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { useUserWhiteboardStore } from '@/lib/store/whiteboard-user';
import type { WhiteboardTool, ShapeSubType, LineSubType } from '@/lib/types/whiteboard-tools';
import {
  SHAPE_SUB_TYPES,
  LINE_SUB_TYPES,
  PEN_COLORS,
  PEN_WIDTHS,
} from '@/lib/types/whiteboard-tools';

// ── Tool definitions ──────────────────────────────────────────────────

interface ToolDef {
  tool: WhiteboardTool;
  icon: typeof MousePointer2;
  label: string;
}

const TOOLS: ToolDef[] = [
  { tool: 'select', icon: MousePointer2, label: '选择' },
  { tool: 'pen', icon: Pencil, label: '画笔' },
  { tool: 'eraser', icon: Eraser, label: '橡皮擦' },
  { tool: 'shape', icon: Square, label: '形状' },
  { tool: 'line', icon: Minus, label: '线条' },
  { tool: 'text', icon: Type, label: '文字' },
  { tool: 'highlighter', icon: Highlighter, label: '荧光笔' },
  { tool: 'laser', icon: CircleDot, label: '激光笔' },
];

// ── Sub-options panel ─────────────────────────────────────────────────

function PenOptions() {
  const penColor = useUserWhiteboardStore.use.penColor();
  const penWidth = useUserWhiteboardStore.use.penWidth();
  const setPenColor = useUserWhiteboardStore.use.setPenColor();
  const setPenWidth = useUserWhiteboardStore.use.setPenWidth();

  return (
    <div className="flex items-center gap-2 px-2">
      {PEN_COLORS.slice(0, 8).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setPenColor(c)}
          className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
          style={{
            backgroundColor: c,
            borderColor: penColor === c ? '#6366f1' : c === '#ffffff' ? '#d4d4d8' : c,
          }}
        />
      ))}
      {PEN_WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => setPenWidth(w)}
          className="flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-white/10"
          style={{
            background: penWidth === w ? 'rgba(99,102,241,0.3)' : undefined,
          }}
        >
          <div
            className="rounded-full bg-gray-200 dark:bg-gray-300"
            style={{ width: Math.min(w, 10), height: Math.min(w, 10) }}
          />
        </button>
      ))}
    </div>
  );
}

function ShapeOptions() {
  const shapeSubType = useUserWhiteboardStore.use.shapeSubType();
  const shapeColor = useUserWhiteboardStore.use.shapeColor();
  const shapeFill = useUserWhiteboardStore.use.shapeFill();
  const setShapeSubType = useUserWhiteboardStore.use.setShapeSubType();
  const setShapeColor = useUserWhiteboardStore.use.setShapeColor();
  const setShapeFill = useUserWhiteboardStore.use.setShapeFill();

  return (
    <div className="flex items-center gap-2 px-2">
      {SHAPE_SUB_TYPES.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => setShapeSubType(s.key)}
          className={`px-2 py-0.5 rounded text-xs transition-colors ${
            shapeSubType === s.key
              ? 'bg-indigo-500/30 text-indigo-200'
              : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          }`}
        >
          {s.label}
        </button>
      ))}
      <div className="w-px h-4 bg-white/20" />
      {PEN_COLORS.slice(0, 8).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setShapeColor(c)}
          className="w-4 h-4 rounded-full border transition-transform hover:scale-110"
          style={{
            backgroundColor: c,
            borderColor: shapeColor === c ? '#6366f1' : c === '#ffffff' ? '#d4d4d8' : c,
          }}
        />
      ))}
      <button
        type="button"
        onClick={() => setShapeFill(!shapeFill)}
        className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
          shapeFill ? 'bg-indigo-500/30 text-indigo-200' : 'text-gray-400 hover:text-gray-200'
        }`}
      >
        {shapeFill ? '填充' : '边框'}
      </button>
    </div>
  );
}

function LineOptions() {
  const lineSubType = useUserWhiteboardStore.use.lineSubType();
  const shapeColor = useUserWhiteboardStore.use.shapeColor();
  const lineWidth = useUserWhiteboardStore.use.lineWidth();
  const setLineSubType = useUserWhiteboardStore.use.setLineSubType();
  const setShapeColor = useUserWhiteboardStore.use.setShapeColor();
  const setLineWidth = useUserWhiteboardStore.use.setLineWidth();

  return (
    <div className="flex items-center gap-2 px-2">
      {LINE_SUB_TYPES.map((l) => (
        <button
          key={l.key}
          type="button"
          onClick={() => setLineSubType(l.key)}
          className={`px-2 py-0.5 rounded text-xs transition-colors ${
            lineSubType === l.key
              ? 'bg-indigo-500/30 text-indigo-200'
              : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          }`}
        >
          {l.label}
        </button>
      ))}
      <div className="w-px h-4 bg-white/20" />
      {PEN_WIDTHS.map((w) => (
        <button
          key={w}
          type="button"
          onClick={() => setLineWidth(w)}
          className="flex items-center justify-center w-7 h-7 rounded-md transition-colors hover:bg-white/10"
          style={{
            background: lineWidth === w ? 'rgba(99,102,241,0.3)' : undefined,
          }}
        >
          <div
            className="rounded-full bg-gray-200 dark:bg-gray-300"
            style={{ width: Math.min(w, 10), height: Math.min(w, 10) }}
          />
        </button>
      ))}
      <div className="w-px h-4 bg-white/20" />
      {PEN_COLORS.slice(0, 8).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setShapeColor(c)}
          className="w-4 h-4 rounded-full border transition-transform hover:scale-110"
          style={{
            backgroundColor: c,
            borderColor: shapeColor === c ? '#6366f1' : c === '#ffffff' ? '#d4d4d8' : c,
          }}
        />
      ))}
    </div>
  );
}

function TextOptions() {
  const fontSize = useUserWhiteboardStore.use.fontSize();
  const shapeColor = useUserWhiteboardStore.use.shapeColor();
  const setFontSize = useUserWhiteboardStore.use.setFontSize();
  const setShapeColor = useUserWhiteboardStore.use.setShapeColor();

  return (
    <div className="flex items-center gap-2 px-2">
      {[14, 18, 24, 32, 48].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => setFontSize(s)}
          className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
            fontSize === s
              ? 'bg-indigo-500/30 text-indigo-200'
              : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
          }`}
        >
          {s}
        </button>
      ))}
      <div className="w-px h-4 bg-white/20" />
      {PEN_COLORS.slice(0, 8).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setShapeColor(c)}
          className="w-4 h-4 rounded-full border transition-transform hover:scale-110"
          style={{
            backgroundColor: c,
            borderColor: shapeColor === c ? '#6366f1' : c === '#ffffff' ? '#d4d4d8' : c,
          }}
        />
      ))}
    </div>
  );
}

// ── Sub-options router ────────────────────────────────────────────────

function SubOptions() {
  const activeTool = useUserWhiteboardStore.use.activeTool();

  switch (activeTool) {
    case 'pen':
    case 'highlighter':
      return <PenOptions />;
    case 'shape':
      return <ShapeOptions />;
    case 'line':
      return <LineOptions />;
    case 'text':
      return <TextOptions />;
    default:
      return null;
  }
}

// ── Main toolbar ──────────────────────────────────────────────────────

export function WhiteboardToolbar() {
  const toolbarExpanded = useUserWhiteboardStore.use.toolbarExpanded();
  const activeTool = useUserWhiteboardStore.use.activeTool();
  const undoStack = useUserWhiteboardStore.use.undoStack();
  const redoStack = useUserWhiteboardStore.use.redoStack();
  const setActiveTool = useUserWhiteboardStore.use.setActiveTool();
  const setToolbarExpanded = useUserWhiteboardStore.use.setToolbarExpanded();
  const undo = useUserWhiteboardStore.use.undo();
  const redo = useUserWhiteboardStore.use.redo();
  const clearUserContent = useUserWhiteboardStore.use.clearUserContent();

  const handleToolClick = useCallback(
    (tool: WhiteboardTool) => {
      if (activeTool === tool) {
        setActiveTool('select');
      } else {
        setActiveTool(tool);
      }
    },
    [activeTool, setActiveTool],
  );

  const showSubOptions = ['pen', 'highlighter', 'shape', 'line', 'text'].includes(activeTool);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[130] flex flex-col items-center pointer-events-none">
      <AnimatePresence>
        {toolbarExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto mb-0 rounded-t-2xl bg-gray-900/95 backdrop-blur-xl border border-white/10 border-b-0 shadow-2xl"
          >
            {/* Sub-options row */}
            <AnimatePresence>
              {showSubOptions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-white/5">
                    <SubOptions />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tools row */}
            <div className="flex items-center gap-1 px-3 py-2">
              {TOOLS.map(({ tool, icon: Icon, label }) => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => handleToolClick(tool)}
                  className={`relative flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all hover:bg-white/10 ${
                    activeTool === tool ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-400'
                  }`}
                  title={label}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] leading-tight mt-0.5 opacity-70">{label}</span>
                </button>
              ))}

              <div className="w-px h-8 bg-white/10 mx-1" />

              {/* Clear all user content */}
              <button
                type="button"
                onClick={clearUserContent}
                className="flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all hover:bg-red-500/10 text-gray-400 hover:text-red-400"
                title="清空全部"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              {/* Undo */}
              <button
                type="button"
                onClick={undo}
                disabled={undoStack.length === 0}
                className="flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all hover:bg-white/10 text-gray-400 disabled:opacity-30 disabled:pointer-events-none"
                title="撤销"
              >
                <Undo2 className="w-5 h-5" />
              </button>

              {/* Redo */}
              <button
                type="button"
                onClick={redo}
                disabled={redoStack.length === 0}
                className="flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all hover:bg-white/10 text-gray-400 disabled:opacity-30 disabled:pointer-events-none"
                title="重做"
              >
                <Redo2 className="w-5 h-5" />
              </button>

              <div className="w-px h-8 bg-white/10 mx-1" />

              {/* Collapse */}
              <button
                type="button"
                onClick={() => setToolbarExpanded(false)}
                className="flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all hover:bg-white/10 text-gray-500"
                title="收起工具栏"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed toggle */}
      {!toolbarExpanded && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setToolbarExpanded(true)}
          className="pointer-events-auto mb-3 px-4 py-2 rounded-full bg-gray-900/90 backdrop-blur-xl border border-white/10 shadow-xl text-gray-400 hover:text-gray-200 transition-all flex items-center gap-2"
        >
          <Pencil className="w-4 h-4" />
          <span className="text-xs">绘图工具</span>
          <ChevronUp className="w-4 h-4" />
        </motion.button>
      )}
    </div>
  );
}
