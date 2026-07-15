'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { KnowledgeNode, KnowledgeGraph as KnowledgeGraphType } from '@/lib/mistakes/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { buildKnowledgeGraph, recommendLearningPath } from '@/lib/knowledge-graph';

// ── Internal types ────────────────────────────────────────────────────

interface NodeLayout {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface TooltipData {
  node: KnowledgeNode;
  x: number;
  y: number;
}

interface LayoutData {
  layoutNodes: NodeLayout[];
  nodeMap: Map<string, NodeLayout>;
  nodes: KnowledgeNode[];
}

// ── Constants ─────────────────────────────────────────────────────────

const MIN_RADIUS = 15;
const MAX_RADIUS = 25;
const ITERATIONS = 100;
const REPULSION = 3000;
const ATTRACTION = 0.005;
const DAMPING = 0.9;
const CANVAS_HEIGHT: number = 400;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

// ── Component ─────────────────────────────────────────────────────────

export function KnowledgeGraphView() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<LayoutData | null>(null);

  // Transform state (refs for performance — no re-render on every frame)
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  // Drag state
  const dragRef = useRef<{
    type: 'pan' | 'node';
    nodeId?: string;
    startX: number;
    startY: number;
    origOffsetX: number;
    origOffsetY: number;
    origNodeX: number;
    origNodeY: number;
  } | null>(null);
  const isDraggingRef = useRef(false);

  const { mistakes, setKnowledgeGraph } = useSkyClassroomStore();

  const knowledgeGraph = useMemo(() => {
    if (mistakes.length === 0) return null;
    return buildKnowledgeGraph(mistakes);
  }, [mistakes]);

  const learningPath = useMemo(() => {
    if (!knowledgeGraph) return null;
    return recommendLearningPath(knowledgeGraph);
  }, [knowledgeGraph]);

  const pathNodeIds = useMemo(() => {
    return new Set(learningPath?.nodes ?? []);
  }, [learningPath]);

  useEffect(() => {
    if (knowledgeGraph) setKnowledgeGraph(knowledgeGraph);
  }, [knowledgeGraph, setKnowledgeGraph]);

  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [, forceRedraw] = useState(0);

  const allCategories = useMemo(() => {
    if (!knowledgeGraph) return [];
    return [...new Set(knowledgeGraph.nodes.map((n) => n.category))];
  }, [knowledgeGraph]);

