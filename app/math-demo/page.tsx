'use client';

import { MathRenderer } from '@/components/sky/solve/math-renderer';

const demoTexts = [
  {
    title: '后端后处理后的文本（模拟 LLM 未包裹 LaTeX 的情况）',
    text: "弹簧振子做简谐振动时，总能量$E = \\frac{1}{2}kA^2$，其中 k 为弹簧劲度系数，A 为振幅。当振幅变为原来的两倍时，$A' = 2A$，则$E' = \\frac{1}{4} \\cdot \\frac{1}{2}kA^2 = \\frac{1}{4}E$。因此总能量变为原来的 4 倍。",
  },
  {
    title: '未经处理的原始文本（模拟 LLM 裸输出）',
    text: "将振幅减小为原来的一半 A'=A/2 代入公式，计算新能量 E'=1/4·1/2kA²=1/4E。因此总能量变为原来的1/4。",
  },
];

export default function MathDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <h1 className="text-2xl font-bold mb-6">MathRenderer 效果演示</h1>

      <div className="space-y-8 max-w-4xl">
        {demoTexts.map((demo, i) => (
          <div key={i} className="rounded-xl border bg-white dark:bg-gray-800 p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">{demo.title}</h2>
            <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-100">
              <MathRenderer content={demo.text} />
            </div>
          </div>
        ))}

        {/* 分步展示 */}
        <div className="rounded-xl border bg-white dark:bg-gray-800 p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-gray-200">分步解题效果</h2>
          <div className="space-y-4">
            {[
              { label: '步骤1：确定公式', content: '总能量公式为$E = \\frac{1}{2}kA^2$' },
              { label: '步骤2：将振幅减小为原来的一半', content: "$A' = \\frac{A}{2}$" },
              { label: '步骤3：代入公式计算', content: "$E' = \\frac{1}{2}k\\left(\\frac{A}{2}\\right)^2 = \\frac{1}{4} \\cdot \\frac{1}{2}kA^2 = \\frac{1}{4}E$" },
              { label: '步骤4：结论', content: '总能量变为原来的$\\frac{1}{4}$' },
            ].map((step, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg border">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-xs font-bold text-blue-600 dark:text-blue-400">
                  {i + 1}
                </div>
                <div>
                  <div className="font-medium text-sm mb-1">{step.label}</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300">
                    <MathRenderer content={step.content} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
