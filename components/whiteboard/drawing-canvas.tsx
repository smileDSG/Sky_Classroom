'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useUserWhiteboardStore } from '@/lib/store/whiteboard-user';
import type { PenPoint, ShapeSubType } from '@/lib/types/whiteboard-tools';
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

// ── Shape preview ──────────────────────────────────────────────────────

function ShapePreview({
  type,
  w,
  h,
  color,
  fill,
}: {
  type: ShapeSubType;
  w: number;
  h: number;
  color: string;
  fill: boolean;
}) {
  const cx = w / 2;
  const cy = h / 2;
  const strokeW = 2;

  switch (type) {
    case 'rect':
      return (
        <rect
          x={strokeW}
          y={strokeW}
          width={w - strokeW * 2}
          height={h - strokeW * 2}
          fill={fill ? color : 'none'}
          stroke={color}
          strokeWidth={strokeW}
        />
      );
    case 'circle': {
      const rx = w / 2 - strokeW;
      const ry = h / 2 - strokeW;
      return (
        <ellipse
          cx={cx}
          cy={cy}
          rx={Math.max(rx, 0)}
          ry={Math.max(ry, 0)}
          fill={fill ? color : 'none'}
          stroke={color}
          strokeWidth={strokeW}
        />
      );
    }
    case 'triangle':
      return (
        <polygon
          points={`${cx},${strokeW} ${w - strokeW},${h - strokeW} ${strokeW},${h - strokeW}`}
          fill={fill ? color : 'none'}
          stroke={color}
          strokeWidth={strokeW}
        />
      );
    case 'star': {
      const outerR = Math.min(w, h) / 2 - strokeW;
      const innerR = outerR * 0.382;
      let points = '';
      for (let i = 0; i < 5; i++) {
        const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const innerAngle = outerAngle + Math.PI / 5;
        const ox = cx + outerR * Math.cos(outerAngle);
        const oy = cy + outerR * Math.sin(outerAngle);
        const ix = cx + innerR * Math.cos(innerAngle);
        const iy = cy + innerR * Math.sin(innerAngle);
        points += `${ox},${oy} ${ix},${iy} `;
      }
      return (
        <polygon
          points={points.trim()}
          fill={fill ? color : 'none'}
          stroke={color}
          strokeWidth={strokeW}
        />
      );
    }
    default:
      return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────

export function DrawingCanvas({ canvasWidth, canvasHeight }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawingRef = useRef(false);
  const [laserPoints, setLaserPoints] = useState<LaserPoint[]>([]);
  const [previewRect, setPreviewRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [textPreviewRect, setTextPreviewRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const previewStartRef = useRef<PenPoint | null>(null);
  const textStartRef = useRef<PenPoint | null>(null);

  // Store access (reactive for rendering)
  const activeTool = useUserWhiteboardStore.use.activeTool();
  const penColor = useUserWhiteboardStore.use.penColor();
  const penWidth = useUserWhiteboardStore.use.penWidth();
  const shapeColor = useUserWhiteboardStore.use.shapeColor();
  const shapeFill = useUserWhiteboardStore.use.shapeFill();
  const shapeSubType = useUserWhiteboardStore.use.shapeSubType();
  const fontSize = useUserWhiteboardStore.use.fontSize();
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
        textStartRef.current = pt;
        setTextPreviewRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
        isDrawingRef.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
        store.setDrawingShape({
          type: store.shapeSubType,
          start: previewStartRef.current,
          end: pt,
        });
        const x = Math.min(previewStartRef.current.x, pt.x);
        const y = Math.min(previewStartRef.current.y, pt.y);
        const w = Math.abs(pt.x - previewStartRef.current.x);
        const h = Math.abs(pt.y - previewStartRef.current.y);
        setPreviewRect({ x, y, w, h });
        return;
      }

      if (store.activeTool === 'text' && textStartRef.current) {
        const x = Math.min(textStartRef.current.x, pt.x);
        const y = Math.min(textStartRef.current.y, pt.y);
        const w = Math.abs(pt.x - textStartRef.current.x);
        const h = Math.abs(pt.y - textStartRef.current.y);
        setTextPreviewRect({ x, y, w, h });
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

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
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

    if (store.activeTool === 'text') {
      const rect = textStartRef.current;
      if (rect) {
        const pt = getCanvasPoint(e);
        const endPt = pt || rect;
        const x = Math.min(rect.x, endPt.x);
        const y = Math.min(rect.y, endPt.y);
        const w = Math.abs(endPt.x - rect.x);
        const h = Math.abs(endPt.y - rect.y);
        const minSize = 20;
        const element = {
          id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'text',
          left: x,
          top: y,
          width: Math.max(w, minSize),
          height: Math.max(h, minSize),
          content: '',
          defaultFontName: 'Microsoft YaHei',
          defaultColor: store.shapeColor,
          fill: 'transparent',
          rotate: 0,
        } as unknown as PPTElement;
        store.commitTextElement(element);
        store.setEditingTextId(element.id);
      }
      setTextPreviewRect(null);
      textStartRef.current = null;
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
  }, []);

  // ── Cursor style ───────────────────────────────────────────────────

  const cursor = (() => {
    switch (activeTool) {
      case 'pen':
        return 'crosshair';
      case 'highlighter':
        return 'crosshair';
      case 'eraser':
        return 'crosshair';
      case 'text':
        return 'text';
      case 'laser':
        return 'none';
      case 'shape':
        return 'crosshair';
      case 'line':
        return 'crosshair';
      default:
        return 'default';
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
        <svg
          className="absolute z-20 pointer-events-none overflow-visible"
          style={{
            left: `${(previewRect.x / canvasWidth) * 100}%`,
            top: `${(previewRect.y / canvasHeight) * 100}%`,
            width: `${(previewRect.w / canvasWidth) * 100}%`,
            height: `${(previewRect.h / canvasHeight) * 100}%`,
          }}
          viewBox={`0 0 ${previewRect.w} ${previewRect.h}`}
        >
          <ShapePreview
            type={shapeSubType}
            w={previewRect.w}
            h={previewRect.h}
            color={shapeColor}
            fill={shapeFill}
          />
        </svg>
      )}
      {/* Text box rubber-band preview */}
      {textPreviewRect && (
        <div
          className="absolute z-20 pointer-events-none border-2 border-dashed"
          style={{
            left: `${(textPreviewRect.x / canvasWidth) * 100}%`,
            top: `${(textPreviewRect.y / canvasHeight) * 100}%`,
            width: `${(textPreviewRect.w / canvasWidth) * 100}%`,
            height: `${(textPreviewRect.h / canvasHeight) * 100}%`,
            borderColor: shapeColor,
            backgroundColor: `${shapeColor}11`,
          }}
        />
      )}
      {drawingLine && !previewRect && !textPreviewRect && (
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
