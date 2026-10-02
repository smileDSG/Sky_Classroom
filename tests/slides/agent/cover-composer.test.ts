import { describe, it, expect } from 'vitest';
import { designPage } from '@/lib/slides/agent/page-design-agent';
import { getDefaultDesignDNA } from '@/lib/slides/agent/design-dna';

// designPage returns the deterministic cover composer for pageType==='cover'
// without invoking the LLM, so a stub model suffices.
const stubModel = {} as never;

function coverInstructions(pageNum = 1) {
  return designPage(
    pageNum,
    'cover',
    { title: '光的折射', subtitle: '高中教学课件' },
    8,
    getDefaultDesignDNA(),
    stubModel,
    '高中',
  );
}

describe('「现代学术」确定性封面版式（参照两份人工耗时确认骨架）', () => {
  it('cover 直接走确定性编排，不依赖 LLM', async () => {
    const r = await coverInstructions();
    expect(r.success).toBe(true);
    expect(r.fallback).toBeUndefined();
    expect(r.pageInstructions?.instructions.length).toBeGreaterThanOrEqual(6);
  });

  it('包含顶部英文标签与超大左对齐主标题', async () => {
    const r = await coverInstructions();
    const inst = r.pageInstructions!.instructions;
    const en = inst.find(
      (i) => i.op === 'addText' && typeof i.params.text === 'string' && i.params.text.includes('TEACHING'),
    );
    expect(en).toBeTruthy();
    const title = inst.find(
      (i) =>
        i.op === 'addText' &&
        typeof i.params.text === 'string' &&
        i.params.text === '光的折射' &&
        (i.params.bold ?? false) &&
        (i.params.fontSize ?? 0) >= 48,
    );
    expect(title).toBeTruthy();
    expect(title!.params.align ?? 'left').not.toBe('center');
  });

  it('主标题上方有金色短装饰线', async () => {
    const r = await coverInstructions();
    const inst = r.pageInstructions!.instructions;
    const overline = inst.find(
      (i) => i.op === 'addShape' && i.params.type === 'RECTANGLE' && i.params.w < 2,
    );
    expect(overline).toBeTruthy();
  });

  it('包含 3 枚"渐大方点"装饰（accent 色、递增透明度）', async () => {
    const r = await coverInstructions();
    const ovals = r.pageInstructions!.instructions.filter(
      (i) => i.op === 'addShape' && i.params.type === 'OVAL',
    );
    expect(ovals.length).toBeGreaterThanOrEqual(3);
    const transparencies = ovals.map((o) => o.params.fillTransparency ?? 0).sort();
    // 由小到大、透明度递增（30/45/60），断言单调不减
    for (let k = 1; k < transparencies.length; k++) {
      expect(transparencies[k]).toBeGreaterThanOrEqual(transparencies[k - 1]);
    }
  });

  it('底部有金色锚线 + 落款文字', async () => {
    const r = await coverInstructions();
    const inst = r.pageInstructions!.instructions;
    const hairline = inst.find(
      (i) => i.op === 'addShape' && i.params.type === 'RECTANGLE' && i.params.y > 6.5,
    );
    expect(hairline).toBeTruthy();
    const footer = inst.find((i) => i.op === 'addText' && i.params.y > 6.3);
    expect(footer).toBeTruthy();
  });
});