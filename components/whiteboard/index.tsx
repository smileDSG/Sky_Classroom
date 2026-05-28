'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eraser, History, Minimize2, PencilLine, RotateCcw } from 'lucide-react';
import { WhiteboardCanvas } from './whiteboard-canvas';
import type { WhiteboardCanvasHandle } from './whiteboard-canvas';
import { WhiteboardHistory } from './whiteboard-history';
import { WhiteboardToolbar } from './whiteboard-toolbar';
import { DrawingCanvas } from './drawing-canvas';
import { ScreenElement } from '@/components/slide-renderer/Editor/ScreenElement';
import { useStageStore } from '@/lib/store';
import { useCanvasStore } from '@/lib/store/canvas';
import { useWhiteboardHistoryStore } from '@/lib/store/whiteboard-history';
import { useUserWhiteboardStore } from '@/lib/store/whiteboard-user';
import { createStageAPI } from '@/lib/api/stage-api';
import { toast } from 'sonner';
import { useI18n } from '@/lib/hooks/use-i18n';

interface WhiteboardProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Whiteboard component
 */
export function Whiteboard({ isOpen, onClose }: WhiteboardProps) {
  const { t } = useI18n();
  const stage = useStageStore.use.stage();
  const isClearing = useCanvasStore.use.whiteboardClearing();
  const clearingRef = useRef(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [viewModified, setViewModified] = useState(false);
  const canvasRef = useRef<WhiteboardCanvasHandle>(null);
  const snapshotCount = useWhiteboardHistoryStore((s) => s.snapshots.length);

  // Get element count for indicator
  const whiteboard = stage?.whiteboard?.[0];
  const elementCount = whiteboard?.elements?.length || 0;

  const stageAPI = createStageAPI(useStageStore);

  // Drawing state
  const userElements = useUserWhiteboardStore.use.userElements();
  const activeTool = useUserWhiteboardStore.use.activeTool();
  const editingTextId = useUserWhiteboardStore.use.editingTextId();
  const setEditingTextId = useUserWhiteboardStore.use.setEditingTextId();
  const updateTextContent = useUserWhiteboardStore.use.updateTextContent();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useUserWhiteboardStore.getState().undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        useUserWhiteboardStore.getState().redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Auto-focus textarea when entering text edit mode
  useEffect(() => {
    if (editingTextId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingTextId]);

  const DRAW_W = 1000;
  const DRAW_H = 562.5;

  const handleClear = async () => {
    if (!whiteboard || elementCount === 0 || clearingRef.current) return;
    clearingRef.current = true;

    // Save snapshot before clearing
    if (whiteboard.elements && whiteboard.elements.length > 0) {
      useWhiteboardHistoryStore.getState().pushSnapshot(whiteboard.elements);
    }

    // Trigger cascade exit animation
    useCanvasStore.getState().setWhiteboardClearing(true);

    // Wait for cascade: base 380ms + 55ms per element, capped at 1400ms
    const animMs = Math.min(380 + elementCount * 55, 1400);
    await new Promise((resolve) => setTimeout(resolve, animMs));

    // Actually remove elements
    const result = stageAPI.whiteboard.delete(whiteboard.id);
    useCanvasStore.getState().setWhiteboardClearing(false);
    clearingRef.current = false;

    if (result.success) {
      toast.success(t('whiteboard.clearSuccess'));
    } else {
      toast.error(t('whiteboard.clearError') + result.error);
    }
  };

  return (
    <>
      {/* Main Whiteboard Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: {
                type: 'spring',
                stiffness: 120,
                damping: 18,
                mass: 1.2,
              },
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 16,
              transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
            }}
            className="absolute inset-4 pointer-events-auto bg-white/95 dark:bg-gray-800/95 backdrop-blur-2xl rounded-3xl shadow-[0_32px_80px_-20px_rgba(0,0,0,0.25)] border-2 border-purple-200/60 dark:border-purple-700/60 flex flex-col overflow-hidden z-[120] ring-4 ring-purple-100/40 dark:ring-purple-800/40"
          >
            {/* Header */}
            <div className="h-14 px-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0 bg-white/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <PencilLine className="w-4 h-4" />
                </div>
                <span className="font-bold text-gray-800 dark:text-gray-200 tracking-tight">
                  {t('whiteboard.title')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <AnimatePresence>
                  {viewModified && (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => canvasRef.current?.resetView()}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                      title={t('whiteboard.resetView')}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </motion.button>
                  )}
                </AnimatePresence>
                <motion.button
                  type="button"
                  onClick={handleClear}
                  disabled={isClearing || elementCount === 0}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  title={t('whiteboard.clear')}
                >
                  <motion.div
                    animate={isClearing ? { rotate: [0, -15, 15, -10, 10, 0] } : { rotate: 0 }}
                    transition={
                      isClearing ? { duration: 0.5, ease: 'easeInOut' } : { duration: 0.2 }
                    }
                  >
                    <Eraser className="w-4 h-4" />
                  </motion.div>
                </motion.button>
                {/* History button + popover wrapper */}
                <div className="relative">
                  <motion.button
                    type="button"
                    onClick={() => setHistoryOpen(!historyOpen)}
                    whileTap={{ scale: 0.9 }}
                    className="relative p-2 text-gray-400 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                    title={t('whiteboard.history')}
                  >
                    <History className="w-4 h-4" />
                    {snapshotCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center">
                        {snapshotCount}
                      </span>
                    )}
                  </motion.button>
                  <WhiteboardHistory isOpen={historyOpen} onClose={() => setHistoryOpen(false)} />
                </div>
                <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1" />
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title={t('whiteboard.minimize')}
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Whiteboard Content Area */}
            <div
              className="flex-1 relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:24px_24px] overflow-hidden"
            >
              <WhiteboardCanvas ref={canvasRef} onViewModifiedChange={setViewModified} />

              {/* DrawingCanvas overlay */}
              <DrawingCanvas canvasWidth={DRAW_W} canvasHeight={DRAW_H} />

              {/* User-drawn elements */}
              <div className="absolute inset-0 z-[126] pointer-events-none" style={{ width: '100%', height: '100%' }}>
                {/* Editing textarea overlay */}
                {editingTextId && (() => {
                  const editingEl = userElements.find((e) => e.id === editingTextId) as { id: string; left: number; top: number; width: number; height: number; content: string; defaultColor: string; defaultFontName: string } | undefined;
                  if (!editingEl) return null;
                  const fs = useUserWhiteboardStore.getState().fontSize;
                  const handleCommit = () => {
                    const el = document.getElementById(`whiteboard-textarea-${editingTextId}`) as HTMLTextAreaElement | null;
                    if (el) {
                      const text = el.value;
                      if (text.trim()) {
                        updateTextContent(editingTextId, text);
                      } else {
                        // Delete empty text element
                        useUserWhiteboardStore.getState().deleteUserElement(editingTextId);
                      }
                    }
                    setEditingTextId(null);
                  };
                  return (
                    <textarea
                      id={`whiteboard-textarea-${editingTextId}`}
                      ref={textareaRef}
                      className="absolute resize-none outline-none pointer-events-auto"
                      style={{
                        left: `${(editingEl.left / DRAW_W) * 100}%`,
                        top: `${(editingEl.top / DRAW_H) * 100}%`,
                        width: `${(editingEl.width / DRAW_W) * 100}%`,
                        height: `${(editingEl.height / DRAW_H) * 100}%`,
                        fontSize: `${fs}px`,
                        color: editingEl.defaultColor,
                        fontFamily: editingEl.defaultFontName,
                        background: 'transparent',
                        border: '1px solid #6366f1',
                        borderRadius: '4px',
                        padding: '8px',
                        lineHeight: '1.5',
                        overflow: 'auto',
                      }}
                      defaultValue={editingEl.content || ''}
                      onBlur={handleCommit}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          handleCommit();
                        }
                      }}
                    />
                  );
                })()}
                {userElements.filter((e) => e.id !== editingTextId).map((element, index) => {
                  // Calculate bounding box - lines use start/end, others use left/top/width/height
                  const isLine = element.type === 'line';
                  const lineEl = isLine ? (element as { left: number; top: number; start: [number, number]; end: [number, number] }) : null;
                  const boxLeft = isLine && lineEl ? Math.min(lineEl.left + lineEl.start[0], lineEl.left + lineEl.end[0]) : ((element as { left: number }).left);
                  const boxTop = isLine && lineEl ? Math.min(lineEl.top + lineEl.start[1], lineEl.top + lineEl.end[1]) : ((element as { top: number }).top);
                  const boxW = isLine && lineEl ? Math.max(Math.abs(lineEl.end[0] - lineEl.start[0]), 24) : ((element as { width: number }).width);
                  const boxH = isLine && lineEl ? Math.max(Math.abs(lineEl.end[1] - lineEl.start[1]), 24) : (('height' in element) ? (element as { height: number }).height : undefined);
                  // Adjust internal coordinates relative to bounding box origin
                  const positioned = isLine && lineEl
                    ? { ...element, left: lineEl.left + lineEl.start[0] - boxLeft, top: lineEl.top + lineEl.start[1] - boxTop }
                    : { ...element, left: 0, top: 0 };
                  return (
                    <div
                      key={element.id}
                      className="absolute"
                      style={{
                        left: `${(boxLeft / DRAW_W) * 100}%`,
                        top: `${(boxTop / DRAW_H) * 100}%`,
                        width: `${(boxW / DRAW_W) * 100}%`,
                        ...(boxH != null ? { height: `${(boxH / DRAW_H) * 100}%` } : {}),
                        pointerEvents: activeTool === 'select' ? 'auto' : 'none',
                      }}
                    >
                      <div className="absolute inset-0">
                        <ScreenElement elementInfo={positioned} elementIndex={index} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* WhiteboardToolbar */}
              <WhiteboardToolbar />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
