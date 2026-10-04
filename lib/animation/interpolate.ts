import type { Actor, AnimationScript, ActorState } from './types';

export interface ActorView {
  actor: Actor;
  state: ActorState;
  /** 是否应做入场动画（第一步、或上一步不可见） */
  isEntering: boolean;
}

export interface StepView {
  visible: ActorView[];
  /** 上一步可见、本步不可见的演员（做出场动画） */
  exiting: ActorView[];
}

/**
 * 全量快照解析（spec §3.2）：演员是否入场/出场由相邻步状态隐式推导，
 * LLM 显式给的 entering/exiting 标记仅作补充（隐式推导优先，全量快照必然自洽）。
 */
export function resolveStepView(script: AnimationScript, stepIndex: number): StepView {
  const byId = new Map(script.actors.map((a) => [a.id, a]));
  const current = script.steps[Math.max(0, Math.min(stepIndex, script.steps.length - 1))];
  const prev = stepIndex > 0 ? script.steps[stepIndex - 1] : null;

  const currentIds = new Set(current.actorStates.map((s) => s.actorId));
  const visible: ActorView[] = current.actorStates
    .filter((s) => byId.has(s.actorId))
    .map((state) => ({
      actor: byId.get(state.actorId)!,
      state,
      isEntering: !prev || !prev.actorStates.some((p) => p.actorId === state.actorId),
    }));

  const exiting: ActorView[] = prev
    ? prev.actorStates
        .filter((s) => byId.has(s.actorId) && !currentIds.has(s.actorId))
        .map((state) => ({ actor: byId.get(state.actorId)!, state, isEntering: false }))
    : [];

  return { visible, exiting };
}

/** 演员的近似包围半径，用于箭头端点收缩 */
export function approxActorRadius(actor: Actor): number {
  switch (actor.kind) {
    case 'node':
      return actor.shape === 'circle'
        ? (actor.r ?? 28)
        : Math.min(actor.w ?? 60, actor.h ?? 40) / 2;
    case 'array-cell':
      return Math.min(actor.w, actor.h) / 2;
    case 'bar':
      return actor.w / 2;
    case 'text':
      return actor.size * 0.7;
    default:
      return 0;
  }
}

export interface ArrowGeometry {
  /** from 演员中心坐标 */
  x1: number;
  y1: number;
  /** to 演员中心坐标 */
  x2: number;
  y2: number;
  r1: number;
  r2: number;
  curved: boolean;
}

/**
 * 箭头路径：从 from 中心指向 to 中心，两端各收缩 半径+6px（尾部再 +10px 给箭头 marker）。
 * 直线返回 "M x1 y1 L x2 y2"；曲线返回 "M x1 y1 Q cx cy x2 y2"
 * （控制点取中点法向偏移，偏移量 = 距离 * 0.18）。
 */
export function buildArrowPath(g: ArrowGeometry): string {
  const dx = g.x2 - g.x1;
  const dy = g.y2 - g.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = g.x1 + ux * (g.r1 + 6);
  const y1 = g.y1 + uy * (g.r1 + 6);
  const x2 = g.x2 - ux * (g.r2 + 6 + 10);
  const y2 = g.y2 - uy * (g.r2 + 6 + 10);
  if (!g.curved) return `M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const cx = mx - uy * len * 0.18;
  const cy = my + ux * len * 0.18;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}
