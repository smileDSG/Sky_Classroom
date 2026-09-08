'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  LayoutDashboard,
  Loader2,
  Maximize2,
  Minimize2,
  Moon,
  RefreshCw,
  Sun,
  Target,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/auth-provider';
import { useAnimatedNumber } from '@/lib/hooks/use-animated-number';
import { isDocumentVisible } from '@/lib/hooks/use-document-visibility';
import { useTheme } from '@/lib/hooks/use-theme';
import { Button } from '@/components/ui/button';
import type { LearningStatsResponse, LearningPath } from '@/lib/teaching/learning-path-types';
import type { CloudMindDashboardData } from '@/lib/cloud-mind/types';
import type { LearnerPreferences } from '@/lib/adaptive-learning/contracts';

// ── Types ───────────────────────────────────────────────────────────

interface DashboardData {
  stats: LearningStatsResponse & { learnerProfile: LearnerPreferences | null };
  cloudMind: CloudMindDashboardData;
  learningPath: { path: LearningPath | null };
}

interface FetchState {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// ── Helpers ─────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toString() : '0';
}

function formatPercent(n: number): string {
  return `${Math.round(n)}%`;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return '很久以前';
}

function clampMastery(mastery: number): number {
  return Math.max(0, Math.min(100, mastery));
}

function getPreferenceLabel(key: string, value: string): string {
  const labels: Record<string, Record<string, string>> = {
    explanationDepth: {
      concise: '简洁',
      standard: '标准',
      detailed: '详细',
      comprehensive: '全面',
    },
    learningPace: {
      slow: '稳步慢学',
      standard: '标准节奏',
      fast: '快速推进',
    },
    stepByStepMode: {
      always: '始终分步',
      'when-needed': '按需分步',
      'hints-first': '提示优先',
    },
    interactionTone: {
      friendly: '友善亲切',
      professional: '专业严谨',
      encouraging: '鼓励引导',
      strict: '严格要求',
      humorous: '幽默风趣',
    },
  };
  return labels[key]?.[value] ?? value;
}

function getContentFormatLabel(value: string): string {
  const map: Record<string, string> = {
    text: '文字',
    'worked-example': '例题',
    diagram: '图示',
    interactive: '互动',
    audio: '语音',
  };
  return map[value] ?? value;
}

// ── Tech Frame (科技感装饰边框) ─────────────────────────────────────

interface TechFrameProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  scan?: boolean;
}

