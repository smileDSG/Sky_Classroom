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
});
