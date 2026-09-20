'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';

const BUTTON_SIZE = 56;
const EDGE_GAP = 12;
const DEFAULT_BOTTOM_GAP = 84;

interface Position {
  x: number;
  y: number;
}

export function MobileAIFloatingButton() {
  const pathname = usePathname();
  // 宠物联动: 有宠物形象(白猫/黑猫/VRM人物)时用它当小镜头像, 否则退回默认二次元头像
  const mascotImage = useSkyClassroomStore((s) => s.mascotImage);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef({
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });
  const [position, setPosition] = useState<Position | null>(null);

  const getBounds = useCallback(() => {
    const frame = buttonRef.current?.parentElement?.getBoundingClientRect();
    const frameLeft = frame?.left ?? 0;
    const frameRight = frame?.right ?? window.innerWidth;

    const minX = Math.max(EDGE_GAP, frameLeft + EDGE_GAP);
    const maxX = Math.max(
      minX,
      Math.min(window.innerWidth - BUTTON_SIZE - EDGE_GAP, frameRight - BUTTON_SIZE - EDGE_GAP),
    );

    return {
      minX,
      maxX,
      minY: EDGE_GAP,
      maxY: Math.max(EDGE_GAP, window.innerHeight - BUTTON_SIZE - EDGE_GAP),
    };
  }, []);

  const clampPosition = useCallback(
    (next: Position): Position => {
      const bounds = getBounds();
      return {
        x: Math.max(bounds.minX, Math.min(bounds.maxX, next.x)),
        y: Math.max(bounds.minY, Math.min(bounds.maxY, next.y)),
      };
    },
    [getBounds],
  );

  useEffect(() => {
    const placeAtDefault = () => {
      const bounds = getBounds();
      setPosition((current) =>
        current
          ? clampPosition(current)
          : {
              x: bounds.maxX,
              y: Math.max(bounds.minY, window.innerHeight - BUTTON_SIZE - DEFAULT_BOTTOM_GAP),
            },
      );
    };

    placeAtDefault();
    window.addEventListener('resize', placeAtDefault);
    return () => window.removeEventListener('resize', placeAtDefault);
  }, [clampPosition, getBounds]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (!drag.moved && Math.abs(deltaX) + Math.abs(deltaY) <= 6) return;

      event.preventDefault();
      drag.moved = true;
      setPosition(
        clampPosition({
          x: drag.originX + deltaX,
          y: drag.originY + deltaY,
        }),
      );
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (dragRef.current.pointerId === event.pointerId) {
        dragRef.current.pointerId = null;
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [clampPosition]);

  // Hide on assistant pages and the login page
  if (pathname.startsWith('/m/sky/assistant') || pathname === '/m/auth/login') return null;

  const handleOpen = () => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    window.dispatchEvent(new CustomEvent('open-kagami-panel'));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleOpen}
      onPointerDown={handlePointerDown}
      aria-label="打开云翼助手"
      title="点击打开，按住拖动"
      style={position ? { left: position.x, top: position.y } : undefined}
      className="pointer-events-auto fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-4 z-[90] flex size-14 touch-none select-none items-center justify-center overflow-hidden rounded-full border-2 border-white/30 bg-white shadow-lg shadow-slate-900/20 transition-[transform,box-shadow] active:scale-95 active:cursor-grabbing dark:border-white/20 dark:bg-[#0d1728]"
    >
      <img
        src={mascotImage || '/avatars/kagami/chibi.png'}
        alt="小镜"
        draggable={false}
        className="pointer-events-none h-full w-full object-cover"
      />
    </button>
  );
}
