'use client';

import { MathRenderer } from '@/components/sky/solve/math-renderer';

const demoTexts = [
  {
    title: '📐 定积分与不定积分',
    text: '计算定积分：$$\\int_{0}^{\\pi} \\sin x \\, dx = [-\\cos x]_{0}^{\\pi} = -\\cos\\pi - (-\\cos 0) = 2$$\n\n牛顿-莱布尼茨公式：$$\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)$$\n\n不定积分示例：$$\\int x^2 \\, dx = \\frac{x^3}{3} + C$$\n\n分部积分公式：$$\\int u \\, dv = uv - \\int v \\, du$$\n\n广义积分：$$\\int_{-\\infty}^{+\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}$$',
  },
  {
    title: '📊 级数与求和',
    text: '等比级数：$$\\sum_{n=0}^{\\infty} ar^n = \\frac{a}{1-r} \\quad (|r| < 1)$$\n\n泰勒级数：$$e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}$$\n\n几何级数：$$\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}$$\n\n无穷乘积：$$\\prod_{n=1}^{\\infty} \\left(1 + \\frac{1}{n^2}\\right) = \\frac{\\sinh \\pi}{\\pi}$$',
  },
  {
    title: '🔵 圆锥曲线',
    text: '圆：$$(x - a)^2 + (y - b)^2 = r^2$$\n\n椭圆：$$\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1 \\quad (a > b > 0)$$\n\n双曲线：$$\\frac{x^2}{a^2} - \\frac{y^2}{b^2} = 1$$\n\n抛物线：$$y^2 = 2px \\quad (p > 0)$$\n\n离心率：$$e = \\frac{c}{a} = \\sqrt{1 - \\frac{b^2}{a^2}}$$\n\n渐近线：$$y = \\pm \\frac{b}{a} x$$\n\n焦点向量：$$|\\overrightarrow{FP}| = \\frac{p}{2}$$',
  },
  {
    title: '🔢 向量与矩阵',
    text: '叉积：$$\\vec{a} \\times \\vec{b} = |\\vec{a}||\\vec{b}|\\sin\\theta \\, \\hat{n}$$\n\n点积：$$\\vec{a} \\cdot \\vec{b} = a_1b_1 + a_2b_2 + a_3b_3$$\n\n行列式：$$\\begin{vmatrix} a_{11} & a_{12} \\\\ a_{21} & a_{22} \\end{vmatrix} = a_{11}a_{22} - a_{12}a_{21}$$',
  },
  {
    title: '📏 极限与导数',
    text: "极限：$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$\n\n导数：$$f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$\n\n链式法则：$$\\frac{d}{dx}[f(g(x))] = f'(g(x)) \\cdot g'(x)$$\n\n偏导数：$$\\frac{\\partial f}{\\partial x} = \\lim_{h \\to 0} \\frac{f(x+h, y) - f(x, y)}{h}$$",
  },
  {
    title: '📝 行内公式（已处理后）',
    text: "弹簧振子做简谐振动时，总能量 $E = \\frac{1}{2}kA^2$，其中 k 为劲度系数，A 为振幅。当振幅变为两倍时 $A' = 2A$，则 $E' = \\frac{1}{4} \\cdot \\frac{1}{2}kA^2 = \\frac{1}{4}E$。总能量变为原来的 4 倍。",
  },
  {
    title: '📝 裸公式（LLM 原始输出）',
    text: "将振幅减小为原来的一半 A'=A/2 代入公式，计算新能量 E'=1/4·1/2kA²=1/4E。因此总能量变为原来的1/4。",
  },
];

export default function MathDemoPage() {
  return (
    <div className="bg-gray-50 dark:bg-gray-900 p-4">
      <h1 className="text-xl font-bold mb-3">MathRenderer 效果演示</h1>

      {/* 分类卡片 - 2列网格布局，紧凑间距 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-5xl">
        {demoTexts.map((demo, i) => (
          <div key={i} className="rounded-lg border bg-white dark:bg-gray-800 p-3 shadow-sm">
            <h2 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
              {demo.title}
            </h2>
            <div className="text-sm leading-snug text-gray-800 dark:text-gray-100">
              <MathRenderer content={demo.text} />
            </div>
          </div>
        ))}
      </div>

      {/* 分步展示 - 紧凑行内布局 */}
      <div className="rounded-lg border bg-white dark:bg-gray-800 p-3 shadow-sm mt-3 max-w-5xl">
        <h2 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
          分步解题效果
        </h2>
        <div className="space-y-1.5">
          {[
            { label: '步骤1：确定公式', content: '总能量公式为 $E = \\frac{1}{2}kA^2$' },
            { label: '步骤2：振幅减半', content: "$A' = \\frac{A}{2}$" },
            {
              label: '步骤3：代入计算',
              content: "$E' = \\frac{1}{2}k\\left(\\frac{A}{2}\\right)^2 = \\frac{1}{4}E$",
            },
            { label: '步骤4：结论', content: '总能量变为原来的 $\\frac{1}{4}$' },
          ].map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2 py-1 rounded bg-gray-50 dark:bg-gray-700/50"
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                {i + 1}
              </div>
              <span className="text-xs font-medium text-gray-500 shrink-0">{step.label}</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                <MathRenderer content={step.content} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
