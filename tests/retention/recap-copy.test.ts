/**
 * 语气红线测试（T06）。
 *
 * 重点是**反向用例**：先证明门禁真的会拦，再证明正常话术能过。
 * 只测"全绿"等于没测——门禁功能障碍和门禁不存在长得一模一样。
 */

import { describe, it, expect } from 'vitest';
import {
  RECAP_FORBIDDEN_PATTERNS,
  RECAP_MAX_HAN,
  RECAP_POINT_MAX_HAN,
  RECONSOLIDATE_THRESHOLD,
  assertRedline,
  isRedlineFree,
  countHan,
  clampToHan,
} from '@/lib/retention/recap-copy';

describe('红线表本身', () => {
  it('八条规则齐全（R-A ~ R-H）', () => {
    expect(RECAP_FORBIDDEN_PATTERNS.map((r) => r.rule)).toEqual([
      'R-A',
      'R-B',
      'R-C',
      'R-D',
      'R-E',
      'R-F',
      'R-G',
      'R-H',
    ]);
  });

  it('每条规则都有人话标签（报错给人看，不是给机器看）', () => {
    for (const r of RECAP_FORBIDDEN_PATTERNS) {
      expect(r.label).toBeTruthy();
    }
  });

  it('关键常量取值正确', () => {
    expect(RECAP_MAX_HAN).toBe(24);
    expect(RECONSOLIDATE_THRESHOLD).toBe(80);
  });
});

describe('反向用例 · 门禁必须拦得住', () => {
  const bad: [string, string, string[]][] = [
    ['欢迎回来！', 'R-D 客人式招呼 + R-E 感叹号', ['R-D', 'R-E']],
    ['快回来刷题！', 'R-A 催促 + R-E 感叹号', ['R-A', 'R-E']],
    ['你已经 9 天没学了，快点回来补。', 'R-A 催促 + R-B 负罪感', ['R-A', 'R-B']],
    ['别再断啦，不然之前的努力都白费。', 'R-A 别再 + R-B 白费', ['R-A', 'R-B']],
    ['今天之内必须把这道题做完哦', 'R-C 时间压力', ['R-C']],
    ['你真是太厉害了，连续 2 天！', 'R-E 夸赞 + 感叹号', ['R-E']],
    ['我发现你又卡住了，猜你是没听懂', 'R-F 我盯着你', ['R-F']],
    ['解锁连续打卡徽章！', 'R-G 奖励钩子', ['R-G']],
    ['前 3 天之内要补上，最后机会了', 'R-C 时间压力', ['R-C']],
  ];

  for (const [text, why, want] of bad) {
    it(`拦住「${text}」（${why}）`, () => {
      const hits = assertRedline(text);
      for (const rule of want) expect(hits).toContain(rule);
    });
  }

  it('超长句被 R-H 拦住（25 个汉字即不合格）', () => {
    expect(assertRedline('测'.repeat(25))).toContain('R-H');
    expect(assertRedline('测'.repeat(24))).not.toContain('R-H');
  });

  it('assertRedline 返回规则数组而非布尔', () => {
    const r = assertRedline('欢迎回来！');
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });

  it('干净的话术 isRedlineFree 为真', () => {
    expect(isRedlineFree('今天先做一道题，连续学习就从这开始。')).toBe(true);
  });
});

describe('汉字计数与截断', () => {
  it('countHan 只数汉字', () => {
    expect(countHan('昨天你补上了')).toBe(6);
    // 「3」「→」都不算汉字
    expect(countHan('复习这 3 道 →')).toBe(4);
    expect(countHan('')).toBe(0);
  });

  it('clampToHan 超出才截断并补省略号', () => {
    expect(clampToHan('对称轴', 8)).toBe('对称轴');
    expect(clampToHan('二次函数对称轴与顶点式的辨析', 8)).toBe('二次函数对称轴与…');
    expect(countHan(clampToHan('二次函数对称轴与顶点式的辨析', 8))).toBe(8);
  });
});

describe('R-H 不计变量占位（PRD §6.3 明确口径）', () => {
  it('变量名再长也不算话术骨架超长，但变量本身另有 8 字约束', () => {
    // 骨架 19 汉字 + 14 字的知识点名 → 整句 33 汉字，R-H 只看骨架
    const line = '上次学到『二次函数对称轴与顶点式的辨析』，就到这儿。今天想接着来，点一下就行。';
    expect(isRedlineFree(line)).toBe(true);
    // 变量长度由 RECAP_POINT_MAX_HAN 单独兜底（话术里的 『X』 截断到 8 字）
    expect(clampToHan('二次函数对称轴与顶点式的辨析', RECAP_POINT_MAX_HAN)).toBe('二次函数对称轴与…');
  });
});
