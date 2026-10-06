import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  saveAnimationScript,
  readAnimationScript,
  listAnimationScripts,
} from '@/lib/animation/script-store';
import type { AnimationScript } from '@/lib/animation/types';

const script: AnimationScript = {
  id: 'anim-test1',
  title: '堆的插入',
  topic: '二叉堆',
  subjectArea: 'data-structure',
  stage: { width: 1200, height: 675 },
  actors: [{ kind: 'node', id: 'n1', label: '4', shape: 'circle', color: '#4f8ef7', r: 28 }],
  steps: [
    { id: 's1', title: 't', narration: 'n', actorStates: [{ actorId: 'n1', x: 600, y: 300 }] },
  ],
};

describe('script store', () => {
  beforeEach(() => {
    process.env.ANIMATION_SCRIPTS_DIR = mkdtempSync(join(tmpdir(), 'anim-scripts-'));
  });

  it('保存后可读取并列出元数据', async () => {
    await saveAnimationScript(script);
    const read = await readAnimationScript('anim-test1');
    expect(read?.title).toBe('堆的插入');

    const list = await listAnimationScripts();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ scriptId: 'anim-test1', stepCount: 1 });
  });

  it('读取不存在的脚本返回 null', async () => {
    expect(await readAnimationScript('nope')).toBeNull();
  });

  it('非法 id 读取返回 null', async () => {
    expect(await readAnimationScript('../x')).toBeNull();
  });

  it('保存非法 id 脚本时重新生成合法 id 并可读回', async () => {
    const bad: AnimationScript = { ...script, id: 'bad/id' };
    const savedId = await saveAnimationScript(bad);
    expect(savedId).not.toBe('bad/id');
    expect(savedId).toMatch(/^anim-[A-Za-z0-9_-]{8}$/);

    const list = await listAnimationScripts();
    expect(list).toHaveLength(1);
    expect(list[0].scriptId).toBe(savedId);

    const read = await readAnimationScript(savedId);
    expect(read?.title).toBe('堆的插入');
  });
});
