'use client';

import { useMemo, type ReactNode } from 'react';
import type { Actor, AnimationScript, ActorState } from '@/lib/animation/types';
import { resolveStepView } from '@/lib/animation/interpolate';
import {
  NodeActorView,
  ArrayCellActorView,
  BarActorView,
  TextActorView,
  PointerActorView,
  HighlightActorView,
  ArrowActorView,
  AxesActorView,
} from './actors';

interface AnimationCanvasProps {
  script: AnimationScript;
  stepIndex: number;
}

interface ActorSwitchProps {
  actor: Actor;
  state: ActorState;
  stateOf: (actorId: string) => ActorState | undefined;
  actorOf: (actorId: string) => Actor | undefined;
  mode?: 'visible' | 'exiting';
}

function ActorSwitch({ actor, state, stateOf, actorOf, mode }: ActorSwitchProps) {
  const props = { actor, state, stateOf, actorOf, mode };
  switch (actor.kind) {
    case 'node':
      return <NodeActorView {...props} />;
    case 'array-cell':
      return <ArrayCellActorView {...props} />;
    case 'bar':
      return <BarActorView {...props} />;
    case 'text':
      return <TextActorView {...props} />;
    case 'pointer':
      return <PointerActorView {...props} />;
    case 'highlight':
      return <HighlightActorView {...props} />;
    case 'arrow':
      return <ArrowActorView {...props} />;
    case 'axes':
      return <AxesActorView {...props} />;
    default:
      return null;
  }
}

export function AnimationCanvas({ script, stepIndex }: AnimationCanvasProps) {
  const view = useMemo(() => resolveStepView(script, stepIndex), [script, stepIndex]);

  const stateMap = useMemo(() => {
    const m = new Map<string, ActorState>();
    for (const v of view.visible) m.set(v.actor.id, v.state);
    return m;
  }, [view]);
  const actorMap = useMemo(() => new Map(script.actors.map((a) => [a.id, a])), [script.actors]);
  const stateOf = (actorId: string): ActorState | undefined => stateMap.get(actorId);
  const actorOf = (actorId: string): Actor | undefined => actorMap.get(actorId);

  const { width, height, showGrid } = script.stage;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full max-w-full rounded-xl border bg-white dark:bg-zinc-900"
      role="img"
      aria-label={script.title}
    >
      <defs>
        <marker
          id="anim-arrowhead"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill="#495057" />
        </marker>
      </defs>
      {showGrid ? <GridPattern width={width} height={height} /> : null}
      {/* 退场演员先渲染（垫底），以 exiting 模式挂载后立即淡出 */}
      {view.exiting.map((v) => (
        <ActorSwitch
          key={`exit-${v.actor.id}`}
          actor={v.actor}
          state={{ ...v.state, exiting: true }}
          stateOf={stateOf}
          actorOf={actorOf}
          mode="exiting"
        />
      ))}
      {view.visible.map((v) => (
        <ActorSwitch
          key={v.actor.id}
          actor={v.actor}
          state={v.state}
          stateOf={stateOf}
          actorOf={actorOf}
        />
      ))}
    </svg>
  );
}

function GridPattern({ width, height }: { width: number; height: number }) {
  const lines: ReactNode[] = [];
  for (let x = 0; x <= width; x += 60) {
    lines.push(
      <line key={`v${x}`} x1={x} y1={0} x2={x} y2={height} stroke="#e9ecef" strokeWidth={1} />,
    );
  }
  for (let y = 0; y <= height; y += 60) {
    lines.push(
      <line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} stroke="#e9ecef" strokeWidth={1} />,
    );
  }
  return <g aria-hidden>{lines}</g>;
}