function TechFrame({
  children,
  className = '',
  glowColor = '#8B5CF6',
  scan = false,
}: TechFrameProps) {
  return (
    <div
      className={`group relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-md ${className}`}
      style={{ boxShadow: `0 0 20px ${glowColor}15, inset 0 0 30px rgba(0,0,0,0.3)` }}
    >
      {/* 四角装饰 */}
      <span
        className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 transition-all duration-300 group-hover:h-4 group-hover:w-4"
        style={{ borderColor: glowColor }}
      />
      <span
        className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 transition-all duration-300 group-hover:h-4 group-hover:w-4"
        style={{ borderColor: glowColor }}
      />
      <span
        className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 transition-all duration-300 group-hover:h-4 group-hover:w-4"
        style={{ borderColor: glowColor }}
      />
      <span
        className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 transition-all duration-300 group-hover:h-4 group-hover:w-4"
        style={{ borderColor: glowColor }}
      />
      {/* 扫描线动画 */}
      {scan && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)`,
            boxShadow: `0 0 8px ${glowColor}`,
          }}
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {children}
    </div>
  );
}

// ── Section Title (装饰性标题) ───────────────────────────────────────

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  glowColor?: string;
}

function SectionTitle({ title, subtitle, icon, glowColor = '#8B5CF6' }: SectionTitleProps) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span
          className="h-4 w-1 rounded-full"
          style={{ background: glowColor, boxShadow: `0 0 8px ${glowColor}` }}
        />
        {icon && (
          <span style={{ color: glowColor }} className="drop-shadow-[0_0_4px_currentColor]">
            {icon}
          </span>
        )}
        <h2 className="text-sm font-semibold tracking-wide text-white">{title}</h2>
      </div>
      {subtitle && <span className="text-[11px] text-slate-500">{subtitle}</span>}
    </div>
  );
}

// ── Animated Stat Card ──────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
  delay?: number;
  spark?: boolean;
}

function StatCard({
  label,
  value,
  suffix = '',
  icon,
  color,
  gradient,
  delay = 0,
  spark,
}: StatCardProps) {
  const animated = useAnimatedNumber(value, { duration: 1200 });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.03, y: -3 }}
      className={`group relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br ${gradient} p-4 backdrop-blur-md`}
      style={{ boxShadow: `0 0 16px ${color}20, inset 0 1px 0 rgba(255,255,255,0.05)` }}
    >
      {/* 四角装饰 */}
      <span
        className="pointer-events-none absolute left-0 top-0 h-2 w-2 border-l border-t opacity-60 transition-all group-hover:h-3 group-hover:w-3 group-hover:opacity-100"
        style={{ borderColor: color }}
      />
      <span
        className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r opacity-60 transition-all group-hover:h-3 group-hover:w-3 group-hover:opacity-100"
        style={{ borderColor: color }}
      />
      <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/5 blur-xl" />
      <div className="relative flex items-start justify-between">
        <div>
          <div
            className="text-2xl font-bold tracking-tight"
            style={{ color: '#fff', textShadow: `0 0 12px ${color}60` }}
          >
            {formatNumber(animated.value)}
            {suffix && <span className="ml-1 text-sm text-white/50">{suffix}</span>}
          </div>
          <div className="mt-1 text-xs font-medium text-white/60">{label}</div>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10"
          style={{ color, boxShadow: `0 0 8px ${color}30` }}
        >
          {icon}
        </div>
      </div>
      {spark && value > 0 && (
        <div className="absolute bottom-2 right-2">
          <motion.div
            className="h-1 w-1 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
            animate={{ scale: [1, 1.8, 1], opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      )}
    </motion.div>
  );
}

// ── Ring Progress ───────────────────────────────────────────────────

function RingProgress({
  percent,
  size = 120,
  color = '#8B5CF6',
}: {
  percent: number;
  size?: number;
  color?: string;
}) {
  const r = size * 0.36;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        className="stroke-white/10"
        strokeWidth={size * 0.08}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.08}
        strokeDasharray={circumference}
        strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - (clamped / 100) * circumference }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
      />
    </svg>
  );
}

// ── Mini Bar Chart (Weak Points) ────────────────────────────────────

function WeakPointsBarChart({
  items,
}: {
  items: { label: string; value: number; count: number }[];
}) {
  const max = Math.max(...items.map((i) => i.value || 1), 1);

  return (
    <div className="space-y-3">
      {items.slice(0, 6).map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="group"
        >
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate pr-2 text-slate-200">{item.label}</span>
            <span className="shrink-0 text-slate-400">{item.count} 错题</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-400"
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / max) * 100}%` }}
              transition={{ duration: 0.8, delay: 0.2 + i * 0.06 }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Radar Chart ─────────────────────────────────────────────────────

interface RadarDimension {
  name: string;
  value: number;
}

function AbilityRadar({ data }: { data: RadarDimension[] }) {
  const n = data.length || 1;
  const allZero = data.every((d) => d.value === 0);
  const CX = 120;
  const CY = 120;
  const R = 80;
  const LEVELS = 4;

  const gridLevels = useMemo(
    () =>
      Array.from({ length: LEVELS }).map((_, i) => ({
        ratio: (i + 1) / LEVELS,
        points: polygonPoints(n, (i + 1) / LEVELS, CX, CY, R),
      })),
    [n],
  );

  const valuePoints = useMemo(
    () =>
      data.map((d, i) => ({
        x: CX + R * (d.value / 100) * Math.cos((Math.PI * 2 * i) / n - Math.PI / 2),
        y: CY + R * (d.value / 100) * Math.sin((Math.PI * 2 * i) / n - Math.PI / 2),
      })),
    [data, n],
  );

  const labelPoints = useMemo(() => polygonPoints(n, 1.22, CX, CY, R), [n]);

  if (allZero) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <Brain className="mb-3 h-10 w-10 text-slate-500" />
        <p className="text-sm font-medium text-slate-300">暂无能力数据</p>
        <p className="mt-1 text-xs text-slate-500">完成练习后将自动生成能力雷达</p>
      </div>
    );
  }

  return (
    <svg viewBox="0 0 240 240" className="h-full w-full" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity={0.3} />
        </linearGradient>
      </defs>
      {gridLevels.map((level, i) => (
        <polygon
          key={i}
          points={pointsToAttr(level.points)}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={i === LEVELS - 1 ? 1 : 0.5}
        />
      ))}
      {polygonPoints(n, 1, CX, CY, R).map((p, i) => (
        <line
          key={i}
          x1={CX}
          y1={CY}
          x2={p.x}
          y2={p.y}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={0.5}
        />
      ))}
      <motion.polygon
        points={pointsToAttr(valuePoints)}
        fill="url(#radarFill)"
        stroke="#8B5CF6"
        strokeWidth={2}
        strokeLinejoin="round"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, type: 'spring' }}
      />
      {valuePoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#8B5CF6" stroke="white" strokeWidth={1.5} />
      ))}
      {labelPoints.map((p, i) => {
        const anchor = Math.abs(p.x - CX) < 5 ? 'middle' : p.x > CX ? 'start' : 'end';
        return (
          <text
            key={i}
            x={p.x}
            y={p.y + 4}
            textAnchor={anchor}
            fill="rgba(255,255,255,0.6)"
            fontSize={10}
            fontWeight={500}
          >
            {data[i]?.name ?? ''}
          </text>
        );
      })}
    </svg>
  );
}

