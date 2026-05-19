'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Minus } from 'lucide-react';

export function SkyClassroomEntry() {
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const draggingRef = useRef(false);
  const offsetRef = useRef({ dx: 0, dy: 0 });
  const positionRef = useRef(position);
  positionRef.current = position;

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // Ignore if clicking the collapse toggle button
    if ((e.target as HTMLElement).closest('[data-toggle-collapse]')) return;

    e.preventDefault();
    draggingRef.current = true;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const pos = positionRef.current;
    offsetRef.current = { dx: clientX - pos.x, dy: clientY - pos.y };

    const onMove = (me: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const mx = 'touches' in me ? me.touches[0].clientX : me.clientX;
      const my = 'touches' in me ? me.touches[0].clientY : me.clientY;
      const btnW = collapsed ? 36 : 120;
      const btnH = 36;
      const newX = Math.max(0, Math.min(window.innerWidth - btnW, mx - offsetRef.current.dx));
      const newY = Math.max(0, Math.min(window.innerHeight - btnH, my - offsetRef.current.dy));
      setPosition({ x: newX, y: newY });
    };

    const onUp = () => {
      draggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }, [collapsed]);

  const handleToggleCollapse = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsed((prev) => !prev);
  }, []);

  const [didDrag, setDidDrag] = useState(false);
  useEffect(() => {
    if (!draggingRef.current && didDrag) {
      setDidDrag(false);
    }
  });

  const handleMouseUp = useCallback(() => {
    if (draggingRef.current) {
      setDidDrag(true);
      setTimeout(() => setDidDrag(false), 50);
    }
  }, []);

  const handleLinkClick = useCallback(
    (e: React.MouseEvent) => {
      if (didDrag) {
        e.preventDefault();
      }
    },
    [didDrag],
  );

  // Hide on sky classroom pages and homepage (moved after hooks to obey React rules)
  const hidden = pathname.startsWith('/sky') || pathname === '/';
  if (hidden) return null;

  return (
    <div
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleMouseUp}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 50,
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
            <Link
              href="/"
              onClick={handleLinkClick}
              className="w-9 h-9 rounded-full bg-[#4A90D9] text-white shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
            >
              <span className="text-base leading-none">☁️</span>
            </Link>
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
            <Link
              href="/"
              onClick={handleLinkClick}
              className="flex items-center gap-2 rounded-full bg-[#4A90D9] px-4 py-2 text-sm font-medium text-white shadow-lg hover:shadow-xl transition-shadow whitespace-nowrap"
            >
              <span>☁️</span>
              <span>天空课堂</span>
            </Link>
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
