'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useUserWhiteboardStore } from '@/lib/store/whiteboard-user';
import type { PenPoint } from '@/lib/types/whiteboard-tools';
import { nanoid } from 'nanoid';
import type { PPTElement } from '@/lib/types/slides';

// ── Coordinate helpers ────────────────────────────────────────────────

function clientToCanvas(
  clientX: number,
  clientY: number,
  canvasEl: HTMLCanvasElement | null,
  canvasWidth: number,
  canvasHeight: number,
): PenPoint | null {
  if (!canvasEl) return null;
  const rect = canvasEl.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvasWidth / Math.max(rect.width, 1)),
    y: (clientY - rect.top) * (canvasHeight / Math.max(rect.height, 1)),
  };
}

// ── Drawing Canvas Props ──────────────────────────────────────────────

interface DrawingCanvasProps {
  canvasWidth: number;
  canvasHeight: number;
}

// ── Laser trail ───────────────────────────────────────────────────────

interface LaserPoint {
  x: number;
  y: number;
  t: number; // timestamp
}

const LASER_FADE_MS = 600;

// ── Component ─────────────────────────────────────────────────────────

export function DrawingCanvas({ canvasWidth, canvasHeight }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const [laserPoints, setLaserPoints] = useState<LaserPoint[]>([]);
  const [previewRect, setPreviewRect] = useState<{
    x: number; y: number; w: number; h: number;
  } | null>(null);
  const previewStartRef = useRef<PenPoint | null>(null);

  // Store access (reactive for rendering)
  const activeTool = useUserWhiteboardStore.use.activeTool();
  const penColor = useUserWhiteboardStore.use.penColor();
  const penWidth = useUserWhiteboardStore.use.penWidth();
  const shapeColor = useUserWhiteboardStore.use.shapeColor();
  const shapeFill = useUserWhiteboardStore.use.shapeFill();
  const shapeSubType = useUserWhiteboardStore.use.shapeSubType();
  const drawingStroke = useUserWhiteboardStore.use.drawingStroke();
  const drawingLine = useUserWhiteboardStore.use.drawingLine();
  const strokes = useUserWhiteboardStore.use.strokes();

  // ── Canvas init ────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = canvas.getContext('2d');
  }, []);

  // ── Render loop for pen strokes + laser ────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    let raf = 0;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw committed strokes
      for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        ctx.save();
        ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.35 : 1;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw in-progress stroke
      if (drawingStroke && drawingStroke.length >= 2) {
        ctx.save();
        ctx.globalAlpha = activeTool === 'highlighter' ? 0.35 : 1;
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(drawingStroke[0].x, drawingStroke[0].y);
        for (let i = 1; i < drawingStroke.length; i++) {
          ctx.lineTo(drawingStroke[i].x, drawingStroke[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw laser points
      if (laserPoints.length > 0) {
        for (const lp of laserPoints) {
          const age = Date.now() - lp.t;
          if (age > LASER_FADE_MS) continue;
          const alpha = 1 - age / LASER_FADE_MS;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(lp.x, lp.y, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [strokes, drawingStroke, laserPoints, penColor, penWidth, activeTool]);

  // ── Laser cleanup timer ────────────────────────────────────────────

  useEffect(() => {
    if (laserPoints.length === 0) return;
    const timer = window.setInterval(() => {
      setLaserPoints((prev) => {
        const now = Date.now();
        const filtered = prev.filter((lp) => now - lp.t < LASER_FADE_MS);
        return filtered.length === prev.length ? prev : filtered;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [laserPoints.length]);

  // ── Pointer handlers ───────────────────────────────────────────────

  const getCanvasPoint = useCallback(
    (e: React.PointerEvent): PenPoint | null => {
      return clientToCanvas(e.clientX, e.clientY, canvasRef.current, canvasWidth, canvasHeight);
    },
    [canvasWidth, canvasHeight],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const store = useUserWhiteboardStore.getState();

      if (store.activeTool === 'select') {
        // Select tool: handled at DOM level via ScreenElement clicks
        return;
      }

      if (store.activeTool === 'text') {
        const pt = getCanvasPoint(e);
        if (!pt) return;
        const element = {
          id: nanoid(),
          type: 'text',
          left: pt.x,
          top: pt.y,
          width: 200,
          height: 40,
          content: '',
          defaultFontName: 'Microsoft YaHei',
          defaultColor: store.shapeColor,
          rotate: 0,
        } as unknown as PPTElement;
        store.commitTextElement(element);
        return;
      }

      if (store.activeTool === 'eraser') {
        const pt = getCanvasPoint(e);
        if (!pt) return;
        store.pushSnapshot();
        isDrawingRef.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        store.eraseAtPoint(pt, 12);
        return;
      }

      if (store.activeTool === 'laser') {
        const pt = getCanvasPoint(e);
        if (!pt) return;
        setLaserPoints((prev) => [...prev, { x: pt.x, y: pt.y, t: Date.now() }]);
        isDrawingRef.current = true;
        return;
      }

      if (store.activeTool === 'shape') {
        const pt = getCanvasPoint(e);
        if (!pt) return;
        previewStartRef.current = pt;
        store.setDrawingShape({ type: store.shapeSubType, start: pt, end: pt });
        isDrawingRef.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      if (store.activeTool === 'line') {
        const pt = getCanvasPoint(e);
        if (!pt) return;
        previewStartRef.current = pt;
        store.setDrawingLine({ type: store.lineSubType, start: pt, end: pt });
        isDrawingRef.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      // pen / highlighter
      if (store.activeTool === 'pen' || store.activeTool === 'highlighter') {
        const pt = getCanvasPoint(e);
        if (!pt) return;
        store.setDrawingStroke([pt]);
        isDrawingRef.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    },
    [getCanvasPoint],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;
      const store = useUserWhiteboardStore.getState();
      const pt = getCanvasPoint(e);
      if (!pt) return;

      if (store.activeTool === 'laser') {
        setLaserPoints((prev) => [...prev, { x: pt.x, y: pt.y, t: Date.now() }]);
        return;
      }

      if (store.activeTool === 'eraser') {
        store.eraseAtPoint(pt, 12);
        return;
      }

      if (store.activeTool === 'shape' && previewStartRef.current) {
        store.setDrawingShape({ type: store.shapeSubType, start: previewStartRef.current, end: pt });
        const x = Math.min(previewStartRef.current.x, pt.x);
        const y = Math.min(previewStartRef.current.y, pt.y);
        const w = Math.abs(pt.x - previewStartRef.current.x);
        const h = Math.abs(pt.y - previewStartRef.current.y);
        setPreviewRect({ x, y, w, h });
        return;
      }

      if (store.activeTool === 'line' && previewStartRef.current) {
        store.setDrawingLine({ type: store.lineSubType, start: previewStartRef.current, end: pt });
        return;
      }

      if (store.activeTool === 'pen' || store.activeTool === 'highlighter') {
        store.addStrokePoint(pt);
      }
    },
    [getCanvasPoint],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const store = useUserWhiteboardStore.getState();

      if (store.activeTool === 'laser') {
        return;
      }

      if (store.activeTool === 'eraser') {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        return;
      }

      if (store.activeTool === 'shape') {
        store.commitShape();
        setPreviewRect(null);
        previewStartRef.current = null;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        return;
      }

      if (store.activeTool === 'line') {
        store.commitLine();
        previewStartRef.current = null;
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        return;
      }

      if (store.activeTool === 'pen' || store.activeTool === 'highlighter') {
        store.commitStroke();
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    },
    [],
  );

  // ── Cursor style ───────────────────────────────────────────────────

  const cursor = (() => {
    switch (activeTool) {
      case 'pen': return 'crosshair';
      case 'highlighter': return 'crosshair';
      case 'eraser': return 'crosshair';
      case 'text': return 'text';
      case 'laser': return 'none';
      case 'shape': return 'crosshair';
      case 'line': return 'crosshair';
      default: return 'default';
    }
  })();

  const isInteractive = activeTool !== 'select';

  return (
    <>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="absolute inset-0 z-10"
        style={{
          pointerEvents: isInteractive ? 'auto' : 'none',
          cursor,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Shape rubber-band preview */}
      {previewRect && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: `${(previewRect.x / canvasWidth) * 100}%`,
            top: `${(previewRect.y / canvasHeight) * 100}%`,
            width: `${(previewRect.w / canvasWidth) * 100}%`,
            height: `${(previewRect.h / canvasHeight) * 100}%`,
            border: `2px solid ${shapeColor}`,
            background: shapeFill ? `${shapeColor}44` : 'transparent',
            borderRadius: shapeSubType === 'circle' ? '50%' : shapeSubType === 'star' ? '8px' : '0',
          }}
        />
      )}
      {drawingLine && !previewRect && (
        <svg
          className="absolute inset-0 z-20 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          <line
            x1={`${(drawingLine.start.x / canvasWidth) * 100}%`}
            y1={`${(drawingLine.start.y / canvasHeight) * 100}%`}
            x2={`${(drawingLine.end.x / canvasWidth) * 100}%`}
            y2={`${(drawingLine.end.y / canvasHeight) * 100}%`}
            stroke={shapeColor}
            strokeWidth={2}
            strokeDasharray={drawingLine.type === 'dashed' ? '8 4' : 'none'}
            markerEnd={drawingLine.type === 'arrow' ? 'url(#arrowhead)' : undefined}
          />
          {drawingLine.type === 'arrow' && (
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="10"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill={shapeColor} />
              </marker>
            </defs>
          )}
        </svg>
      )}
    </>
  );
}
