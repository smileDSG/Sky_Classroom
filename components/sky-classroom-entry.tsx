'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Minus } from 'lucide-react';

const DRAG_THRESHOLD = 4;

export function SkyClassroomEntry() {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const hasMovedRef = useRef(false);
  const originRef = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ dx: 0, dy: 0 });
  const positionRef = useRef(position);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-toggle-collapse]')) return;

    hasMovedRef.current = false;
    originRef.current = { x: e.clientX, y: e.clientY };
    const pos = positionRef.current;
    offsetRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };

    const el = containerRef.current;
    if (el) {
      el.setPointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const el = containerRef.current;
      if (!el || !el.hasPointerCapture(e.pointerId)) return;

      const dist = Math.hypot(e.clientX - originRef.current.x, e.clientY - originRef.current.y);
      if (dist > DRAG_THRESHOLD) {
        hasMovedRef.current = true;
      }
      if (!hasMovedRef.current) return;

      const btnW = collapsed ? 36 : 120;
      const btnH = 36;
      const newX = Math.max(
        0,
        Math.min(window.innerWidth - btnW, e.clientX - offsetRef.current.dx),
      );
      const newY = Math.max(
        0,
        Math.min(window.innerHeight - btnH, e.clientY - offsetRef.current.dy),
      );
      setPosition({ x: newX, y: newY });
    },
    [collapsed],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const el = containerRef.current;
      if (!el || !el.hasPointerCapture(e.pointerId)) return;
      el.releasePointerCapture(e.pointerId);

      // If not a drag, navigate home
      if (!hasMovedRef.current) {
        router.push('/');
      }
    },
    [router],
  );

  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed((prev) => !prev);
  }, []);

  // Hide on sky classroom pages, homepage, and the presentation classroom itself.
  const hidden =
    pathname.startsWith('/sky') || pathname.startsWith('/classroom') || pathname === '/';
  if (hidden) return null;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 50,
        touchAction: 'none',
      }}
      className="select-none cursor-grab active:cursor-grabbing"
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
            <div className="w-9 h-9 rounded-full bg-[#4A90D9] text-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow pointer-events-none">
              <span className="text-base leading-none">☁️</span>
            </div>
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
            <div className="flex items-center gap-2 rounded-full bg-[#4A90D9] px-4 py-2 text-sm font-medium text-white shadow-lg hover:shadow-xl transition-shadow whitespace-nowrap pointer-events-none">
              <span>☁️</span>
              <span>天空课堂</span>
            </div>
            <button
              data-toggle-collapse
              onClick={handleToggleCollapse}
              className="w-6 h-6 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/60 text-gray-500 dark:text-gray-400 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 active:scale-90 transition-all shadow-sm"
            >
              <Minus className="w-2.5 h-2.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
