'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import type {
  KnowledgeNode,
  KnowledgeGraph as KnowledgeGraphType,
} from '@/lib/mistakes/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { buildKnowledgeGraph } from '@/lib/mistakes/knowledge-graph';

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

// ── Component ─────────────────────────────────────────────────────────

export function KnowledgeGraphView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<LayoutData | null>(null);

  const { mistakes, knowledgeGraph, setKnowledgeGraph } =
    useSkyClassroomStore();

  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  // ── Build graph from mistakes ───────────────────────────────────────

  useEffect(() => {
    if (mistakes.length > 0) {
      const graph = buildKnowledgeGraph(mistakes);
      setKnowledgeGraph(graph);
    }
  }, [mistakes, setKnowledgeGraph]);

  // ── Resize observer ─────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setContainerWidth(rect.width);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ── Force-directed layout + canvas drawing ──────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !knowledgeGraph || knowledgeGraph.nodes.length === 0)
      return;

    const { nodes, edges, weakPoints } = knowledgeGraph;
    const w = containerWidth;
    const h = CANVAS_HEIGHT;
    if (w === 0 || h === 0) return;

    // High-DPI support
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);

    // ── 1. Group nodes by category for initial positions ───────────

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

    // ── 2. Force-directed iterations ───────────────────────────────

    const alpha = { value: 1 };

    for (let iter = 0; iter < ITERATIONS; iter++) {
      // Repulsive force between all node pairs
      for (let i = 0; i < layoutNodes.length; i++) {
        for (let j = i + 1; j < layoutNodes.length; j++) {
          const a = layoutNodes[i];
          const b = layoutNodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (REPULSION / (dist * dist)) * alpha.value;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      // Attractive force along edges
      for (const edge of edges) {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) continue;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * ATTRACTION * alpha.value;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        from.vx += fx;
        from.vy += fy;
        to.vx -= fx;
        to.vy -= fy;
      }

      // Apply velocities with centering + damping + clamp
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

    // ── 3. Draw ────────────────────────────────────────────────────

    ctx.clearRect(0, 0, w, h);

    // Edges first (behind nodes)
    for (const edge of edges) {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) continue;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = '#D1D5DB';
      ctx.lineWidth = edge.relation === 'prerequisite' ? 1.5 : 1;

      if (edge.relation === 'related') {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Nodes
    const weakSet = new Set(weakPoints);
    for (const ln of layoutNodes) {
      const node = nodes.find((n) => n.id === ln.id)!;
      const radius = MIN_RADIUS + node.mastery / 10; // 15–25

      // Color by mastery
      let color: string;
      if (node.mastery >= 80) color = '#10B981';
      else if (node.mastery >= 50) color = '#F59E0B';
      else color = '#EF4444';

      // Fill circle
      ctx.beginPath();
      ctx.arc(ln.x, ln.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Weak point: red dashed ring
      if (weakSet.has(node.id)) {
        ctx.beginPath();
        ctx.arc(ln.x, ln.y, radius + 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // White label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label =
        node.name.length > 4 ? node.name.slice(0, 4) + '..' : node.name;
      ctx.fillText(label, ln.x, ln.y);
    }

    // Store layout for click detection
    layoutRef.current = { layoutNodes, nodeMap, nodes };
  }, [knowledgeGraph, containerWidth]);

  // ── Click handler for tooltip ───────────────────────────────────────

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const layout = layoutRef.current;
      if (!canvas || !layout) return;

      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check each node for hit
      for (const ln of layout.layoutNodes) {
        const node = layout.nodes.find((n) => n.id === ln.id);
        if (!node) continue;
        const radius = MIN_RADIUS + node.mastery / 10;
        const dx = mx - ln.x;
        const dy = my - ln.y;
        if (dx * dx + dy * dy <= (radius + 6) ** 2) {
          setTooltip({ node, x: mx, y: my });
          return;
        }
      }
      setTooltip(null);
    },
    [],
  );

  const handleCloseTooltip = useCallback(() => setTooltip(null), []);

  // ── Empty state ─────────────────────────────────────────────────────

  if (!knowledgeGraph || knowledgeGraph.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg bg-white p-12 shadow-sm">
        <div className="text-6xl">🧠</div>
        <h3 className="mt-4 text-lg font-semibold text-gray-700">
          暂无知识图谱数据
        </h3>
        <p className="mt-2 text-sm text-gray-400">
          完成一些练习后自动生成
        </p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm" ref={containerRef}>
      <h3 className="mb-3 text-sm font-semibold text-gray-700">知识图谱</h3>

      {/* Canvas container */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full cursor-pointer rounded border border-gray-100"
          style={{ height: CANVAS_HEIGHT }}
          onClick={handleCanvasClick}
        />

        {/* Tooltip overlay */}
        {tooltip && (
          <div
            className="absolute z-10 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
            style={{
              left: Math.min(tooltip.x + 12, containerWidth - 200),
              top: Math.max(0, tooltip.y - 80),
              maxWidth: 200,
            }}
          >
            <div className="text-sm font-semibold text-gray-800">
              {tooltip.node.name}
            </div>
            <div className="mt-1 space-y-0.5 text-xs text-gray-500">
              <div>类别：{tooltip.node.category}</div>
              <div>掌握度：{tooltip.node.mastery}%</div>
              <div>题量：{tooltip.node.problemCount}</div>
              <div>错题数：{tooltip.node.mistakeCount}</div>
            </div>
            <button
              onClick={handleCloseTooltip}
              className="mt-2 text-xs text-[#4A90D9] hover:underline"
            >
              关闭
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
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
      </div>
    </div>
  );
}
