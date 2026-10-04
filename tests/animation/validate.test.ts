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
});
