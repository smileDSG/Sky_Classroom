import type { AnimationScript } from '@/lib/animation/types';

/** 动画讲解 e2e 用最小分镜脚本：3 步，数组格 + 箭头 + 指针 */
export const mockAnimationScript: AnimationScript = {
  id: 'e2e-anim-1',
  title: '冒烟：数组反转',
  topic: '数组反转',
  subjectArea: 'algorithm',
  stage: { width: 1200, height: 675, showGrid: true },
  actors: [
    { kind: 'array-cell', id: 'cell-0', label: '1', w: 90, h: 60, color: '#4f8ef7' },
    { kind: 'array-cell', id: 'cell-1', label: '2', w: 90, h: 60, color: '#4f8ef7' },
    { kind: 'array-cell', id: 'cell-2', label: '3', w: 90, h: 60, color: '#4f8ef7' },
    { kind: 'pointer', id: 'ptr-l', label: 'L', targetActorId: 'cell-0' },
    { kind: 'pointer', id: 'ptr-r', label: 'R', targetActorId: 'cell-2' },
    { kind: 'arrow', id: 'arrow-1', fromActorId: 'cell-0', toActorId: 'cell-2' },
  ],
  steps: [
    {
      id: 'step-1',
      title: '初始数组',
      narration: '数组一、二、三，左指针指向第一个元素，右指针指向最后一个元素。',
      actorStates: [
        { actorId: 'cell-0', x: 450, y: 337 },
        { actorId: 'cell-1', x: 600, y: 337 },
        { actorId: 'cell-2', x: 750, y: 337 },
        { actorId: 'ptr-l', x: 0, y: 0 },
        { actorId: 'ptr-r', x: 0, y: 0 },
        { actorId: 'arrow-1', x: 0, y: 0 },
      ],
    },
    {
      id: 'step-2',
      title: '交换首尾',
      narration: '交换一和三，首尾两个元素完成反转。',
      actorStates: [
        { actorId: 'cell-0', x: 450, y: 337, labelOverride: '3', colorOverride: '#f76e4f' },
        { actorId: 'cell-1', x: 600, y: 337 },
        { actorId: 'cell-2', x: 750, y: 337, labelOverride: '1' },
        { actorId: 'ptr-l', x: 0, y: 0 },
        { actorId: 'ptr-r', x: 0, y: 0 },
        { actorId: 'arrow-1', x: 0, y: 0 },
      ],
    },
    {
      id: 'step-3',
      title: '完成',
      narration: '数组反转完成，所有元素逆序排列。',
      actorStates: [
        { actorId: 'cell-0', x: 450, y: 337, labelOverride: '3' },
        { actorId: 'cell-1', x: 600, y: 337, labelOverride: '2' },
        { actorId: 'cell-2', x: 750, y: 337, labelOverride: '1' },
        { actorId: 'ptr-l', x: 0, y: 0 },
        { actorId: 'ptr-r', x: 0, y: 0 },
      ],
    },
  ],
};

export const mockAnimationScriptMeta = {
  scriptId: mockAnimationScript.id,
  title: mockAnimationScript.title,
  topic: mockAnimationScript.topic,
  subjectArea: mockAnimationScript.subjectArea,
  stepCount: mockAnimationScript.steps.length,
  createdAt: new Date().toISOString(),
};
