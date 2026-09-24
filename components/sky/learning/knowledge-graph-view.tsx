'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Search, X, Plus, Minus, Maximize2 } from 'lucide-react';
import type { KnowledgeNode } from '@/lib/mistakes/types';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
import { buildKnowledgeGraph, recommendLearningPath } from '@/lib/knowledge-graph';
import {
  BookDoodle,
  GraphPaperBg,
  MountainDoodle,
  SunDoodle,
} from '@/components/sky/pattern/sky-doodles';

// ── Internal types ────────────────────────────────────────────────────

interface NodeLayout {
  id: string;
  category: string;
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

interface ColumnBox {
  category: string;
  left: number;
  right: number;
  x: number;
  width: number;
}

interface LayoutData {
  layoutNodes: NodeLayout[];
  nodeMap: Map<string, NodeLayout>;
  nodes: KnowledgeNode[];
  columns: ColumnBox[];
  categories: string[];
  width: number;
}

// ── Constants ─────────────────────────────────────────────────────────

const CANVAS_HEIGHT: number = 500;
const PAD_TOP = 60;
const PAD_BOTTOM = 26;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const MIN_LABEL_ZOOM = 0.72; // 低于该缩放比例时隐藏节点文字，避免糊成一团

// 掌握度四段配色：由好到弱（青 → 蓝 → 橙 → 玫红）
const MASTERY_COLORS: { min: number; color: string }[] = [
  { min: 85, color: '#14B8A6' },
  { min: 60, color: '#3B82F6' },
  { min: 40, color: '#F59E0B' },
  { min: 0, color: '#F43F5E' },
];

const masteryColor = (m: number): string =>
  MASTERY_COLORS.find((c) => m >= c.min)?.color ?? MASTERY_COLORS[MASTERY_COLORS.length - 1].color;

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
  const animRef = useRef<number | null>(null);

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
  const [zoomPct, setZoomPct] = useState(100);

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
    // 以画布实时尺寸为准，避免 ResizeObserver 所在容器节点被重建时宽度读成 0 导致画布空白
    const measuredW = canvas.getBoundingClientRect().width;
    const w = measuredW > 0 ? measuredW : containerWidth;
    const h = CANVAS_HEIGHT;
    if (w === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    // ── 1. Layout (only if not already computed or width changed) ────

    if (!layoutRef.current || layoutRef.current.nodes !== nodes || layoutRef.current.width !== w) {
      const categories = [...new Set(nodes.map((n) => n.category))];
      const nodeById = new Map(nodes.map((n) => [n.id, n]));

      // ── 有向递进布局 ────────────────────────────────────────────────
      // 仅用 prerequisite 有向边构建 DAG 层次（最长路径法）：depth[i] 表示
      // 「到该知识点前需先掌握多少层前置」，最左为基础、最右为深层，
      // 学习递进方向天然从左到右，一目了然。
      const depthOf: Record<string, number> = {};
      for (const n of nodes) depthOf[n.id] = 0;
      for (let iter = 0; iter < nodes.length + 1; iter++) {
        let changed = false;
        for (const e of edges) {
          if (e.relation !== 'prerequisite') continue;
          if (depthOf[e.to] < depthOf[e.from] + 1) {
            depthOf[e.to] = depthOf[e.from] + 1;
            changed = true;
          }
        }
        if (!changed) break;
      }
      const maxDepth = Math.max(0, ...Object.values(depthOf));
      const layers: string[][] = Array.from({ length: maxDepth + 1 }, () => []);
      for (const n of nodes) layers[depthOf[n.id]].push(n.id);

      // 层内排序：barycenter 启发式，让前置连线尽量短、少交叉
      const inLayerIdx = (lid: number, id: string) => layers[lid].indexOf(id);
      const barycenter = (id: string): number => {
        const ins = edges.filter((e) => e.relation === 'prerequisite' && e.to === id);
        if (ins.length === 0) return 0.5;
        let sum = 0;
        for (const e of ins) {
          const pl = depthOf[e.from];
          const plist = layers[pl];
          sum += (inLayerIdx(pl, e.from) + 0.5) / plist.length;
        }
        return sum / ins.length;
      };
      for (let iter = 0; iter < 6; iter++) {
        for (let li = 0; li < layers.length; li++) {
          layers[li].sort((a, b) => barycenter(a) - barycenter(b));
        }
      }

      // 列宽按每层节点数占比分配；总宽超出画布时等比压缩，杜绝右侧溢出留白
      const gap = 14;
      const availW = Math.max(60, w - 24 - gap * (layers.length - 1));
      const countSum = layers.reduce((s, l) => s + l.length, 0) || 1;
      let rawWidths = layers.map((l) => Math.max(92, (availW * l.length) / countSum));
      const totalRaw = rawWidths.reduce((s, x) => s + x, 0);
      if (totalRaw > availW) {
        rawWidths = rawWidths.map((x) => Math.max(64, (x * availW) / totalRaw));
      }
      // 二次压缩：窄画布且层数多时，64px 下限仍可能溢出，去下限再压一次
      const totalAfterFloor = rawWidths.reduce((s, x) => s + x, 0);
      if (totalAfterFloor > availW) {
        rawWidths = rawWidths.map((x) => (x * availW) / totalAfterFloor);
      }
      let xCursor = 12;
      const columns: ColumnBox[] = layers.map((layer, i) => {
        const width = rawWidths[i];
        const cat =
          layers.length === 1
            ? '知识地图'
            : i === 0
              ? '基础'
              : i === layers.length - 1
                ? '深入'
                : '进阶';
        const box: ColumnBox = {
          category: cat,
          left: xCursor + 5,
          right: xCursor + width - 5,
          x: xCursor + width / 2,
          width,
        };
        xCursor += width + gap;
        return box;
      });

      // 层内网格排布：行列数按列宽与画布高度自适应（尽量接近正方形单元），
      // 节点均匀铺满整列，从根本上避免「顶部挤成一团、中下部大片留白」
      const availH = h - PAD_TOP - PAD_BOTTOM;
      const layoutNodes: NodeLayout[] = [];
      for (let li = 0; li < layers.length; li++) {
        const col = columns[li];
        const ids = layers[li];
        const maxR =
          Math.max(
            ...ids.map((id) => {
              const n = nodeById.get(id)!;
              return 16 + (n.mastery / 100) * 12;
            }),
          ) + 4;
        const maxColsByRadius = Math.max(1, Math.floor((col.width - 12) / (2 * maxR + 8)));
        const idealCols = Math.round(Math.sqrt((ids.length * col.width) / availH));
        const cols = Math.max(1, Math.min(ids.length, Math.min(maxColsByRadius, idealCols)));
        const rows = Math.ceil(ids.length / cols);
        const cellW = col.width / cols;
        const cellH = availH / rows;
        const lastRowCount = ids.length - (rows - 1) * cols;
        ids.forEach((id, idx) => {
          const r = Math.floor(idx / cols);
          const c = idx % cols;
          // 末行不满时整行居中，避免靠边
          const centered = r === rows - 1 && lastRowCount < cols;
          const cellX0 = centered ? (col.width - cellW * lastRowCount) / 2 : 0;
          const x = Math.max(
            col.left + 2,
            Math.min(
              col.right - 2,
              col.left + cellX0 + cellW * (c + 0.5) + (Math.random() - 0.5) * 4,
            ),
          );
          const y = PAD_TOP + cellH * (r + 0.5) + (Math.random() - 0.5) * 4;
          layoutNodes.push({
            id,
            category: nodeById.get(id)!.category,
            x,
            y,
            vx: 0,
            vy: 0,
          });
        });
      }
      const nodeMap = new Map(layoutNodes.map((ln) => [ln.id, ln]));

      layoutRef.current = { layoutNodes, nodeMap, nodes, columns, categories, width: w };
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

      const weakSet = new Set(weakPoints);

      // ── 递进泳道底色：从左（基础·浅蓝）到右（深入·浅靛），不靠线条靠渐变色带表达层次
      layout.columns.forEach((col, i) => {
        const t = layout.columns.length === 1 ? 0 : i / (layout.columns.length - 1);
        const hue = 205 + t * 64; // 205(蓝) → 269(靛/紫蓝)，随层深加深，呼应「基础→深入」
        const bx = col.left - 4;
        const bw = col.right - col.left + 8;
        const by = 26;
        const bh = h - 26 - 10;
        const r = 12;
        ctx.beginPath();
        ctx.moveTo(bx + r, by);
        ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
        ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
        ctx.arcTo(bx, by + bh, bx, by, r);
        ctx.arcTo(bx, by, bx + bw, by, r);
        ctx.closePath();
        ctx.fillStyle = `hsla(${hue}, 58%, 96%, 0.92)`;
        ctx.fill();
        // 递进阶段徽标：序号跟随左右方向提示（基础→进阶→深入），字号随缩放反向保持恒定
        // 序号圆点
        ctx.fillStyle = `hsl(${hue}, 55%, 34%)`;
        ctx.beginPath();
        ctx.arc(col.left + 6, 42, 9 / scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${10 / scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), col.left + 6, 42);
        // 阶段名（紧贴序号右侧，形成「① 基础」徽标）
        ctx.fillStyle = `hsl(${hue}, 45%, 28%)`;
        ctx.font = `bold ${13 / scale}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(col.category, col.left + 20, 42);
      });

      for (const edge of edges) {
        const from = layout.nodeMap.get(edge.from);
        const to = layout.nodeMap.get(edge.to);
        if (!from || !to) continue;
        const bothMatch =
          !isFiltering || (matchingNodeIds!.has(edge.from) && matchingNodeIds!.has(edge.to));
        const isPathEdge = hasPath && pathEdgePairs.has(`${edge.from}→${edge.to}`);
        const isPrereq = edge.relation === 'prerequisite';
        // 曲线连线：垂直法线方向轻度弯折，减少直线交叉带来的杂乱
        const ddx = to.x - from.x,
          ddy = to.y - from.y;
        const len = Math.hypot(ddx, ddy) || 1;
        const bend = Math.min(26, len * 0.18) * (edge.relation === 'related' ? 0.6 : 1);
        const nx = (-ddy / len) * bend,
          ny = (ddx / len) * bend;
        const mx = (from.x + to.x) / 2 + nx,
          my = (from.y + to.y) / 2 + ny;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(mx, my, to.x, to.y);
        ctx.globalAlpha = isPathEdge ? 1 : bothMatch ? 0.6 : 0.07;
        ctx.strokeStyle = isPathEdge ? '#2F80ED' : isPrereq ? '#6E8CA9' : '#C9D4DF';
        ctx.lineWidth = isPathEdge ? 2.2 : isPrereq ? 1.6 : 1.1;
        ctx.setLineDash(edge.relation === 'related' && !isPathEdge ? [4, 4] : []);
        ctx.stroke();
        ctx.setLineDash([]);

        // 前置依赖箭头：指向……先学 A 再学 B，箭头放在目标节点边缘表示「依赖方向」
        if ((isPrereq || isPathEdge) && bothMatch) {
          // 贝塞尔终点的切线方向（由控制点 M 指向终点 to）
          const tvx = to.x - mx,
            tvy = to.y - my;
          const tvl = Math.hypot(tvx, tvy) || 1;
          const ux = tvx / tvl,
            uy = tvy / tvl;
          const toNode = layout.nodes.find((n) => n.id === to.id);
          const tRadius = toNode ? 16 + (toNode.mastery / 100) * 12 : 18;
          const arrow = (6.5 / scale) * (isPathEdge ? 1.15 : 1);
          const ax = to.x - ux * tRadius,
            ay = to.y - uy * tRadius;
          const px = -uy,
            py = ux;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(ax - ux * arrow + px * arrow * 0.6, ay - uy * arrow + py * arrow * 0.6);
          ctx.lineTo(ax - ux * arrow - px * arrow * 0.6, ay - uy * arrow - py * arrow * 0.6);
          ctx.closePath();
          ctx.fillStyle = isPathEdge ? '#2F80ED' : '#6E8CA9';
          ctx.fill();
        }
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Nodes
      for (const ln of layout.layoutNodes) {
        const node = nodes.find((n) => n.id === ln.id)!;
        const isOnPath = hasPath && pathNodeIds.has(node.id);
        const radius = 16 + (node.mastery / 100) * 12 + (isOnPath ? 3 : 0);
        const isMatch = !isFiltering || matchingNodeIds!.has(node.id);
        const color =
          MASTERY_COLORS.find((c) => node.mastery >= c.min)?.color ??
          MASTERY_COLORS[MASTERY_COLORS.length - 1].color;

        ctx.globalAlpha = isMatch || isOnPath ? 1 : 0.12;

        ctx.beginPath();
        ctx.arc(ln.x, ln.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        // 浅色描边让节点与底色块之间更有层次，避免糊在一起
        ctx.beginPath();
        ctx.arc(ln.x, ln.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Path node highlight (blue dashed border)
        if (isOnPath && isMatch) {
          ctx.beginPath();
          ctx.arc(ln.x, ln.y, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#3B82F6';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Weak point highlight (bright rim)
        if (weakSet.has(node.id) && isMatch && !isOnPath) {
          ctx.beginPath();
          ctx.arc(ln.x, ln.y, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = '#FB7185';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Label — 仅在足够放大时显示，字号随缩放反向补偿，并按节点宽度自动省略
        if (scale >= MIN_LABEL_ZOOM && isMatch) {
          ctx.fillStyle = '#FFFFFF';
          const maxChars = scale >= 1.5 ? 12 : scale >= 1 ? 7 : 5;
          let label = node.name.length > maxChars ? node.name.slice(0, maxChars) + '…' : node.name;
          const fontSize = Math.max(9, 11 / scale);
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const maxW = Math.max(radius * 1.9, 24);
          while (label.length > 1 && ctx.measureText(label).width > maxW) {
            label = label.slice(0, label.replace(/…$/, '').length - 1) + '…';
          }
          ctx.fillText(label, ln.x, ln.y);
        }
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
      const radius = 16 + (node.mastery / 100) * 12;
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

  // ── Zoom 平滑过渡（rAF 缓动，避免按钮/滚轮跳变，手感顺滑）──────

  const animateZoomTo = useCallback(
    (targetScale: number, fx: number, fy: number, targetOffset?: { x: number; y: number }) => {
      if (animRef.current !== null) cancelAnimationFrame(animRef.current);
      const start = scaleRef.current;
      const startOff = { ...offsetRef.current };
      const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetScale));
      const sameScale = Math.abs(clamped - start) < 0.001;
      const sameOff =
        targetOffset &&
        Math.abs(targetOffset.x - startOff.x) < 0.5 &&
        Math.abs(targetOffset.y - startOff.y) < 0.5;
      if (sameScale && (!targetOffset || sameOff)) return;
      const dur = 150;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        const k = t * t * (3 - 2 * t); // smoothstep
        const s = start + (clamped - start) * k;
        scaleRef.current = s;
        if (targetOffset) {
          offsetRef.current = {
            x: startOff.x + (targetOffset.x - startOff.x) * k,
            y: startOff.y + (targetOffset.y - startOff.y) * k,
          };
        } else {
          const ratio = s / start;
          offsetRef.current = {
            x: fx - (fx - startOff.x) * ratio,
            y: fy - (fy - startOff.y) * ratio,
          };
        }
        drawRef.current();
        forceRedraw((n) => n + 1);
        setZoomPct(Math.round(s * 100));
        if (t < 1) animRef.current = requestAnimationFrame(step);
        else animRef.current = null;
      };
      animRef.current = requestAnimationFrame(step);
    },
    [],
  );

  const handleWheelNative = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      // 提速缩放：单次滚轮变化幅度更大，操作更省力
      const factor = e.deltaY > 0 ? 0.845 : 1.18;
      const newScale = scaleRef.current * factor;
      animateZoomTo(newScale, mx, my);
    },
    [animateZoomTo],
  );

  // 滚轮缩放：挂在 window 上并校验指针是否落在画布内再响应，避免受画布挂载/覆盖影响
  useEffect(() => {
    const onWheelAtWindow = (e: WheelEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      if (mx < 0 || my < 0 || mx > rect.width || my > rect.height) return;
      handleWheelNative(e);
    };
    window.addEventListener('wheel', onWheelAtWindow, { passive: false });
    return () => window.removeEventListener('wheel', onWheelAtWindow);
  }, [handleWheelNative]);

  // 键盘快捷键：+ / - / 0 快速缩放与复位（输入框聚焦时不响应）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.width / 2,
        cy = rect.height / 2;
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        animateZoomTo(scaleRef.current * 1.28, cx, cy);
      } else if (e.key === '-') {
        e.preventDefault();
        animateZoomTo(scaleRef.current / 1.28, cx, cy);
      } else if (e.key === '0') {
        e.preventDefault();
        animateZoomTo(1, cx, cy);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [animateZoomTo]);

  // ── Zoom controls ───────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    animateZoomTo(scaleRef.current * 1.28, rect.width / 2, rect.height / 2);
  }, [animateZoomTo]);

  const handleZoomOut = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    animateZoomTo(scaleRef.current / 1.28, rect.width / 2, rect.height / 2);
  }, [animateZoomTo]);

  const handleResetView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    animateZoomTo(1, rect.width / 2, rect.height / 2, { x: 0, y: 0 });
  }, [animateZoomTo]);

  const handleCloseTooltip = useCallback(() => setTooltip(null), []);

  // ── Empty state ─────────────────────────────────────────────────────

  if (!knowledgeGraph || knowledgeGraph.nodes.length === 0) {
    return (
      <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-lg bg-white p-12 shadow-sm dark:bg-slate-800">
        <GraphPaperBg className="opacity-50" />
        <div
          className="pointer-events-none absolute bottom-4 right-7 hidden select-none text-sky-500/35 dark:text-sky-200/25 md:flex md:items-end md:gap-2"
          aria-hidden="true"
        >
          <SunDoodle className="h-8 w-8 -rotate-12" />
          <MountainDoodle className="h-9 w-12 translate-y-1" />
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10">
          <Brain className="h-8 w-8 text-sky-500" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-700 dark:text-slate-200">
          暂无知识地图数据
        </h3>
        <p className="mt-2 text-sm text-gray-400 dark:text-slate-400">完成一些练习后自动生成</p>
        <div
          className="pointer-events-none absolute left-8 top-6 hidden select-none text-sky-500/30 dark:text-sky-200/20 md:block"
          aria-hidden="true"
        >
          <BookDoodle className="h-9 w-11 rotate-6" />
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800" ref={containerRef}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">知识地图</h3>
        <div className="flex items-center gap-2">
          {matchingNodeIds !== null && (
            <span className="text-xs text-muted-foreground">
              匹配 {matchingNodeIds.size} / {knowledgeGraph!.nodes.length}
            </span>
          )}
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
            className="w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-8 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
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
                      ? 'bg-sky-500 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-900/20'
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
        <div className="absolute left-3 top-3 z-[5] flex w-9 flex-col items-stretch gap-0.5 rounded-xl border border-gray-200 bg-white/95 p-1 shadow-sm dark:border-slate-600 dark:bg-slate-800/95">
          <button
            onClick={handleZoomIn}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-sky-50 hover:text-sky-600 dark:text-slate-300 dark:hover:bg-slate-700"
            title="放大 (+)"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-sky-50 hover:text-sky-600 dark:text-slate-300 dark:hover:bg-slate-700"
            title="缩小 (-)"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="mx-1 my-0.5 h-px bg-gray-200 dark:bg-slate-700" />
          <button
            onClick={handleResetView}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-sky-50 hover:text-sky-600 dark:text-slate-300 dark:hover:bg-slate-700"
            title="适配视图 (0)"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <div className="pt-0.5 text-center text-[11px] font-semibold tabular-nums text-gray-700 dark:text-slate-200">
            {zoomPct}%
          </div>
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
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: masteryColor(tooltip.node.mastery) }}
              />
              <div className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                {tooltip.node.name}
              </div>
            </div>
            <div className="mt-1 space-y-0.5 text-xs text-gray-500 dark:text-slate-400">
              <div>类别：{tooltip.node.category}</div>
              <div>掌握情况：{tooltip.node.mastery}%</div>
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
                  className="rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:shadow-md transition-all"
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
                  className="rounded-lg bg-gradient-to-r from-rose-500 to-sky-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:shadow-md transition-all"
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
            <svg width="12" height="10" viewBox="0 0 12 10" className="shrink-0">
              <line x1="1" y1="5" x2="8" y2="5" stroke="#6E8CA9" strokeWidth="1.6" />
              <path d="M8 2 L11 5 L8 8 Z" fill="#6E8CA9" />
            </svg>
            前置依赖：先学左边 → 再学箭头所指
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-[#14B8A6]" />
            出色 ≥85
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-[#3B82F6]" />
            良好 60-84
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-[#F59E0B]" />
            需加强 40-59
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-[#F43F5E]" />
            薄弱 &lt;40
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-dashed border-[#FB7185] bg-transparent" />
            玫红虚线 = 待巩固
          </span>
          {pathNodeIds.size > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-dashed border-[#3B82F6] bg-transparent" />
              蓝色虚线 = 推荐路径
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-400 dark:text-slate-500">
          滚轮缩放 · 拖拽平移 · 点击查看 · + / - / 0 快捷缩放
        </span>
      </div>

      {/* Learning path card */}
      {learningPath && learningPath.nodes.length > 1 && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800/50 dark:bg-blue-900/10">
          <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
            推荐学习安排
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
                      animateZoomTo(targetScale, rect.width / 2, rect.height / 2, {
                        x: rect.width / 2 - ln.x * targetScale,
                        y: rect.height / 2 - ln.y * targetScale,
                      });
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
