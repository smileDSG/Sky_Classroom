'use client';

import { motion } from 'motion/react';
import { buildArrowPath, approxActorRadius } from '@/lib/animation/interpolate';
import type { Actor, ActorState } from '@/lib/animation/types';

/** 公共补间配置（spec §4：~700ms 弹簧） */
export const STEP_TRANSITION = { type: 'spring' as const, stiffness: 120, damping: 20 };

/** 高亮框描边脉冲（spec §4：attention 效果），1.4s 循环 */
const PULSE_TRANSITION = { duration: 1.4, repeat: Infinity, ease: 'easeInOut' as const };

interface ActorProps {
  actor: Actor;
  state: ActorState;
  stateOf: (actorId: string) => ActorState | undefined;
  actorOf: (actorId: string) => Actor | undefined;
  /** exiting=true：该演员本步已退场，挂载时即以 opacity 1 渲染再淡出 */
  mode?: 'visible' | 'exiting';
}

/** 取演员显示标签（状态可覆写） */
function labelOf(actor: Actor, state: ActorState): string {
  // ArrowActor.label 为可选属性，`in` 收窄后仍可能是 undefined，需兜底空串
  return state.labelOverride ?? ('label' in actor ? (actor.label ?? '') : '');
}

function colorOf(actor: Actor, state: ActorState): string {
  return state.colorOverride ?? ('color' in actor ? actor.color : '#4f8ef7');
}

function enterInitial(mode: 'visible' | 'exiting' | undefined) {
  return mode === 'exiting' ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 };
}

export function NodeActorView({ actor, state, mode }: ActorProps) {
  if (actor.kind !== 'node') return null;
  const color = colorOf(actor, state);
  const fill = `${color}26`; // 14% 透明底
  const shapeProps = {
    initial: { stroke: color, fill },
    animate: { stroke: color, fill },
    transition: STEP_TRANSITION,
    strokeWidth: 3,
  };
  return (
    <motion.g
      data-actor-id={actor.id}
      initial={{ ...enterInitial(mode), x: state.x, y: state.y }}
      animate={{
        x: state.x,
        y: state.y,
        opacity: state.exiting ? 0 : (state.opacity ?? 1),
        scale: state.scale ?? 1,
      }}
      transition={STEP_TRANSITION}
    >
      {actor.shape === 'circle' ? (
        <motion.circle r={actor.r ?? 28} {...shapeProps} />
      ) : (
        <motion.rect
          x={-(actor.w ?? 80) / 2}
          y={-(actor.h ?? 40) / 2}
          width={actor.w ?? 80}
          height={actor.h ?? 40}
          rx={8}
          {...shapeProps}
        />
      )}
      <motion.text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={20}
        fontWeight={600}
        initial={{ fill: color }}
        animate={{ fill: color }}
        transition={STEP_TRANSITION}
      >
        {labelOf(actor, state)}
      </motion.text>
    </motion.g>
  );
}

export function ArrayCellActorView({ actor, state, mode }: ActorProps) {
  if (actor.kind !== 'array-cell') return null;
  const color = colorOf(actor, state);
  return (
    <motion.g
      data-actor-id={actor.id}
      initial={{ ...enterInitial(mode), x: state.x, y: state.y }}
      animate={{
        x: state.x,
        y: state.y,
        opacity: state.exiting ? 0 : (state.opacity ?? 1),
        scale: state.scale ?? 1,
      }}
      transition={STEP_TRANSITION}
    >
      <motion.rect
        x={-actor.w / 2}
        y={-actor.h / 2}
        width={actor.w}
        height={actor.h}
        rx={6}
        strokeWidth={2.5}
        initial={{ stroke: color, fill: `${color}1a` }}
        animate={{ stroke: color, fill: `${color}1a` }}
        transition={STEP_TRANSITION}
      />
      <motion.text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={22}
        fontWeight={600}
        initial={{ fill: color }}
        animate={{ fill: color }}
        transition={STEP_TRANSITION}
      >
        {labelOf(actor, state)}
      </motion.text>
    </motion.g>
  );
}

export function BarActorView({ actor, state, mode }: ActorProps) {
  if (actor.kind !== 'bar') return null;
  const color = colorOf(actor, state);
  return (
    <motion.g
      data-actor-id={actor.id}
      initial={{ opacity: mode === 'exiting' ? 1 : 0, x: state.x, y: state.y }}
      animate={{ x: state.x, y: state.y, opacity: state.exiting ? 0 : (state.opacity ?? 1) }}
      transition={STEP_TRANSITION}
    >
      {/* v1 柱高固定 200px；scale 语义留待后续 */}
      <motion.rect
        x={-actor.w / 2}
        y={-200}
        width={actor.w}
        height={200}
        rx={4}
        initial={{ fill: color }}
        animate={{ fill: color }}
        transition={STEP_TRANSITION}
      />
      <motion.text
        textAnchor="middle"
        y={-210}
        fontSize={18}
        fontWeight={600}
        initial={{ fill: color }}
        animate={{ fill: color }}
        transition={STEP_TRANSITION}
      >
        {labelOf(actor, state)}
      </motion.text>
    </motion.g>
  );
}

