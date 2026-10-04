import { describe, it, expect } from 'vitest';
import { validateScript } from '@/lib/animation/validate';
import type { AnimationScript } from '@/lib/animation/types';

function makeScript(overrides: Partial<AnimationScript> = {}): AnimationScript {
  return {
    id: 's1',
    title: 't',
    topic: 'tp',
    subjectArea: 'algorithm',
    stage: { width: 1200, height: 675 },
    actors: [
      { kind: 'node', id: 'a', label: 'A', shape: 'circle', color: '#4f8ef7', r: 28 },
      { kind: 'node', id: 'b', label: 'B', shape: 'circle', color: '#4f8ef7', r: 28 },
      { kind: 'arrow', id: 'arr', fromActorId: 'a', toActorId: 'b' },
    ],
    steps: [
      {
        id: 'st1',
        title: 's1',
        narration: 'n1',
        actorStates: [
          { actorId: 'a', x: 300, y: 300 },
          { actorId: 'b', x: 800, y: 300 },
          { actorId: 'arr', x: 0, y: 0 },
        ],
      },
    ],
    ...overrides,
  };
}

/** 两个 80×40 格子，c2 位于 c2x（c1 在 300，右缘 340） */
function makeCells(c2x: number): AnimationScript {
  return makeScript({
    actors: [
      { kind: 'array-cell', id: 'c1', label: '0', w: 80, h: 40, color: '#4f8ef7' },
      { kind: 'array-cell', id: 'c2', label: '1', w: 80, h: 40, color: '#4f8ef7' },
    ],
    steps: [
      {
        id: 'st1',
        title: 's1',
        narration: 'n1',
        actorStates: [
          { actorId: 'c1', x: 300, y: 300 },
          { actorId: 'c2', x: c2x, y: 300 },
        ],
      },
    ],
  });
}

describe('validateScript', () => {
  it('合法脚本零错误', () => {
    const r = validateScript(makeScript());
    expect(r.errors).toHaveLength(0);
  });

  it('未知 actorId 报错', () => {
    const s = makeScript();
    s.steps[0].actorStates.push({ actorId: 'ghost', x: 1, y: 1 });
    const r = validateScript(s);
    expect(r.errors.some((e) => e.code === 'unknown-actor')).toBe(true);
  });

  it('箭头端点不存在报错', () => {
    const s = makeScript();
    (s.actors[2] as { fromActorId: string }).fromActorId = 'ghost';
    const r = validateScript(s);
    expect(r.errors.some((e) => e.code === 'arrow-endpoint-missing')).toBe(true);
  });

  it('坐标越界报错', () => {
    const s = makeScript();
    s.steps[0].actorStates[0] = { actorId: 'a', x: 5000, y: 300 };
    const r = validateScript(s);
    expect(r.errors.some((e) => e.code === 'out-of-bounds')).toBe(true);
  });

  it('相邻步位移过大产生 warning', () => {
    const s = makeScript({
      steps: [
        {
          id: 'st1',
          title: 's1',
          narration: 'n1',
          actorStates: [{ actorId: 'a', x: 100, y: 100 }],
        },
        {
          id: 'st2',
          title: 's2',
          narration: 'n2',
          actorStates: [{ actorId: 'a', x: 1100, y: 600 }],
        },
      ],
    });
    const r = validateScript(s);
    expect(r.warnings.some((w) => w.code === 'large-displacement')).toBe(true);
  });

  it('高亮/指针目标不存在报错', () => {
    const s = makeScript();
    s.actors.push({ kind: 'highlight', id: 'h', targetActorId: 'ghost', color: '#f76e4f' });
    const r = validateScript(s);
    expect(r.errors.some((e) => e.code === 'target-missing')).toBe(true);
  });

  it('重复演员 id 报错', () => {
    const s = makeScript();
    s.actors.push({ kind: 'node', id: 'a', label: 'A2', shape: 'circle', color: '#4f8ef7', r: 28 });
    const r = validateScript(s);
    expect(r.errors.some((e) => e.code === 'duplicate-actor-id' && e.actorId === 'a')).toBe(true);
  });

  it('步内重复 actorId 状态报错', () => {
    const s = makeScript();
    s.steps[0].actorStates.push({ actorId: 'a', x: 400, y: 300 });
    const r = validateScript(s);
    const dup = r.errors.find((e) => e.code === 'duplicate-state');
    expect(dup).toBeDefined();
    expect(dup?.actorId).toBe('a');
    expect(dup?.stepId).toBe('st1');
    expect(dup?.message).toContain('仅保留第一个');
  });

  it('箭头端点为不可定位演员报错', () => {
    const s = makeScript();
    s.actors.push({ kind: 'arrow', id: 'arr2', fromActorId: 'a', toActorId: 'arr' });
    const r = validateScript(s);
    expect(
      r.errors.some(
        (e) =>
          e.code === 'arrow-endpoint-missing' &&
          e.actorId === 'arr2' &&
          e.message.includes('arrow'),
      ),
    ).toBe(true);
  });

  it('指针目标为不可定位演员报错', () => {
    const s = makeScript();
    s.actors.push({ kind: 'pointer', id: 'p', label: 'P', targetActorId: 'arr' });
    const r = validateScript(s);
    expect(
      r.errors.some(
        (e) => e.code === 'target-missing' && e.actorId === 'p' && e.message.includes('arrow'),
      ),
    ).toBe(true);
  });

  it('格子重叠产生 warning', () => {
    const r = validateScript(makeCells(300));
    const w = r.warnings.find((x) => x.code === 'cell-overlap');
    expect(w).toBeDefined();
    expect(w?.message).toContain('c1');
    expect(w?.message).toContain('c2');
    expect(w?.stepId).toBe('st1');
  });

  it('格子恰好相接不产生 warning', () => {
    const r = validateScript(makeCells(380));
    expect(r.warnings.some((x) => x.code === 'cell-overlap')).toBe(false);
  });

  it('坐标恰好在舞台边界不报越界', () => {
    const s = makeScript();
    s.steps[0].actorStates[0] = { actorId: 'a', x: 1200, y: 675 };
    const r = validateScript(s);
    expect(r.errors.some((e) => e.code === 'out-of-bounds')).toBe(false);
  });
});
