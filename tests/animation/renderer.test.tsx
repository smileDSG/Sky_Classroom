import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AnimationCanvas } from '@/components/animation/renderer/animation-canvas';
import type { AnimationScript } from '@/lib/animation/types';

const script: AnimationScript = {
  id: 's',
  title: 't',
  topic: 'tp',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675, showGrid: true },
  actors: [
    { kind: 'node', id: 'n1', label: '4', shape: 'circle', color: '#4f8ef7', r: 28 },
    { kind: 'array-cell', id: 'c1', label: '7', w: 90, h: 60, color: '#4f8ef7' },
    { kind: 'arrow', id: 'a1', fromActorId: 'n1', toActorId: 'c1' },
    { kind: 'pointer', id: 'p1', label: 'i', targetActorId: 'c1' },
    { kind: 'text', id: 't1', content: '标题', size: 24, color: '#333333' },
    { kind: 'highlight', id: 'h1', targetActorId: 'n1', color: '#f76e4f' },
    { kind: 'bar', id: 'b1', label: '3', w: 60, color: '#4f8ef7' },
    { kind: 'axes', id: 'ax1', xmin: 0, xmax: 10, ymin: 0, ymax: 10 },
  ],
  steps: [
    {
      id: 's1',
      title: '第1步',
      narration: 'n',
      actorStates: [
        { actorId: 'n1', x: 300, y: 200 },
        { actorId: 'c1', x: 300, y: 500 },
        { actorId: 'a1', x: 0, y: 0 },
        { actorId: 'p1', x: 0, y: 0 },
        { actorId: 't1', x: 600, y: 60 },
        { actorId: 'h1', x: 0, y: 0 },
        { actorId: 'b1', x: 800, y: 500 },
        { actorId: 'ax1', x: 600, y: 337 },
      ],
    },
  ],
};

/** 两步脚本：n1 仅在第 1 步可见，第 2 步退场（n2 接管可见列表） */
const exitScript: AnimationScript = {
  id: 's-exit',
  title: 't',
  topic: 'tp',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675 },
  actors: [
    { kind: 'node', id: 'n1', label: 'A', shape: 'circle', color: '#4f8ef7', r: 28 },
    { kind: 'node', id: 'n2', label: 'B', shape: 'circle', color: '#f76e4f', r: 28 },
  ],
  steps: [
    { id: 'p1', title: '一', narration: 'n1', actorStates: [{ actorId: 'n1', x: 300, y: 200 }] },
    { id: 'p2', title: '二', narration: 'n2', actorStates: [{ actorId: 'n2', x: 600, y: 200 }] },
  ],
};

/** 箭头端点演员不在当步 actorStates 中 */
const danglingArrowScript: AnimationScript = {
  id: 's-arrow',
  title: 't',
  topic: 'tp',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675 },
  actors: [{ kind: 'arrow', id: 'a2', fromActorId: 'ghost1', toActorId: 'ghost2' }],
  steps: [{ id: 'p1', title: '一', narration: 'n', actorStates: [{ actorId: 'a2', x: 0, y: 0 }] }],
};

describe('AnimationCanvas', () => {
  it('渲染 SVG 且每种演员都出现', () => {
    const { container } = render(<AnimationCanvas script={script} stepIndex={0} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 1200 675');
    for (const id of ['n1', 'c1', 'a1', 'p1', 't1', 'h1', 'b1', 'ax1']) {
      expect(container.querySelector(`[data-actor-id="${id}"]`)).not.toBeNull();
    }
  });

  it('渲染演员标签文本', () => {
    const { container } = render(<AnimationCanvas script={script} stepIndex={0} />);
    expect(container.textContent).toContain('4');
    expect(container.textContent).toContain('7');
    expect(container.textContent).toContain('i');
  });

  it('上一步可见、本步不可见的演员进入退场渲染路径', () => {
    const { container, rerender } = render(<AnimationCanvas script={exitScript} stepIndex={0} />);
    expect(container.querySelector('[data-actor-id="n1"]')).not.toBeNull();
    expect(container.querySelector('[data-actor-id="n2"]')).toBeNull();
    rerender(<AnimationCanvas script={exitScript} stepIndex={1} />);
    // 第 2 步可见列表只有 n2；此时 DOM 中仍存在且仅存在一个 n1 元素，
    // 它只能来自退场分支（exit- 前缀仅是 React key，不会出现在 data-actor-id 上）
    expect(container.querySelector('[data-actor-id="n2"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-actor-id="n1"]')).toHaveLength(1);
  });

  it('showGrid=false 时不渲染网格线（showGrid=true 时渲染）', () => {
    const grid = render(<AnimationCanvas script={script} stepIndex={0} />);
    expect(grid.container.querySelectorAll('line.stroke-neutral-200').length).toBeGreaterThan(0);
    const noGrid = render(
      <AnimationCanvas
        script={{ ...script, stage: { ...script.stage, showGrid: false } }}
        stepIndex={0}
      />,
    );
    expect(noGrid.container.querySelectorAll('line.stroke-neutral-200')).toHaveLength(0);
  });

  it('defs 中包含 anim-arrowhead marker', () => {
    const { container } = render(<AnimationCanvas script={script} stepIndex={0} />);
    expect(container.querySelector('marker#anim-arrowhead')).not.toBeNull();
  });

  it('端点演员缺席的箭头不渲染任何元素', () => {
    const { container } = render(<AnimationCanvas script={danglingArrowScript} stepIndex={0} />);
    expect(container.querySelector('[data-actor-id="a2"]')).toBeNull();
  });
});