function polygonPoints(n: number, ratio: number, cx: number, cy: number, r: number) {
  return Array.from({ length: n }).map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return {
      x: cx + r * ratio * Math.cos(angle),
      y: cy + r * ratio * Math.sin(angle),
    };
  });
}

function pointsToAttr(pts: { x: number; y: number }[]) {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

// ── Trend Chart ─────────────────────────────────────────────────────

interface TrendPoint {
  label: string;
  value: number;
}

function TrendChart({ data, color = '#8B5CF6' }: { data: TrendPoint[]; color?: string }) {
  if (data.length < 2) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
        <TrendingUp className="mb-2 h-8 w-8 text-slate-500" />
        <p className="text-xs text-slate-400">数据不足，无法生成趋势</p>
      </div>
    );
  }

  const W = 420;
  const H = 180;
  const padL = 36;
  const padR = 16;
  const padT = 20;
  const padB = 32;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const stepX = chartW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: padL + i * stepX,
    y: padT + chartH - (d.value / maxVal) * chartH,
    label: d.label,
    value: d.value,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {Array.from({ length: 5 }).map((_, i) => {
        const y = padT + (i / 4) * chartH;
        const val = Math.round(maxVal - (i / 4) * maxVal);
        return (
          <g key={i}>
            <line
              x1={padL}
              y1={y}
              x2={W - padR}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={0.5}
              strokeDasharray="3,3"
            />
            <text x={padL - 8} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize={9}>
              {val}
            </text>
          </g>
        );
      })}
      {points.map((p, i) => (
        <text
          key={i}
          x={p.x}
          y={H - 8}
          textAnchor="middle"
          fill="rgba(255,255,255,0.45)"
          fontSize={9}
        >
          {p.label}
        </text>
      ))}
      <path d={areaD} fill="url(#trendArea)" />
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
      {points.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill={color}
          stroke="white"
          strokeWidth={1.5}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4 + i * 0.05 }}
        />
      ))}
    </svg>
  );
}

// ── Learning Path Timeline ──────────────────────────────────────────

