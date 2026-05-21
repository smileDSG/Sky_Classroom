'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const DRAG_THRESHOLD = 4; // px of movement before it counts as a drag

interface DraggableQaButtonProps {
  className?: string;
}

export function DraggableQaButton({ className }: DraggableQaButtonProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 72 });
  const hasMovedRef = useRef(false);
  const originRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ dx: 0, dy: 0 });
  const positionRef = useRef(position);
  positionRef.current = position;

  const cleanupListeners = useCallback(
    (onMove: (e: MouseEvent | TouchEvent) => void, onUp: () => void) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if ((e.target as HTMLElement).closest('[data-toggle-collapse]')) return;

      hasMovedRef.current = false;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      originRef.current = { x: clientX, y: clientY };
      const pos = positionRef.current;
      offsetRef.current = { dx: clientX - pos.x, dy: clientY - pos.y };

      const onMove = (me: MouseEvent | TouchEvent) => {
        const mx = 'touches' in me ? me.touches[0].clientX : me.clientX;
        const my = 'touches' in me ? me.touches[0].clientY : me.clientY;
        const dist = Math.hypot(mx - originRef.current.x, my - originRef.current.y);
        if (dist > DRAG_THRESHOLD) {
          hasMovedRef.current = true;
        }
        if (!hasMovedRef.current) return;
        const btnW = collapsed ? 48 : 130;
        const newX = Math.max(0, Math.min(window.innerWidth - btnW, mx - offsetRef.current.dx));
        const newY = Math.max(0, Math.min(window.innerHeight - 48, my - offsetRef.current.dy));
        setPosition({ x: newX, y: newY });
      };

      const onUp = () => {
        cleanupListeners(onMove, onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    },
    [collapsed, cleanupListeners],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (hasMovedRef.current) return;
      e.stopPropagation();
      if (collapsed) {
        setCollapsed(false);
      } else {
        router.push('/sky/solve');
      }
    },
    [collapsed, router],
  );

  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed((prev) => !prev);
  }, []);

  return (
    <div
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 60,
        touchAction: 'none',
      }}
      className={cn('select-none cursor-grab active:cursor-grabbing', className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        {collapsed ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ duration: 0.15 }}
          >
            <button
              onClick={handleClick}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30 hover:shadow-xl hover:shadow-sky-500/40 flex items-center justify-center active:scale-95 transition-shadow"
            >
              <MessageSquare className="w-5 h-5" />
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5"
          >
            <button
              onClick={handleClick}
              className="h-9 px-3 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white text-sm font-medium shadow-lg shadow-sky-500/30 hover:shadow-xl hover:shadow-sky-500/40 flex items-center gap-1.5 active:scale-95 transition-shadow whitespace-nowrap"
            >
              <MessageSquare className="w-4 h-4" />
              <span>答疑</span>
            </button>
            <button
              data-toggle-collapse
              onClick={handleToggleCollapse}
              className="w-7 h-7 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 text-gray-500 dark:text-gray-400 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 active:scale-90 transition-all shadow-sm"
            >
              <Minimize2 className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
