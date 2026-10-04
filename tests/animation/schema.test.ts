import { describe, it, expect } from 'vitest';
import { scriptSchema, autoFixScript } from '@/lib/animation/schema';

const validScript = {
  id: 's1',
  title: '二叉堆的插入与上浮',
  topic: '二叉堆',
  subjectArea: 'data-structure',
  stage: { width: 1200, height: 675 },
  actors: [
    { kind: 'node', id: 'a1', label: '4', shape: 'circle', color: '#4f8ef7', r: 28 },
    { kind: 'array-cell', id: 'c1', label: '4', w: 90, h: 60, color: '#4f8ef7' },
    { kind: 'arrow', id: 'arr1', fromActorId: 'a1', toActorId: 'c1' },
    { kind: 'pointer', id: 'p1', label: 'i', targetActorId: 'c1' },
    { kind: 'text', id: 't1', content: '初始状态', size: 24, color: '#333333' },
    { kind: 'highlight', id: 'h1', targetActorId: 'a1', color: '#f76e4f' },
    { kind: 'bar', id: 'b1', label: '3', w: 60, color: '#4f8ef7' },
    { kind: 'axes', id: 'ax1', xmin: 0, xmax: 10, ymin: 0, ymax: 10 },
  ],
  steps: [
    {
      id: 'st1',
      title: '初始状态',
      narration: '数组 [4, 7, 2] 已经是一个完全二叉树。',
      actorStates: [{ actorId: 'a1', x: 600, y: 200 }],
    },
  ],
};

describe('scriptSchema', () => {
  it('接受合法脚本', () => {
    expect(scriptSchema.safeParse(validScript).success).toBe(true);
  });

  it('拒绝未知演员 kind', () => {
    const bad = { ...validScript, actors: [{ kind: 'dragon', id: 'x' }] };
    expect(scriptSchema.safeParse(bad).success).toBe(false);
  });

  it('拒绝空 steps', () => {
    const bad = { ...validScript, steps: [] };
    expect(scriptSchema.safeParse(bad).success).toBe(false);
  });
});

describe('autoFixScript', () => {
  it('剔除指向未知演员的状态并 clamp 越界坐标', () => {
    const dirty = {
      ...validScript,
      steps: [
        {
          id: 'st1',
          title: 't',
          narration: 'n',
          actorStates: [
            { actorId: 'a1', x: 5000, y: -100 }, // 越界
            { actorId: 'ghost', x: 10, y: 10 }, // 未知演员
          ],
        },
      ],
    };
    const { script, fixes } = autoFixScript(dirty);
    expect(fixes.length).toBeGreaterThan(0);
    const st = script.steps[0].actorStates;
    expect(st.find((s) => s.actorId === 'ghost')).toBeUndefined();
    expect(st.find((s) => s.actorId === 'a1')!.x).toBeLessThanOrEqual(script.stage.width);
    expect(scriptSchema.safeParse(script).success).toBe(true);
  });

  it('截断超长 narration', () => {
    const dirty = {
      ...validScript,
      steps: [{ ...validScript.steps[0], narration: '长'.repeat(600) }],
    };
    const { script } = autoFixScript(dirty);
    expect(script.steps[0].narration.length).toBeLessThanOrEqual(500);
  });
});