function PathTimeline({ path }: { path: LearningPath | null }) {
  if (!path || path.nodes.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
        <Target className="mb-2 h-8 w-8 text-slate-500" />
        <p className="text-xs text-slate-400">暂无学习路径</p>
        <Link
          href="/sky/learning"
          className="mt-2 text-xs font-medium text-violet-400 hover:text-violet-300"
        >
          去规划学习路径 →
        </Link>
      </div>
    );
  }

  const completed = path.nodes.filter((n) => n.status === 'completed').length;
  const progress = path.nodes.length > 0 ? (completed / path.nodes.length) * 100 : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{path.title}</h3>
          <p className="text-xs text-white/50">
            {completed}/{path.nodes.length} 节点已完成
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-emerald-400">{Math.round(progress)}%</div>
        </div>
      </div>
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1 }}
        />
      </div>
      <div className="space-y-2">
        {path.nodes.slice(0, 5).map((node, i) => (
          <div key={node.id ?? i} className="flex items-center gap-3 text-xs">
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                node.status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : node.status === 'in_progress'
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'bg-white/10 text-slate-400'
              }`}
            >
              {node.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
            </div>
            <span
              className={`flex-1 truncate ${node.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-200'}`}
            >
              {node.topic}
            </span>
            <span className="shrink-0 text-[10px] text-white/40">{node.estimatedSections} 节</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Recent Activity ─────────────────────────────────────────────────

function RecentActivity({ records }: { records: CloudMindDashboardData['recentRecords'] }) {
  if (records.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
        <Activity className="mb-2 h-8 w-8 text-slate-500" />
        <p className="text-xs text-slate-400">最近没有学习活动</p>
      </div>
    );
  }

  const icons: Record<string, React.ReactNode> = {
    quiz: <BarChart3 className="h-3.5 w-3.5" />,
    mistake: <BookOpen className="h-3.5 w-3.5" />,
    memory: <Brain className="h-3.5 w-3.5" />,
    knowledge: <Zap className="h-3.5 w-3.5" />,
    write: <Activity className="h-3.5 w-3.5" />,
    translate: <Activity className="h-3.5 w-3.5" />,
    slides: <LayoutDashboard className="h-3.5 w-3.5" />,
    profile: <User className="h-3.5 w-3.5" />,
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
        <Clock className="h-4 w-4 text-violet-400" />
        最近活动
      </h3>
      <div className="space-y-3">
        {records.slice(0, 6).map((record, i) => (
          <motion.div
            key={`${record.id}-${i}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-3"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-300">
              {icons[record.source] ?? <Activity className="h-3.5 w-3.5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-slate-200">{record.title}</div>
              <div className="mt-0.5 truncate text-[11px] text-slate-500">{record.detail}</div>
            </div>
            <div className="shrink-0 text-[10px] text-slate-500">
              {formatRelativeTime(record.createdAt)}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Preference Tags ─────────────────────────────────────────────────

function PreferencePanel({ preferences }: { preferences: LearnerPreferences | null }) {
  if (!preferences) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <User className="h-4 w-4 text-cyan-400" />
          学习偏好
        </h3>
        <p className="text-xs text-slate-400">尚未设置学习偏好</p>
        <Link
          href="/account"
          className="mt-2 inline-block text-xs font-medium text-violet-400 hover:text-violet-300"
        >
          去设置 →
        </Link>
      </div>
    );
  }

  const items = [
    { label: '讲解深度', value: preferences.explanationDepth, key: 'explanationDepth' },
    { label: '学习节奏', value: preferences.learningPace, key: 'learningPace' },
    { label: '分步模式', value: preferences.stepByStepMode, key: 'stepByStepMode' },
    { label: '交互语气', value: preferences.interactionTone, key: 'interactionTone' },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
        <User className="h-4 w-4 text-cyan-400" />
        学习偏好
      </h3>
      <div className="mb-4 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.key} className="rounded-xl bg-white/5 p-3">
            <div className="text-[10px] text-white/40">{item.label}</div>
            <div className="mt-0.5 text-xs font-medium text-slate-200">
              {getPreferenceLabel(item.key, item.value)}
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-2 text-[10px] text-white/40">偏好格式</div>
        <div className="flex flex-wrap gap-2">
          {preferences.contentFormatPreferences.map((fmt) => (
            <span
              key={fmt}
              className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[10px] font-medium text-violet-300"
            >
              {getContentFormatLabel(fmt)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-2 text-[10px] text-white/40">档案版本</div>
          <div className="text-sm font-semibold text-white">v{preferences.version}</div>
        </div>
        <div>
          <div className="mb-2 text-[10px] text-white/40">最近更新</div>
          <div className="text-sm font-semibold text-white">
            {new Date(preferences.updatedAt).toLocaleDateString('zh-CN')}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-2 text-[10px] text-white/40">AI 助手名称</div>
        <div className="text-sm font-semibold text-white">{preferences.assistantName}</div>
      </div>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────

export function LearnerProfileDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { resolvedTheme, setTheme, isMounted } = useTheme();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [state, setState] = useState<FetchState>({
    data: null,
    loading: true,
    error: null,
    lastUpdated: null,
  });

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) {
      setState((s) => ({ ...s, loading: true, error: null }));
    }

    try {
      const response = await fetch('/api/sky/profile-dashboard', { credentials: 'include' });
      if (!response.ok) throw new Error(`数据大屏接口错误: ${response.status}`);

      const payload = await response.json();
      setState({
        data: payload.data,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      });
    } catch (err) {
      setState({
        data: null,
        loading: false,
        error: err instanceof Error ? err.message : '数据加载失败',
        lastUpdated: null,
      });
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (isDocumentVisible()) fetchData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const syncFullscreenState = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await dashboardRef.current?.requestFullscreen();
  }, []);

  const accuracy = useMemo(() => {
    const stats = state.data?.stats;
    if (!stats) return 0;
    const attempted = stats.problemsAttempted ?? 0;
    const correct = stats.problemsCorrect ?? 0;
    return attempted > 0 ? (correct / attempted) * 100 : 0;
  }, [state.data]);

  const radarData: RadarDimension[] = useMemo(() => {
    const weak = state.data?.cloudMind.weakPoints ?? [];
    if (weak.length === 0) return [];
    return weak.slice(0, 6).map((p) => ({
      name: p.knowledgePoint.slice(0, 4),
      value: Math.round(clampMastery(p.mastery)),
    }));
  }, [state.data]);

  const weakPointBars = useMemo(() => {
    return (state.data?.cloudMind.weakPoints ?? []).slice(0, 6).map((p) => ({
      label: p.knowledgePoint,
      value: Math.round(100 - clampMastery(p.mastery)),
      count: p.recentMistakeCount,
    }));
  }, [state.data]);

  const trendData: TrendPoint[] = useMemo(() => {
    const records = state.data?.cloudMind.recentRecords ?? [];
    const buckets = new Map<string, number>();
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.set(`${d.getMonth() + 1}/${d.getDate()}`, 0);
    }
    records.forEach((r) => {
      const d = new Date(r.createdAt);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    });
    return Array.from(buckets.entries()).map(([label, value]) => ({ label, value }));
  }, [state.data]);

  if (authLoading || (state.loading && !state.data)) {
    return (
      <div
        data-dashboard-theme
        className="flex min-h-[calc(100dvh-4rem)] items-center justify-center"
        style={{ background: 'var(--dashboard-bg)' }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-violet-500/20" />
            <Loader2 className="relative h-8 w-8 animate-spin text-violet-400" />
          </div>
          <p className="text-sm" style={{ color: 'var(--dashboard-text-muted)' }}>
            正在加载学习情况...
          </p>
        </div>
      </div>
    );
  }

  if (state.error && !state.data) {
    return (
      <div
        data-dashboard-theme
        className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center gap-4 px-4"
        style={{ background: 'var(--dashboard-bg)' }}
      >
        <div
          className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-center"
          style={{ boxShadow: '0 0 20px rgba(239,68,68,0.15)' }}
        >
          <p className="text-red-300">{state.error}</p>
          <Button onClick={() => fetchData()} className="mt-4" variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      </div>
    );
  }

  const stats = state.data?.stats;
  const cloudMind = state.data?.cloudMind;
  const preferences = stats?.learnerProfile;

  return (
    <div
      ref={dashboardRef}
      data-dashboard-theme
      className="relative min-h-[calc(100dvh-4rem)] w-full overflow-x-hidden overflow-y-auto px-4 py-6 md:px-6 lg:px-8"
      style={{
        background: 'var(--dashboard-bg)',
        color: 'var(--dashboard-text-primary)',
      }}
    >
      {/* 网格线背景 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      {/* 顶部光带 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

      <div className="relative">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-500/30 bg-gradient-to-br from-violet-500/20 to-cyan-500/10"
                style={{ boxShadow: '0 0 16px rgba(139,92,246,0.3)' }}
              >
                <LayoutDashboard className="h-5 w-5 text-violet-300" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="bg-gradient-to-r from-violet-300 via-white to-cyan-300 bg-clip-text text-xl font-bold tracking-wide text-transparent">
                    学习情况总览
                  </h1>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>
                    LIVE
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-px w-8 bg-gradient-to-r from-violet-500/50 to-transparent" />
                  <p className="text-xs text-slate-400">
                    {user?.username ?? '学习者'} · 每 15 秒自动刷新
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {state.lastUpdated && (
              <span className="text-xs text-slate-500">
                更新于{' '}
                {state.lastUpdated.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            )}
            {isMounted && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="dashboard-theme-btn border-cyan-500/20 bg-cyan-500/5 text-slate-200 hover:bg-cyan-500/10 hover:text-white"
                aria-label={resolvedTheme === 'dark' ? '切换浅色模式' : '切换深色模式'}
                title={resolvedTheme === 'dark' ? '切换浅色模式' : '切换深色模式'}
              >
                {resolvedTheme === 'dark' ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {resolvedTheme === 'dark' ? '浅色' : '深色'}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={toggleFullscreen}
              className="border-cyan-500/20 bg-cyan-500/5 text-slate-200 hover:bg-cyan-500/10 hover:text-white"
              aria-label={isFullscreen ? '退出全屏' : '全屏显示'}
              title={isFullscreen ? '退出全屏（Esc）' : '全屏显示'}
            >
              {isFullscreen ? (
                <Minimize2 className="mr-2 h-4 w-4" />
              ) : (
                <Maximize2 className="mr-2 h-4 w-4" />
              )}
              {isFullscreen ? '退出全屏' : '全屏'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchData()}
              disabled={state.loading}
              className="border-violet-500/20 bg-violet-500/5 text-slate-200 hover:bg-violet-500/10 hover:text-white"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${state.loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </motion.header>

        {/* KPI Cards */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <StatCard
            label="知识掌握情况"
            value={stats?.masteryPercent ?? 0}
            suffix="%"
            icon={<Brain className="h-5 w-5" />}
            color="#8B5CF6"
            gradient="from-violet-600/30 to-indigo-600/20"
            delay={0}
            spark
          />
          <StatCard
            label="连续打卡"
            value={stats?.streakDays ?? 0}
            suffix="天"
            icon={<Flame className="h-5 w-5" />}
            color="#F59E0B"
            gradient="from-orange-600/30 to-amber-600/20"
            delay={0.05}
          />
          <StatCard
            label="今日学习"
            value={stats?.todayStudyMinutes ?? 0}
            suffix="分"
            icon={<Clock className="h-5 w-5" />}
            color="#06B6D4"
            gradient="from-cyan-600/30 to-blue-600/20"
            delay={0.1}
          />
          <StatCard
            label="做题正确率"
            value={accuracy}
            suffix="%"
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="#10B981"
            gradient="from-emerald-600/30 to-teal-600/20"
            delay={0.15}
          />
          <StatCard
            label="待复习错题"
            value={cloudMind?.dueReviews.length ?? 0}
            icon={<BookOpen className="h-5 w-5" />}
            color="#F43F5E"
            gradient="from-rose-600/30 to-pink-600/20"
            delay={0.2}
          />
          <StatCard
            label="总练习题数"
            value={cloudMind?.summary.totalQuestions ?? 0}
            icon={<BarChart3 className="h-5 w-5" />}
            color="#6366F1"
            gradient="from-indigo-600/30 to-violet-600/20"
            delay={0.25}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left: Mastery + Accuracy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-1"
          >
            <TechFrame glowColor="#8B5CF6" scan className="h-full p-5">
              <SectionTitle
                title="整体掌握情况"
                subtitle="根据学习记录计算"
                icon={<Brain className="h-4 w-4" />}
              />
              <div className="flex flex-col items-center justify-center py-4">
                <RingProgress percent={stats?.masteryPercent ?? 0} size={160} color="#8B5CF6" />
                <div className="mt-4 text-center">
                  <div
                    className="text-3xl font-bold"
                    style={{ color: '#fff', textShadow: '0 0 16px rgba(139,92,246,0.6)' }}
                  >
                    {formatPercent(stats?.masteryPercent ?? 0)}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {cloudMind?.hasLearningData ? '已有学习数据' : '数据采集中'}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
                <div className="text-center">
                  <div
                    className="text-lg font-semibold text-emerald-400"
                    style={{ textShadow: '0 0 8px rgba(16,185,129,0.4)' }}
                  >
                    {cloudMind?.summary.totalCorrect ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500">累计正确</div>
                </div>
                <div className="text-center">
                  <div
                    className="text-lg font-semibold text-violet-400"
                    style={{ textShadow: '0 0 8px rgba(139,92,246,0.4)' }}
                  >
                    {cloudMind?.weakPoints.length ?? 0}
                  </div>
                  <div className="text-[10px] text-slate-500">薄弱知识点</div>
                </div>
              </div>
            </TechFrame>
          </motion.div>

          {/* Middle: Trend Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="lg:col-span-2"
          >
            <TechFrame glowColor="#06B6D4" className="h-full p-5">
              <SectionTitle
                title="近14天学习活跃度"
                subtitle="每日学习记录数"
                icon={<TrendingUp className="h-4 w-4" />}
                glowColor="#06B6D4"
              />
              <div className="h-56">
                <TrendChart data={trendData} color="#06B6D4" />
              </div>
            </TechFrame>
          </motion.div>

          {/* Radar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-1"
          >
            <TechFrame glowColor="#8B5CF6" className="h-full p-5">
              <SectionTitle
                title="能力雷达"
                subtitle="薄弱维度"
                icon={<Zap className="h-4 w-4" />}
              />
              <div className="h-64">
                <AbilityRadar data={radarData} />
              </div>
            </TechFrame>
          </motion.div>

          {/* Weak Points */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="lg:col-span-1"
          >
            <TechFrame glowColor="#F43F5E" className="h-full p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-4 w-1 rounded-full"
                    style={{ background: '#F43F5E', boxShadow: '0 0 8px #F43F5E' }}
                  />
                  <h2 className="text-sm font-semibold tracking-wide text-white">
                    薄弱知识点 TOP6
                  </h2>
                </div>
                <Link
                  href="/sky/learning/mistakes"
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  查看全部
                </Link>
              </div>
              {weakPointBars.length > 0 ? (
                <WeakPointsBarChart items={weakPointBars} />
              ) : (
                <div className="flex h-48 items-center justify-center text-xs text-slate-500">
                  暂无薄弱知识点数据
                </div>
              )}
            </TechFrame>
          </motion.div>

          {/* Learning Path */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-1"
          >
            <TechFrame glowColor="#10B981" className="h-full p-5">
              <PathTimeline path={state.data?.learningPath.path ?? null} />
            </TechFrame>
          </motion.div>

          {/* Preferences */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="lg:col-span-1"
          >
            <TechFrame glowColor="#06B6D4" className="h-full p-5">
              <PreferencePanel preferences={preferences ?? null} />
            </TechFrame>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="lg:col-span-2"
          >
            <TechFrame glowColor="#6366F1" scan className="h-full p-5">
              <RecentActivity records={cloudMind?.recentRecords ?? []} />
            </TechFrame>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="mt-8 flex items-center justify-between border-t border-violet-500/20 pt-4 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-violet-500" />
            <span>数据每 15 秒自动刷新 · 实时展示学习情况</span>
          </div>
          <Link href="/account" className="text-violet-400 hover:text-violet-300">
            编辑学习偏好 →
          </Link>
        </footer>
      </div>
    </div>
  );
}
