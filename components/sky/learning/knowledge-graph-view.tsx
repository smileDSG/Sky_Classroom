'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Search, X } from 'lucide-react';
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

  const { mistakes, setKnowledgeGraph } = useSkyClassroomStore();

  // Build graph synchronously from mistakes — no async gap, no empty flash
  const knowledgeGraph = useMemo(() => {
    if (mistakes.length === 0) return null;
    return buildKnowledgeGraph(mistakes);
  }, [mistakes]);

  // Sync to store outside render
  useEffect(() => {
    if (knowledgeGraph) setKnowledgeGraph(knowledgeGraph);
  }, [knowledgeGraph, setKnowledgeGraph]);

  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());

  // Extract all categories from the graph
  const allCategories = useMemo(() => {
    if (!knowledgeGraph) return [];
    return [...new Set(knowledgeGraph.nodes.map((n) => n.category))];
  }, [knowledgeGraph]);

  // Filter matching node IDs
  const matchingNodeIds = useMemo(() => {
    if (!knowledgeGraph) return new Set<string>();
    const query = searchQuery.trim().toLowerCase();
    const hasSearch = query.length > 0;
    const hasCategoryFilter = selectedCategories.size > 0;

    if (!hasSearch && !hasCategoryFilter) return null; // null = no filter active

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

    const isFiltering = matchingNodeIds !== null && matchingNodeIds.size > 0;

    // Edges first (behind nodes)
    for (const edge of edges) {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (!from || !to) continue;

      const bothMatch = !isFiltering || (matchingNodeIds!.has(edge.from) && matchingNodeIds!.has(edge.to));

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.globalAlpha = bothMatch ? 1 : 0.1;
      ctx.strokeStyle = bothMatch ? '#D1D5DB' : '#E5E7EB';
      ctx.lineWidth = edge.relation === 'prerequisite' ? 1.5 : 1;

      if (edge.relation === 'related') {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Nodes
    const weakSet = new Set(weakPoints);
    for (const ln of layoutNodes) {
      const node = nodes.find((n) => n.id === ln.id)!;
      const radius = MIN_RADIUS + node.mastery / 10; // 15–25
      const isMatch = !isFiltering || matchingNodeIds!.has(node.id);

      // Color by mastery
      let color: string;
      if (node.mastery >= 80) color = '#10B981';
      else if (node.mastery >= 50) color = '#F59E0B';
      else color = '#EF4444';

      ctx.globalAlpha = isMatch ? 1 : 0.15;

      // Fill circle
      ctx.beginPath();
      ctx.arc(ln.x, ln.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Weak point: red dashed ring
      if (weakSet.has(node.id) && isMatch) {
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
    ctx.globalAlpha = 1;

    // Store layout for click detection
    layoutRef.current = { layoutNodes, nodeMap, nodes };
  }, [knowledgeGraph, containerWidth, matchingNodeIds]);

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
      <div className="flex flex-col items-center justify-center rounded-lg bg-white p-12 shadow-sm dark:bg-slate-800">
        <div className="text-6xl">🧠</div>
        <h3 className="mt-4 text-lg font-semibold text-gray-700 dark:text-slate-200">
          暂无知识图谱数据
        </h3>
        <p className="mt-2 text-sm text-gray-400 dark:text-slate-400">
          完成一些练习后自动生成
        </p>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800" ref={containerRef}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">知识图谱</h3>
        {matchingNodeIds !== null && (
          <span className="text-xs text-muted-foreground">
            匹配 {matchingNodeIds.size} / {knowledgeGraph!.nodes.length} 个节点
          </span>
        )}
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

      {/* Canvas container */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full cursor-pointer rounded border border-gray-100 dark:border-slate-700"
          style={{ height: CANVAS_HEIGHT }}
          onClick={handleCanvasClick}
        />

        {/* Tooltip overlay */}
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
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-slate-400">
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