  const matchingNodeIds = useMemo(() => {
    if (!knowledgeGraph) return new Set<string>();
    const query = searchQuery.trim().toLowerCase();
    const hasSearch = query.length > 0;
    const hasCategoryFilter = selectedCategories.size > 0;
    if (!hasSearch && !hasCategoryFilter) return null;
    const ids = new Set<string>();
    for (const node of knowledgeGraph.nodes) {
      const matchesSearch = !hasSearch || node.name.toLowerCase().includes(query);
      const matchesCategory = !hasCategoryFilter || selectedCategories.has(node.category);
      if (matchesSearch && matchesCategory) ids.add(node.id);
    }
    return ids;
  }, [knowledgeGraph, searchQuery, selectedCategories]);

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategories(new Set());
  }, []);

  // ── Resize observer ─────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const updateSize = () => setContainerWidth(container.getBoundingClientRect().width);
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Draw function (called from effect + event handlers) ─────────────

  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !knowledgeGraph || knowledgeGraph.nodes.length === 0) return;

    const { nodes, edges, weakPoints } = knowledgeGraph;
    const w = containerWidth;
    const h = CANVAS_HEIGHT;
    if (w === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    // ── 1. Layout (only if not already computed or width changed) ────

    if (!layoutRef.current || layoutRef.current.nodes !== nodes) {
      const categories = [...new Set(nodes.map((n) => n.category))];
      const catColumns: Record<string, number> = {};
      const colWidth = w / categories.length;
      categories.forEach((cat, i) => {
        catColumns[cat] = colWidth * i + colWidth / 2;
      });

      const layoutNodes: NodeLayout[] = nodes.map((n) => {
        const catCenterX = catColumns[n.category] ?? w / 2;
        const catNodes = nodes.filter((x) => x.category === n.category);
        const catIndex = catNodes.indexOf(n);
        const spacing = h / (catNodes.length + 1);
        return {
          id: n.id,
          x: catCenterX + (Math.random() - 0.5) * 80,
          y: spacing * (catIndex + 1) + (Math.random() - 0.5) * 40,
          vx: 0,
          vy: 0,
        };
      });
      const nodeMap = new Map(layoutNodes.map((ln) => [ln.id, ln]));

      // Force-directed iterations
      const alpha = { value: 1 };
      for (let iter = 0; iter < ITERATIONS; iter++) {
        for (let i = 0; i < layoutNodes.length; i++) {
          for (let j = i + 1; j < layoutNodes.length; j++) {
            const a = layoutNodes[i],
              b = layoutNodes[j];
            const dx = a.x - b.x,
              dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = (REPULSION / (dist * dist)) * alpha.value;
            const fx = (dx / dist) * force,
              fy = (dy / dist) * force;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
          }
        }
        for (const edge of edges) {
          const from = nodeMap.get(edge.from),
            to = nodeMap.get(edge.to);
          if (!from || !to) continue;
          const dx = to.x - from.x,
            dy = to.y - from.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = dist * ATTRACTION * alpha.value;
          const fx = (dx / dist) * force,
            fy = (dy / dist) * force;
          from.vx += fx;
          from.vy += fy;
          to.vx -= fx;
          to.vy -= fy;
        }
        for (const ln of layoutNodes) {
          ln.vx += (w / 2 - ln.x) * 0.001;
          ln.vy += (h / 2 - ln.y) * 0.001;
          ln.vx *= DAMPING;
          ln.vy *= DAMPING;
          ln.x += ln.vx;
          ln.y += ln.vy;
          ln.x = Math.max(MAX_RADIUS + 5, Math.min(w - MAX_RADIUS - 5, ln.x));
          ln.y = Math.max(MAX_RADIUS + 5, Math.min(h - MAX_RADIUS - 5, ln.y));
        }
        alpha.value *= 0.98;
      }
      layoutRef.current = { layoutNodes, nodeMap, nodes };
    }

    // ── 2. Draw ─────────────────────────────────────────────────────

    const draw = () => {
      const ctx = canvas.getContext('2d')!;
      const scale = scaleRef.current;
      const { x: ox, y: oy } = offsetRef.current;
      const layout = layoutRef.current!;
      const isFiltering = matchingNodeIds !== null && matchingNodeIds.size > 0;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Apply transform
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(scale, scale);

      // Edges
      const hasPath = pathNodeIds.size > 0;
      // Build set of consecutive path edge pairs for highlighting
      const pathEdgePairs = new Set<string>();
      if (learningPath && learningPath.nodes.length > 1) {
        for (let i = 0; i < learningPath.nodes.length - 1; i++) {
          pathEdgePairs.add(`${learningPath.nodes[i]}→${learningPath.nodes[i + 1]}`);
          pathEdgePairs.add(`${learningPath.nodes[i + 1]}→${learningPath.nodes[i]}`);
        }
      }

      for (const edge of edges) {
        const from = layout.nodeMap.get(edge.from);
        const to = layout.nodeMap.get(edge.to);
        if (!from || !to) continue;
        const bothMatch =
          !isFiltering || (matchingNodeIds!.has(edge.from) && matchingNodeIds!.has(edge.to));
        const isPathEdge = hasPath && pathEdgePairs.has(`${edge.from}→${edge.to}`);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.globalAlpha = isPathEdge ? 1 : bothMatch ? 0.6 : 0.1;
        ctx.strokeStyle = isPathEdge ? '#3B82F6' : bothMatch ? '#D1D5DB' : '#E5E7EB';
        ctx.lineWidth = isPathEdge ? 2.5 : edge.relation === 'prerequisite' ? 1.5 : 1;
        ctx.setLineDash(edge.relation === 'related' && !isPathEdge ? [4, 4] : []);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Nodes
      const weakSet = new Set(weakPoints);
      for (const ln of layout.layoutNodes) {
        const node = nodes.find((n) => n.id === ln.id)!;
        const isOnPath = hasPath && pathNodeIds.has(node.id);
        const radius = MIN_RADIUS + node.mastery / 10 + (isOnPath ? 3 : 0);
        const isMatch = !isFiltering || matchingNodeIds!.has(node.id);

        let color: string;
        if (node.mastery >= 80) color = '#10B981';
        else if (node.mastery >= 50) color = '#F59E0B';
        else color = '#EF4444';

        ctx.globalAlpha = isMatch || isOnPath ? 1 : 0.15;

        ctx.beginPath();
        ctx.arc(ln.x, ln.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Path node highlight (white dashed border)
        if (isOnPath && isMatch) {
          ctx.beginPath();
          ctx.arc(ln.x, ln.y, radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Weak point highlight
        if (weakSet.has(node.id) && isMatch && !isOnPath) {
          ctx.beginPath();
          ctx.arc(ln.x, ln.y, radius + 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Label — scale font inversely so text stays readable
        ctx.fillStyle = '#FFFFFF';
        const fontSize = Math.max(9, 11 / scale);
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = node.name.length > 4 ? node.name.slice(0, 4) + '..' : node.name;
        ctx.fillText(label, ln.x, ln.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    drawRef.current = draw;
    draw();
  }, [knowledgeGraph, containerWidth, matchingNodeIds, pathNodeIds, learningPath]);

  // ── Coordinate helpers ──────────────────────────────────────────────

  const screenToGraph = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const mx = sx - rect.left;
    const my = sy - rect.top;
    const scale = scaleRef.current;
    const { x: ox, y: oy } = offsetRef.current;
    return { x: (mx - ox) / scale, y: (my - oy) / scale };
  }, []);

  const hitTestNode = useCallback((gx: number, gy: number): NodeLayout | null => {
    const layout = layoutRef.current;
    if (!layout) return null;
    for (const ln of layout.layoutNodes) {
      const node = layout.nodes.find((n) => n.id === ln.id);
      if (!node) continue;
      const radius = MIN_RADIUS + node.mastery / 10;
      const dx = gx - ln.x,
        dy = gy - ln.y;
      if (dx * dx + dy * dy <= (radius + 6) ** 2) return ln;
    }
    return null;
  }, []);

  // ── Mouse handlers ──────────────────────────────────────────────────

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const graph = screenToGraph(e.clientX, e.clientY);
      const hitNode = hitTestNode(graph.x, graph.y);

      if (hitNode) {
        // Start dragging a node
        dragRef.current = {
          type: 'node',
          nodeId: hitNode.id,
          startX: e.clientX,
          startY: e.clientY,
          origOffsetX: offsetRef.current.x,
          origOffsetY: offsetRef.current.y,
          origNodeX: hitNode.x,
          origNodeY: hitNode.y,
        };
      } else {
        // Start panning
        dragRef.current = {
          type: 'pan',
          startX: e.clientX,
          startY: e.clientY,
          origOffsetX: offsetRef.current.x,
          origOffsetY: offsetRef.current.y,
          origNodeX: 0,
          origNodeY: 0,
        };
      }
      isDraggingRef.current = false;
      setTooltip(null);
    },
    [screenToGraph, hitTestNode],
  );

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    // Threshold to distinguish click from drag
    if (!isDraggingRef.current && Math.abs(dx) + Math.abs(dy) < 4) return;
    isDraggingRef.current = true;

    if (drag.type === 'pan') {
      offsetRef.current = {
        x: drag.origOffsetX + dx,
        y: drag.origOffsetY + dy,
      };
    } else if (drag.type === 'node' && drag.nodeId) {
      const layout = layoutRef.current;
      if (!layout) return;
      const ln = layout.nodeMap.get(drag.nodeId);
      if (!ln) return;
      // Convert pixel delta to graph-space delta
      const scale = scaleRef.current;
      ln.x = drag.origNodeX + dx / scale;
      ln.y = drag.origNodeY + dy / scale;
    }

    drawRef.current();
  }, []);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const wasDragging = isDraggingRef.current;
      dragRef.current = null;
      isDraggingRef.current = false;

      // If it was a click (not a drag), handle tooltip
      if (!wasDragging) {
        const graph = screenToGraph(e.clientX, e.clientY);
        const hitNode = hitTestNode(graph.x, graph.y);
        if (hitNode) {
          const layout = layoutRef.current;
          const node = layout?.nodes.find((n) => n.id === hitNode.id);
          if (node) {
            const rect = canvasRef.current!.getBoundingClientRect();
            setTooltip({ node, x: e.clientX - rect.left, y: e.clientY - rect.top });
          }
        } else {
          setTooltip(null);
        }
      }
    },
    [screenToGraph, hitTestNode],
  );

  const handleWheelNative = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const oldScale = scaleRef.current;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldScale * delta));

    const ratio = newScale / oldScale;
    offsetRef.current = {
      x: mx - (mx - offsetRef.current.x) * ratio,
      y: my - (my - offsetRef.current.y) * ratio,
    };
    scaleRef.current = newScale;

    drawRef.current();
    forceRedraw((n) => n + 1);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheelNative);
  }, [handleWheelNative]);

  // ── Zoom controls ───────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2,
      cy = rect.height / 2;
    const oldScale = scaleRef.current;
    const newScale = Math.min(MAX_ZOOM, oldScale * 1.3);
    const ratio = newScale / oldScale;
    offsetRef.current = {
      x: cx - (cx - offsetRef.current.x) * ratio,
      y: cy - (cy - offsetRef.current.y) * ratio,
    };
    scaleRef.current = newScale;
    drawRef.current();
    forceRedraw((n) => n + 1);
  }, []);

  const handleZoomOut = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2,
      cy = rect.height / 2;
    const oldScale = scaleRef.current;
    const newScale = Math.max(MIN_ZOOM, oldScale / 1.3);
    const ratio = newScale / oldScale;
    offsetRef.current = {
      x: cx - (cx - offsetRef.current.x) * ratio,
      y: cy - (cy - offsetRef.current.y) * ratio,
    };
    scaleRef.current = newScale;
    drawRef.current();
    forceRedraw((n) => n + 1);
  }, []);

  const handleResetView = useCallback(() => {
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    drawRef.current();
    forceRedraw((n) => n + 1);
  }, []);

  const handleCloseTooltip = useCallback(() => setTooltip(null), []);

  // ── Empty state ─────────────────────────────────────────────────────

  if (!knowledgeGraph || knowledgeGraph.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg bg-white p-12 shadow-sm dark:bg-slate-800">
        <div className="text-6xl">🧠</div>
        <h3 className="mt-4 text-lg font-semibold text-gray-700 dark:text-slate-200">
          暂无知识图谱数据
        </h3>
        <p className="mt-2 text-sm text-gray-400 dark:text-slate-400">完成一些练习后自动生成</p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800" ref={containerRef}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">知识图谱</h3>
        <div className="flex items-center gap-2">
          {matchingNodeIds !== null && (
            <span className="text-xs text-muted-foreground">
              匹配 {matchingNodeIds.size} / {knowledgeGraph!.nodes.length}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {Math.round(scaleRef.current * 100)}%
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="mb-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索知识点..."
            className="w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-8 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
          {(searchQuery || selectedCategories.size > 0) && (
            <button
              onClick={clearFilters}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        {allCategories.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map((cat) => {
              const isActive = selectedCategories.has(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full rounded border border-gray-100 dark:border-slate-700"
          style={{
            height: CANVAS_HEIGHT,
            cursor:
              dragRef.current?.type === 'node'
                ? 'grabbing'
                : dragRef.current?.type === 'pan'
                  ? 'grabbing'
                  : 'grab',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            dragRef.current = null;
            isDraggingRef.current = false;
          }}
        />

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1">
          <button
            onClick={handleZoomIn}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 shadow-sm border border-gray-200 hover:bg-gray-50 dark:bg-slate-700/90 dark:border-slate-600 dark:hover:bg-slate-600"
            title="放大"
          >
            <ZoomIn className="h-3.5 w-3.5 text-gray-600 dark:text-slate-300" />
          </button>
          <button
            onClick={handleZoomOut}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 shadow-sm border border-gray-200 hover:bg-gray-50 dark:bg-slate-700/90 dark:border-slate-600 dark:hover:bg-slate-600"
            title="缩小"
          >
            <ZoomOut className="h-3.5 w-3.5 text-gray-600 dark:text-slate-300" />
          </button>
          <button
            onClick={handleResetView}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 shadow-sm border border-gray-200 hover:bg-gray-50 dark:bg-slate-700/90 dark:border-slate-600 dark:hover:bg-slate-600"
            title="重置视图"
          >
            <Maximize2 className="h-3.5 w-3.5 text-gray-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-800"
            style={{
              left: Math.min(tooltip.x + 12, containerWidth - 200),
              top: Math.max(0, tooltip.y - 80),
              maxWidth: 200,
            }}
          >
            <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">
              {tooltip.node.name}
            </div>
            <div className="mt-1 space-y-0.5 text-xs text-gray-500 dark:text-slate-400">
              <div>类别：{tooltip.node.category}</div>
              <div>掌握度：{tooltip.node.mastery}%</div>
              <div>复习进度：{Math.round(tooltip.node.reviewProgress * 100)}%</div>
              <div>题量：{tooltip.node.problemCount}</div>
              <div>错题数：{tooltip.node.mistakeCount}</div>
            </div>
            {/* Action buttons for weak points */}
            {tooltip.node.mastery < 50 && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    handleCloseTooltip();
                    router.push(
                      `/sky/cloud-mind/quiz?topic=${encodeURIComponent(tooltip.node.name)}`,
                    );
                  }}
                  className="rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:shadow-md transition-all"
                >
                  生成同类题
                </button>
                <button
                  onClick={() => {
                    handleCloseTooltip();
                    router.push(
                      `/sky/cloud-mind/memory?topic=${encodeURIComponent(tooltip.node.name)}&content=${encodeURIComponent(`知识点：${tooltip.node.name}`)}`,
                    );
                  }}
                  className="rounded-lg bg-gradient-to-r from-rose-500 to-pink-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:shadow-md transition-all"
                >
                  记忆卡片
                </button>
              </div>
            )}
            <button
              onClick={handleCloseTooltip}
              className="mt-2 text-xs text-[#4A90D9] hover:underline"
            >
              关闭
            </button>
          </div>
        )}
      </div>

      {/* Legend + hints */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-[#10B981]" />
            掌握 ≥80%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-[#F59E0B]" />
            一般 50-79%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-[#EF4444]" />
            薄弱 &lt;50%
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-dashed border-[#EF4444] bg-transparent" />
            虚线边框 = 薄弱点
          </span>
          {pathNodeIds.size > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-dashed border-[#3B82F6] bg-transparent" />
              蓝色虚线 = 推荐路径
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-400 dark:text-slate-500">
          滚轮缩放 · 拖拽平移 · 拖拽节点
        </span>
      </div>

      {/* Learning path card */}
      {learningPath && learningPath.nodes.length > 1 && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800/50 dark:bg-blue-900/10">
          <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
            推荐学习路径
          </h4>
          <div className="flex flex-wrap items-center gap-1">
            {learningPath.nodes.map((nodeId, i) => {
              const node = knowledgeGraph?.nodes.find((n) => n.id === nodeId);
              return (
                <span key={nodeId} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      // Focus on this node in the canvas
                      const layout = layoutRef.current;
                      if (!layout) return;
                      const ln = layout.nodeMap.get(nodeId);
                      if (!ln) return;
                      const canvas = canvasRef.current;
                      if (!canvas) return;
                      const rect = canvas.getBoundingClientRect();
                      const targetScale = 1.5;
                      scaleRef.current = targetScale;
                      offsetRef.current = {
                        x: rect.width / 2 - ln.x * targetScale,
                        y: rect.height / 2 - ln.y * targetScale,
                      };
                      drawRef.current();
                      forceRedraw((n) => n + 1);
                    }}
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    {node?.name ?? nodeId}
                    {node && (
                      <span className="ml-1 text-[10px] text-blue-400">{node.mastery}%</span>
                    )}
                  </button>
                  {i < learningPath.nodes.length - 1 && (
                    <span className="text-blue-300 dark:text-blue-600 text-xs">→</span>
                  )}
                </span>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-blue-500 dark:text-blue-400">
            {learningPath.reason}
          </p>
        </div>
      )}
    </div>
  );
}
