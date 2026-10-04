import { describe, it, expect } from 'vitest';
import { resolveStepView, buildArrowPath, approxActorRadius } from '@/lib/animation/interpolate';
import type { AnimationScript } from '@/lib/animation/types';

const script: AnimationScript = {
  id: 's',
  title: 't',
  topic: 'tp',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675 },
  actors: [
    { kind: 'node', id: 'a', label: 'A', shape: 'circle', color: '#4f8ef7', r: 28 },
    { kind: 'node', id: 'b', label: 'B', shape: 'rect', color: '#4f8ef7', w: 80, h: 40 },
    { kind: 'arrow', id: 'arr', fromActorId: 'a', toActorId: 'b' },
  ],
  steps: [
    {
      id: 'st1',
      title: 's1',
      narration: 'n1',
      actorStates: [
        { actorId: 'a', x: 200, y: 300 },
        { actorId: 'b', x: 800, y: 300 },
        { actorId: 'arr', x: 0, y: 0 },
      ],
    },
    {
      id: 'st2',
      title: 's2',
      narration: 'n2',
      actorStates: [
        { actorId: 'a', x: 200, y: 300 },
        { actorId: 'arr', x: 0, y: 0 },
      ],
    },
  ],
};

describe('resolveStepView', () => {
  it('返回当步可见演员及其状态', () => {
    const view = resolveStepView(script, 0);
    expect(view.visible).toHaveLength(3);
    const a = view.visible.find((v) => v.actor.id === 'a')!;
    expect(a.state.x).toBe(200);
    expect(a.actor.kind).toBe('node');
  });

  it('上一步有、本步没有的演员标记为 exiting（隐式推导）', () => {
    const view = resolveStepView(script, 1);
    expect(view.exiting.map((v) => v.actor.id)).toEqual(['b']);
    expect(view.visible.find((v) => v.actor.id === 'b')).toBeUndefined();
  });

  it('第一步所有可见演员视为 entering', () => {
    const view = resolveStepView(script, 0);
    expect(view.visible.every((v) => v.isEntering)).toBe(true);
  });
});

describe('approxActorRadius', () => {
  it('circle 用 r，rect 用 min(w,h)/2', () => {
    const view = resolveStepView(script, 0);
    const a = view.visible.find((v) => v.actor.id === 'a')!;
    const b = view.visible.find((v) => v.actor.id === 'b')!;
    expect(approxActorRadius(a.actor)).toBe(28);
    expect(approxActorRadius(b.actor)).toBe(20);
  });
});

describe('buildArrowPath', () => {
  it('直线箭头返回 M..L.. 且端点按半径收缩', () => {
    // from (200,300) r=28 → 起点 200+(28+6)=234；to (800,300) r=20 → 终点 800-(20+6+10)=764
    const d = buildArrowPath({ x1: 200, y1: 300, x2: 800, y2: 300, r1: 28, r2: 20, curved: false });
    expect(d).toMatch(/^M 234(\.0)? 300(\.0)? L 764(\.0)? 300(\.0)?$/);
  });

  it('曲线箭头返回 Q 命令', () => {
    const d = buildArrowPath({ x1: 200, y1: 300, x2: 800, y2: 300, r1: 28, r2: 20, curved: true });
    expect(d).toContain('Q');
  });
});
