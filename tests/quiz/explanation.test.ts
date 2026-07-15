import { describe, expect, it } from 'vitest';
import { QUIZ_EXPLANATION_MAX_CHARS, sanitizeQuizExplanation } from '@/lib/quiz/explanation';

describe('sanitizeQuizExplanation', () => {
  it('keeps a concise explanation unchanged', () => {
    const explanation = '由顶点式可得对称轴，再代入已知点求参数，所以选择正确项。';

    expect(sanitizeQuizExplanation(explanation)).toBe(explanation);
  });

  it('cuts off self-correction rambling after a useful prefix', () => {
    const explanation =
      '解析思路：先根据顶点在 $y=x$ 上确定顶点坐标，再代入过点条件求得 $a=\\frac{4}{9}$。重新计算：可能我刚才理解错了，检查选项发现不对，另一种思路是继续试。';

    const result = sanitizeQuizExplanation(explanation);

    expect(result).toBe('先根据顶点在 $y=x$ 上确定顶点坐标，再代入过点条件求得 $a=\\frac{4}{9}$');
    expect(result).not.toContain('重新计算');
    expect(result).not.toContain('可能');
  });

  it('uses a safe fallback for contradictory explanations', () => {
    const explanation = '与选项不符。重新计算：可能题目有误，选项没有正确答案。';

    const result = sanitizeQuizExplanation(explanation);

    expect(result).toContain('正确答案见上方标记');
    expect(result).not.toContain('选项没有');
  });

  it('trims overlong explanations to a readable length', () => {
    const explanation =
      '第一步，根据题干条件列出等量关系，并把未知量统一到同一个表达式中。第二步，代入已知点或已知数值完成求解。第三步，回到选项中核对结果是否一致。第四步，排除只满足部分条件的干扰项。第五步，整理结论并确认答案。第六步，继续补充大量重复说明来模拟模型输出的冗长解析。第七步，再次展开与订正无关的铺垫内容。第八步，把同一个结论换一种说法再讲一遍。第九步，继续描述检查过程但不提供新的有效信息。';

    const result = sanitizeQuizExplanation(explanation);

    expect(result.length).toBeLessThanOrEqual(QUIZ_EXPLANATION_MAX_CHARS);
    expect(result.length).toBeLessThan(explanation.length);
  });
});
