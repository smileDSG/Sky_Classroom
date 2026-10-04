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

  it('exiting 视图携带上一步坐标', () => {
    const view = resolveStepView(script, 1);
    const b = view.exiting.find((v) => v.actor.id === 'b')!;
    expect(b.state.x).toBe(800);
    expect(b.state.y).toBe(300);
  });

  it('stepIndex 越界时钳制到末步，视图与最后一步一致（无重复入场）', () => {
    expect(resolveStepView(script, script.steps.length)).toEqual(resolveStepView(script, 1));
    expect(resolveStepView(script, -1)).toEqual(resolveStepView(script, 0));
  });

  it('步内重复 actorId 仅保留第一个（可见与退场均防御）', () => {
    const dup: AnimationScript = {
      ...script,
      steps: [
        {
          id: 'd1',
          title: 'd',
          narration: 'n',
          actorStates: [
            { actorId: 'b', x: 111, y: 222 },
            { actorId: 'b', x: 333, y: 444 },
          ],
        },
        {
          id: 'd2',
          title: 'd',
          narration: 'n',
          actorStates: [{ actorId: 'a', x: 10, y: 20 }],
        },
      ],
    };
    const v0 = resolveStepView(dup, 0);
    expect(v0.visible).toHaveLength(1);
    expect(v0.visible[0].state.x).toBe(111);
    const v1 = resolveStepView(dup, 1);
    expect(v1.exiting).toHaveLength(1);
    expect(v1.exiting[0].state.x).toBe(111);
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

  it('两端过近时端点坍缩到中点，不产生反向箭头', () => {
    // 两 r=28 圆相距 50px：收缩总量 (28+6)+(28+16)=78 > 50，若不钳制会反向（M 234 → L 206）
    const straight = buildArrowPath({
      x1: 200,
      y1: 300,
      x2: 250,
      y2: 300,
      r1: 28,
      r2: 28,
      curved: false,
    });
    expect(straight).toBe('M 225.0 300.0 L 225.0 300.0');
    const curved = buildArrowPath({
      x1: 200,
      y1: 300,
      x2: 250,
      y2: 300,
      r1: 28,
      r2: 28,
      curved: true,
    });
    expect(curved).toMatch(
      /^M 225(\.0)? 300(\.0)? Q -?\d+(\.\d+)? -?\d+(\.\d+)? 225(\.0)? 300(\.0)?$/,
    );
  });

  it('零距离箭头不产生 NaN，路径合法', () => {
    const straight = buildArrowPath({
      x1: 400,
      y1: 300,
      x2: 400,
      y2: 300,
      r1: 28,
      r2: 28,
      curved: false,
    });
    expect(straight).toBe('M 400.0 300.0 L 400.0 300.0');
    const curved = buildArrowPath({
      x1: 400,
      y1: 300,
      x2: 400,
      y2: 300,
      r1: 28,
      r2: 28,
      curved: true,
    });
    expect(curved).not.toContain('NaN');
    expect(curved).toMatch(/^M 400(\.0)? 300(\.0)? Q 400(\.0)? 300(\.0)? 400(\.0)? 300(\.0)?$/);
  });
});