export function TextActorView({ actor, state, mode }: ActorProps) {
  if (actor.kind !== 'text') return null;
  return (
    <motion.text
      data-actor-id={actor.id}
      textAnchor="middle"
      fontSize={actor.size}
      fontWeight={600}
      initial={{
        opacity: mode === 'exiting' ? 1 : 0,
        x: state.x,
        y: state.y,
        fill: colorOf(actor, state),
      }}
      animate={{
        x: state.x,
        y: state.y,
        opacity: state.exiting ? 0 : (state.opacity ?? 1),
        fill: colorOf(actor, state),
      }}
      transition={STEP_TRANSITION}
    >
      {state.labelOverride ?? actor.content}
    </motion.text>
  );
}

export function PointerActorView({ actor, state, mode, stateOf, actorOf }: ActorProps) {
  if (actor.kind !== 'pointer') return null;
  const target = stateOf(actor.targetActorId);
  const targetActor = actorOf(actor.targetActorId);
  const tx = target?.x ?? state.x;
  const ty = target?.y ?? state.y;
  const r = targetActor ? approxActorRadius(targetActor) : 24;
  return (
    <motion.g
      data-actor-id={actor.id}
      initial={{ opacity: mode === 'exiting' ? 1 : 0, x: tx, y: ty + r + 22 }}
      animate={{ x: tx, y: ty + r + 22, opacity: state.exiting ? 0 : 1 }}
      transition={STEP_TRANSITION}
    >
      <path d="M -8 -14 L 8 -14 L 0 0 Z" fill="#e8590c" />
      <text textAnchor="middle" y={16} fontSize={18} fontWeight={700} fill="#e8590c">
        {state.labelOverride ?? actor.label}
      </text>
    </motion.g>
  );
}

export function HighlightActorView({ actor, state, mode, stateOf, actorOf }: ActorProps) {
  if (actor.kind !== 'highlight') return null;
  const target = stateOf(actor.targetActorId);
  const targetActor = actorOf(actor.targetActorId);
  const r = (targetActor ? approxActorRadius(targetActor) : 24) + 12;
  // 高亮框定位只靠 transform 平移（rect 几何原点在 (0,0)，覆盖 [0,2r]）：
  // 勿再加静态 x/y 属性——SVG 几何属性与 motion 的 transform 叠加会使整体偏移 -r
  const cx = (target?.x ?? state.x) - r;
  const cy = (target?.y ?? state.y) - r;
  const isExiting = state.exiting || mode === 'exiting';
  const color = state.colorOverride ?? actor.color;
  return (
    <motion.rect
      data-actor-id={actor.id}
      width={r * 2}
      height={r * 2}
      rx={12}
      fill="none"
      strokeWidth={3.5}
      initial={{ opacity: isExiting ? 1 : 0, x: cx, y: cy, stroke: color, strokeOpacity: 1 }}
      animate={{
        x: cx,
        y: cy,
        opacity: isExiting ? 0 : 1,
        stroke: color,
        // 描边脉冲仅在可见态循环；退场时保持常亮随整体淡出
        strokeOpacity: isExiting ? 1 : [1, 0.3, 1],
      }}
      transition={{
        ...STEP_TRANSITION,
        strokeOpacity: isExiting ? STEP_TRANSITION : PULSE_TRANSITION,
      }}
    />
  );
}

export function ArrowActorView({ actor, state, mode, stateOf, actorOf }: ActorProps) {
  if (actor.kind !== 'arrow') return null;
  const from = stateOf(actor.fromActorId);
  const to = stateOf(actor.toActorId);
  const fromActor = actorOf(actor.fromActorId);
  const toActor = actorOf(actor.toActorId);
  if (!from || !to || !fromActor || !toActor) return null;
  // 箭头端点从演员状态实时计算（spec §3.2：节点移动时箭头自动跟随）
  const d = buildArrowPath({
    x1: from.x,
    y1: from.y,
    x2: to.x,
    y2: to.y,
    r1: approxActorRadius(fromActor),
    r2: approxActorRadius(toActor),
    curved: actor.curved ?? false,
  });
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  return (
    <g data-actor-id={actor.id}>
      <motion.path
        d={d}
        initial={{ opacity: mode === 'exiting' ? 1 : 0, d }}
        animate={{ opacity: state.exiting ? 0 : 1, d }}
        transition={STEP_TRANSITION}
        fill="none"
        className="stroke-neutral-600 dark:stroke-neutral-300"
        strokeWidth={2.5}
        markerEnd="url(#anim-arrowhead)"
      />
      {actor.label ? (
        <motion.text
          initial={{ opacity: mode === 'exiting' ? 1 : 0, x: midX, y: midY - 10 }}
          animate={{ x: midX, y: midY - 10, opacity: state.exiting ? 0 : 1 }}
          fontSize={16}
          className="fill-neutral-600 dark:fill-neutral-300"
          textAnchor="middle"
        >
          {actor.label}
        </motion.text>
      ) : null}
    </g>
  );
}

export function AxesActorView({ actor, state, mode }: ActorProps) {
  if (actor.kind !== 'axes') return null;
  return (
    <motion.g
      data-actor-id={actor.id}
      initial={{ opacity: mode === 'exiting' ? 1 : 0, x: state.x, y: state.y }}
      animate={{ x: state.x, y: state.y, opacity: state.exiting ? 0 : 1 }}
      transition={STEP_TRANSITION}
      className="stroke-neutral-400 dark:stroke-neutral-500"
      strokeWidth={1.5}
    >
      <line x1={-450} y1={0} x2={450} y2={0} markerEnd="url(#anim-arrowhead)" />
      <line x1={0} y1={220} x2={0} y2={-220} markerEnd="url(#anim-arrowhead)" />
    </motion.g>
  );
}
