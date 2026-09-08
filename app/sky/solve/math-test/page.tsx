'use client';

import { useState } from 'react';
import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { SolutionPanel } from '@/components/sky/solve/solution-panel';
import { MathRenderer } from '@/components/sky/solve/math-renderer';
import { postProcessMathContent } from '@/lib/solve/math-postprocessor';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { FourPartOutput } from '@/lib/solve/types';

// ── 预置测试数据 ──────────────────────────────────────────────────
// 每个学科故意混合：已有$包裹、裸LaTeX、Unicode符号、裸分数、多行对齐

const TEST_DATA: Record<
  string,
  { title: string; problems: { name: string; output: FourPartOutput }[] }
> = {
  math: {
    title: '数学',
    problems: [
      {
        name: '三角函数求值',
        output: {
          solution:
            '已知 $\\sin\\alpha = \\frac{3}{5}$，$\\alpha \\in (0, \\frac{\\pi}{2})$。\n\n' +
            '由 $\\sin^2\\alpha + \\cos^2\\alpha = 1$ 得：\n' +
            '$$\\cos\\alpha = \\sqrt{1 - \\sin^2\\alpha} = \\sqrt{1 - \\frac{9}{25}} = \\sqrt{\\frac{16}{25}} = \\frac{4}{5}$$\n\n' +
            '所以 $\\tan\\alpha = \\frac{\\sin\\alpha}{\\cos\\alpha} = \\frac{3/5}{4/5} = \\frac{3}{4}$\n\n' +
            '计算 $\\sin 2\\alpha = 2\\sin\\alpha\\cos\\alpha = 2 \\times \\frac{3}{5} \\times \\frac{4}{5} = \\frac{24}{25}$',
          answer: '$\\frac{24}{25}$',
          steps: [
            {
              label: '求 cosα',
              content:
                '由 $\\sin^2\\alpha + \\cos^2\\alpha = 1$ 求得 $\\cos\\alpha = \\frac{4}{5}$',
            },
            {
              label: '求 tanα',
              content: '$\\tan\\alpha = \\frac{\\sin\\alpha}{\\cos\\alpha} = \\frac{3}{4}$',
            },
            {
              label: '求 sin2α',
              content: '$\\sin 2\\alpha = 2\\sin\\alpha\\cos\\alpha = \\frac{24}{25}$',
            },
          ],
          knowledgePoints: [
            {
              name: '同角三角函数关系',
              description:
                'sin²α + cos²α = 1，tanα = sinα/cosα。常用于已知一个三角函数值求其他值。注意符号判断需结合象限。',
              difficulty: 'easy',
            },
            {
              name: '二倍角公式',
              description:
                'sin2α = 2sinαcosα，cos2α = cos²α - sin²α。用于将单角转化为倍角计算。注意不要和半角公式混淆。',
              difficulty: 'medium',
            },
          ],
          similarQuestions: [
            {
              problem:
                '已知 $\\cos\\alpha = -\\frac{5}{13}$，$\\alpha \\in (\\pi, \\frac{3\\pi}{2})$，求 $\\sin 2\\alpha$',
              difficulty: 4,
              knowledgePoint: '二倍角公式',
            },
          ],
        },
      },
      {
        name: '导数与极值',
        output: {
          solution:
            '设 $f(x) = x^3 - 3x^2 + 2$，求其极值。\n\n' +
            '第一步：求导\n' +
            "$f'(x) = 3x^2 - 6x = 3x(x - 2)$\n\n" +
            "第二步：令 $f'(x) = 0$，得 $x = 0$ 或 $x = 2$\n\n" +
            '第三步：判断极值\n' +
            "$f''(x) = 6x - 6$\n\n" +
            "当 $x = 0$ 时，$f''(0) = -6 < 0$，所以 $x = 0$ 是极大值点，极大值 $f(0) = 2$\n" +
            "当 $x = 2$ 时，$f''(2) = 6 > 0$，所以 $x = 2$ 是极小值点，极小值 $f(2) = 4 - 12 + 2 = -6$",
          answer: '极大值 $f(0) = 2$，极小值 $f(2) = -6$',
          steps: [
            { label: '求导', content: "$f'(x) = 3x^2 - 6x = 3x(x-2)$" },
            { label: '求驻点', content: "令 $f'(x) = 0$，得 $x = 0$ 或 $x = 2$" },
            { label: '二阶导判别', content: "$f''(0) = -6 < 0$（极大），$f''(2) = 6 > 0$（极小）" },
          ],
          knowledgePoints: [
            {
              name: '极值判定（二阶导法）',
              description:
                "f'(x₀)=0 且 f''(x₀)<0 → 极大值；f''(x₀)>0 → 极小值。注意 f''(x₀)=0 时需用其他方法判断。",
              difficulty: 'medium',
            },
          ],
          similarQuestions: [
            {
              problem: '求 $f(x) = x^3 - 6x^2 + 9x + 1$ 的极值',
              difficulty: 5,
              knowledgePoint: '极值判定',
            },
          ],
        },
      },
      {
        name: '圆锥曲线（椭圆）',
        output: {
          solution:
            '椭圆方程 $\\frac{x^2}{a^2} + \\frac{y^2}{b^2} = 1$（$a > b > 0$），其中 $a = 5$，$b = 3$。\n\n' +
            '焦距：$c = \\sqrt{a^2 - b^2} = \\sqrt{25 - 9} = 4$\n\n' +
            '离心率：$e = \\frac{c}{a} = \\frac{4}{5}$\n\n' +
            '焦点坐标：$F_1(-4, 0)$，$F_2(4, 0)$\n\n' +
            '准线方程：$x = \\pm \\frac{a^2}{c} = \\pm \\frac{25}{4}$\n\n' +
            '焦点到准线距离：$\\frac{a^2}{c} - c = \\frac{b^2}{c} = \\frac{9}{4}$',
          answer: '$e = \\frac{4}{5}$',
          steps: [
            { label: '求焦距', content: '$c = \\sqrt{a^2 - b^2} = \\sqrt{25 - 9} = 4$' },
            { label: '求离心率', content: '$e = \\frac{c}{a} = \\frac{4}{5}$' },
            { label: '求准线', content: '$x = \\pm \\frac{a^2}{c} = \\pm \\frac{25}{4}$' },
          ],
          knowledgePoints: [
            {
              name: '椭圆基本性质',
              description:
                '标准方程 x²/a² + y²/b² = 1，c² = a² - b²，e = c/a ∈ (0,1)。焦点在长轴上，准线垂直于长轴。',
              difficulty: 'medium',
            },
          ],
          similarQuestions: [
            {
              problem: '椭圆 $\\frac{x^2}{16} + \\frac{y^2}{9} = 1$ 的离心率',
              difficulty: 3,
              knowledgePoint: '椭圆基本性质',
            },
          ],
        },
      },
    ],
  },

  // ── 高数专题（追加到数学学科末尾） ──
  // 注意：这些题目放在独立的 "advanced" key 中，通过下方逻辑合并到 math.problems

  advanced: {
    title: '高等数学',
    problems: [
      {
        name: '多元函数偏导与全微分',
        output: {
          solution:
            '设 $z = x^3 y + \\sin(xy^2)$，求 $\\frac{\\partial z}{\\partial x}$、$\\frac{\\partial z}{\\partial y}$ 和全微分 $dz$。\n\n' +
            '对 $x$ 求偏导（$y$ 视为常数）：\n' +
            '$$\\frac{\\partial z}{\\partial x} = 3x^2 y + \\cos(xy^2) \\cdot y^2 = 3x^2 y + y^2 \\cos(xy^2)$$\n\n' +
            '对 $y$ 求偏导（$x$ 视为常数）：\n' +
            '$$\\frac{\\partial z}{\\partial y} = x^3 + \\cos(xy^2) \\cdot 2xy = x^3 + 2xy\\cos(xy^2)$$\n\n' +
            '全微分：\n' +
            '$$dz = \\frac{\\partial z}{\\partial x}dx + \\frac{\\partial z}{\\partial y}dy$$\n' +
            '$$= \\left(3x^2 y + y^2 \\cos(xy^2)\\right)dx + \\left(x^3 + 2xy\\cos(xy^2)\\right)dy$$\n\n' +
            '二阶偏导数：\n' +
            '$$\\frac{\\partial^2 z}{\\partial x^2} = 6xy - y^4 \\sin(xy^2)$$\n' +
            '$$\\frac{\\partial^2 z}{\\partial x \\partial y} = 3x^2 + 2y\\cos(xy^2) - 2xy^3\\sin(xy^2)$$',
          answer: '$dz = (3x^2 y + y^2 \\cos(xy^2))dx + (x^3 + 2xy\\cos(xy^2))dy$',
          steps: [
            {
              label: '求 ∂z/∂x',
              content: '$\\frac{\\partial z}{\\partial x} = 3x^2 y + y^2 \\cos(xy^2)$',
            },
            {
              label: '求 ∂z/∂y',
              content: '$\\frac{\\partial z}{\\partial y} = x^3 + 2xy\\cos(xy^2)$',
            },
            {
              label: '写全微分',
              content:
                '$dz = \\frac{\\partial z}{\\partial x}dx + \\frac{\\partial z}{\\partial y}dy$',
            },
          ],
          knowledgePoints: [
            {
              name: '偏导数',
              description:
                "∂z/∂x 表示固定其他变量对 x 求导。链式法则同样适用：d/dx[f(g(x))] = f'(g(x))·g'(x)。",
              difficulty: 'medium',
            },
            {
              name: '全微分',
              description:
                'dz = (∂z/∂x)dx + (∂z/∂y)dy，是偏导数的线性组合。注意混合偏导数在连续条件下相等（Clairaut 定理）。',
              difficulty: 'medium',
            },
          ],
          similarQuestions: [
            { problem: '求 $z = e^{x^2 + y^2}$ 的全微分', difficulty: 5, knowledgePoint: '全微分' },
          ],
        },
      },
      {
        name: '二重积分',
        output: {
          solution:
            '计算二重积分 $\\iint_D (x^2 + y^2) \\, d\\sigma$，其中 $D: x^2 + y^2 \\leq 4$。\n\n' +
            '转换为极坐标：$x = r\\cos\\theta$，$y = r\\sin\\theta$，$d\\sigma = r\\,dr\\,d\\theta$\n\n' +
            '$$\\iint_D (x^2 + y^2) \\, d\\sigma = \\int_0^{2\\pi} \\int_0^2 r^2 \\cdot r \\, dr \\, d\\theta$$\n\n' +
            '$$= \\int_0^{2\\pi} d\\theta \\int_0^2 r^3 \\, dr = 2\\pi \\cdot \\left[\\frac{r^4}{4}\\right]_0^2 = 2\\pi \\cdot 4 = 8\\pi$$\n\n' +
            '也可以用直角坐标验证：\n' +
            '$$\\int_{-2}^{2} \\int_{-\\sqrt{4-x^2}}^{\\sqrt{4-x^2}} (x^2+y^2) \\, dy \\, dx$$\n' +
            '但极坐标法更简便。',
          answer: '$8\\pi$',
          steps: [
            {
              label: '极坐标变换',
              content: '$x = r\\cos\\theta$，$y = r\\sin\\theta$，$d\\sigma = r\\,dr\\,d\\theta$',
            },
            { label: '确定积分限', content: '$r \\in [0, 2]$，$\\theta \\in [0, 2\\pi]$' },
            { label: '计算', content: '$2\\pi \\cdot \\frac{r^4}{4}\\Big|_0^2 = 8\\pi$' },
          ],
          knowledgePoints: [
            {
              name: '极坐标二重积分',
              description:
                '当积分区域为圆或圆环时，用极坐标更简便。关键是 dσ = r dr dθ，不要遗漏 r。',
              difficulty: 'hard',
            },
          ],
          similarQuestions: [
            {
              problem:
                '计算 $\\iint_D xy \\, d\\sigma$，$D: x^2+y^2 \\leq 1, x \\geq 0, y \\geq 0$',
              difficulty: 6,
              knowledgePoint: '二重积分',
            },
          ],
        },
      },
      {
        name: '泰勒展开与级数收敛',
        output: {
          solution:
            '将 $f(x) = e^x \\sin x$ 在 $x = 0$ 处展开到 $x^4$ 项。\n\n' +
            '已知：\n' +
            '$$e^x = 1 + x + \\frac{x^2}{2!} + \\frac{x^3}{3!} + \\frac{x^4}{4!} + O(x^5)$$\n' +
            '$$\\sin x = x - \\frac{x^3}{3!} + O(x^5)$$\n\n' +
            '相乘：\n' +
            '$$e^x \\sin x = \\left(1 + x + \\frac{x^2}{2} + \\frac{x^3}{6} + \\frac{x^4}{24}\\right)\\left(x - \\frac{x^3}{6}\\right) + O(x^5)$$\n\n' +
            '逐项展开：\n' +
            '$$= x + x^2 + \\frac{x^3}{2} + \\frac{x^3}{6} - \\frac{x^4}{6} + \\frac{x^4}{6} + \\frac{x^4}{24} + O(x^5)$$\n' +
            '$$= x + x^2 + \\frac{2x^3}{3} + \\frac{x^4}{24} + O(x^5)$$\n\n' +
            '等等，让我重新仔细计算：\n' +
            '$$e^x \\sin x = x + x^2 + \\frac{x^3}{3} + O(x^5)$$\n\n' +
            '收敛半径：$e^x$ 和 $\\sin x$ 的泰勒级数都在 $(-\\infty, +\\infty)$ 上收敛，所以乘积级数也在 $\\mathbb{R}$ 上收敛。',
          answer: '$e^x \\sin x = x + x^2 + \\frac{x^3}{3} + O(x^5)$',
          steps: [
            {
              label: '写出展开式',
              content:
                '$e^x = \\sum_{n=0}^{\\infty} \\frac{x^n}{n!}$，$\\sin x = \\sum_{n=0}^{\\infty} \\frac{(-1)^n x^{2n+1}}{(2n+1)!}$',
            },
            { label: '逐项相乘', content: '保留到 $x^4$ 项' },
            { label: '合并同类项', content: '$e^x \\sin x = x + x^2 + \\frac{x^3}{3} + O(x^5)$' },
          ],
          knowledgePoints: [
            {
              name: '泰勒级数',
              description:
                'f(x) = Σ f⁽ⁿ⁾(0)/n! · x^n。常见展开：eˣ、sinx、cosx、ln(1+x)、1/(1-x)。乘积展开需逐项相乘后合并。',
              difficulty: 'hard',
            },
          ],
          similarQuestions: [
            {
              problem: '将 $\\ln(1+x)$ 展开到 $x^5$ 项',
              difficulty: 5,
              knowledgePoint: '泰勒级数',
            },
          ],
        },
      },
      {
        name: '微分方程（二阶常系数）',
        output: {
          solution:
            "求解微分方程 $y'' - 5y' + 6y = e^{2x}$\n\n" +
            "第一步：求齐次方程 $y'' - 5y' + 6y = 0$ 的通解\n" +
            '特征方程：$r^2 - 5r + 6 = 0$\n' +
            '$$(r - 2)(r - 3) = 0 \\implies r_1 = 2, \\quad r_2 = 3$$\n' +
            '齐次通解：$y_h = C_1 e^{2x} + C_2 e^{3x}$\n\n' +
            '第二步：求特解\n' +
            '右端 $e^{2x}$ 中 $\\lambda = 2$ 是特征方程的单根，故设：\n' +
            '$$y_p = Ax e^{2x}$$\n\n' +
            '求导：\n' +
            "$$y_p' = A e^{2x} + 2Ax e^{2x} = A(1 + 2x)e^{2x}$$\n" +
            "$$y_p'' = 2A e^{2x} + 2A(1 + 2x)e^{2x} = 2A(2 + 2x)e^{2x}$$\n\n" +
            '代入方程：\n' +
            '$$2A(2+2x)e^{2x} - 5A(1+2x)e^{2x} + 6Axe^{2x} = e^{2x}$$\n' +
            '$$[(4A + 4Ax) - (5A + 10Ax) + 6Ax]e^{2x} = e^{2x}$$\n' +
            '$$-A = 1 \\implies A = -1$$\n\n' +
            '通解：\n' +
            '$$y = C_1 e^{2x} + C_2 e^{3x} - xe^{2x}$$',
          answer: '$y = C_1 e^{2x} + C_2 e^{3x} - xe^{2x}$',
          steps: [
            { label: '特征方程', content: '$r^2 - 5r + 6 = 0$，$r_1 = 2$，$r_2 = 3$' },
            { label: '齐次通解', content: '$y_h = C_1 e^{2x} + C_2 e^{3x}$' },
            { label: '设特解', content: '$y_p = Axe^{2x}$（$\\lambda=2$ 是单根）' },
            { label: '求 A', content: '代入得 $A = -1$' },
          ],
          knowledgePoints: [
            {
              name: '二阶常系数非齐次方程',
              description:
                "y''+py''+qy = eᵅˣ 型。先求特征根，再根据 λ 是否为特征根设特解：非根→Aeᵅˣ，单根→Axeᵅˣ，重根→Ax²eᵅˣ。",
              difficulty: 'hard',
            },
          ],
          similarQuestions: [
            { problem: "求解 $y'' + y = \\sin x$", difficulty: 7, knowledgePoint: '微分方程' },
          ],
        },
      },
      {
        name: '曲面积分与高斯公式',
        output: {
          solution:
            '计算 $\\oiint_S x^3 \\, dy\\,dz + y^3 \\, dz\\,dx + z^3 \\, dx\\,dy$，\n' +
            '其中 $S$ 是球面 $x^2 + y^2 + z^2 = a^2$ 的外侧。\n\n' +
            '由高斯公式（Gauss divergence theorem）：\n' +
            '$$\\oiint_S P\\,dy\\,dz + Q\\,dz\\,dx + R\\,dx\\,dy = \\iiint_\\Omega \\left(\\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y} + \\frac{\\partial R}{\\partial z}\\right) dV$$\n\n' +
            '其中 $P = x^3$，$Q = y^3$，$R = z^3$：\n' +
            '$$\\frac{\\partial P}{\\partial x} + \\frac{\\partial Q}{\\partial y} + \\frac{\\partial R}{\\partial z} = 3x^2 + 3y^2 + 3z^2 = 3(x^2 + y^2 + z^2)$$\n\n' +
            '转换为球坐标：$x = r\\sin\\varphi\\cos\\theta$，$y = r\\sin\\varphi\\sin\\theta$，$z = r\\cos\\varphi$\n' +
            '$dV = r^2 \\sin\\varphi \\, dr \\, d\\varphi \\, d\\theta$\n\n' +
            '$$= \\int_0^{2\\pi} \\int_0^\\pi \\int_0^a 3r^2 \\cdot r^2 \\sin\\varphi \\, dr \\, d\\varphi \\, d\\theta$$\n' +
            '$$= 3 \\int_0^{2\\pi} d\\theta \\int_0^\\pi \\sin\\varphi \\, d\\varphi \\int_0^a r^4 \\, dr$$\n' +
            '$$= 3 \\cdot 2\\pi \\cdot 2 \\cdot \\frac{a^5}{5} = \\frac{12\\pi a^5}{5}$$',
          answer: '$\\dfrac{12\\pi a^5}{5}$',
          steps: [
            {
              label: '高斯公式',
              content: '曲面积分 → 三重积分：$\\iiint_\\Omega 3(x^2+y^2+z^2)\\,dV$',
            },
            { label: '球坐标变换', content: '$dV = r^2\\sin\\varphi\\,dr\\,d\\varphi\\,d\\theta$' },
            {
              label: '逐次积分',
              content: '$3 \\cdot 2\\pi \\cdot 2 \\cdot \\frac{a^5}{5} = \\frac{12\\pi a^5}{5}$',
            },
          ],
          knowledgePoints: [
            {
              name: '高斯公式',
              description:
                '闭合曲面积分 = 散度的三重积分。条件：S 封闭、外侧、P/Q/R 有一阶连续偏导。球坐标下 dV = r²sinφ dr dφ dθ。',
              difficulty: 'hard',
            },
          ],
          similarQuestions: [
            {
              problem:
                '用高斯公式计算 $\\oiint_S x\\,dy\\,dz + y\\,dz\\,dx + z\\,dx\\,dy$，S 为单位球面',
              difficulty: 6,
              knowledgePoint: '高斯公式',
            },
          ],
        },
      },
      {
        name: '矩阵特征值与对角化',
        output: {
          solution:
            '设矩阵 $A = \\begin{pmatrix} 2 & 1 & 0 \\\\ 0 & 2 & 1 \\\\ 0 & 0 & 2 \\end{pmatrix}$，求特征值和特征向量。\n\n' +
            '特征方程：\n' +
            '$$|A - \\lambda E| = \\begin{vmatrix} 2-\\lambda & 1 & 0 \\\\ 0 & 2-\\lambda & 1 \\\\ 0 & 0 & 2-\\lambda \\end{vmatrix} = (2-\\lambda)^3 = 0$$\n\n' +
            '特征值：$\\lambda = 2$（三重根）\n\n' +
            '求特征向量：解 $(A - 2E)\\vec{x} = \\vec{0}$\n' +
            '$$A - 2E = \\begin{pmatrix} 0 & 1 & 0 \\\\ 0 & 0 & 1 \\\\ 0 & 0 & 0 \\end{pmatrix}$$\n\n' +
            '秩为 2，所以基础解系含 $3 - 2 = 1$ 个向量。\n\n' +
            '$$\\vec{\\xi}_1 = \\begin{pmatrix} 1 \\\\ 0 \\\\ 0 \\end{pmatrix}$$\n\n' +
            '几何重数 = 1 < 代数重数 = 3，所以 $A$ 不可对角化。\n\n' +
            'Jordan 标准形：\n' +
            '$$J = \\begin{pmatrix} 2 & 1 & 0 \\\\ 0 & 2 & 1 \\\\ 0 & 0 & 2 \\end{pmatrix} = A$$\n' +
            '即 $A$ 本身已是 Jordan 块。',
          answer: '$\\lambda = 2$（三重根），不可对角化',
          steps: [
            { label: '特征方程', content: '$|A - \\lambda E| = (2-\\lambda)^3 = 0$' },
            { label: '特征值', content: '$\\lambda = 2$（代数重数 3）' },
            { label: '特征向量', content: '几何重数 = 1，$\\vec{\\xi}_1 = (1, 0, 0)^T$' },
            { label: '结论', content: '不可对角化，Jordan 标准形 $J = A$' },
          ],
          knowledgePoints: [
            {
              name: '矩阵对角化',
              description:
                'A 可对角化 ⟺ 每个特征值的几何重数 = 代数重数。Jordan 标准形处理不可对角化的情况。',
              difficulty: 'hard',
            },
          ],
          similarQuestions: [
            {
              problem: '判断 $A = \\begin{pmatrix} 1 & 1 \\\\ 0 & 1 \\end{pmatrix}$ 能否对角化',
              difficulty: 5,
              knowledgePoint: '矩阵对角化',
            },
          ],
        },
      },
    ],
  },

  physics: {
    title: '物理',
    problems: [
      {
        name: '牛顿第二定律',
        output: {
          solution:
            '质量 $m = 2\\,\\text{kg}$ 的物体在水平面上受力 $F = 10\\,\\text{N}$，摩擦系数 $\\mu = 0.2$。\n\n' +
            '受力分析：\n' +
            '竖直方向：$N = mg = 2 \\times 10 = 20\\,\\text{N}$\n' +
            '水平方向：$F_{\\text{合}} = F - f = F - \\mu N$\n\n' +
            '代入数据：\n' +
            '$$F_{\\text{合}} = 10 - 0.2 \\times 20 = 10 - 4 = 6\\,\\text{N}$$\n\n' +
            '由牛顿第二定律 $F = ma$：\n' +
            '$$a = \\frac{F_{\\text{合}}}{m} = \\frac{6}{2} = 3\\,\\text{m/s}^2$$\n\n' +
            '若物体从静止开始运动，经过 $t = 4\\,\\text{s}$ 后：\n' +
            '$$v = at = 3 \\times 4 = 12\\,\\text{m/s}$$\n' +
            '$$s = \\frac{1}{2}at^2 = \\frac{1}{2} \\times 3 \\times 16 = 24\\,\\text{m}$$',
          answer: '$a = 3\\,\\text{m/s}^2$',
          steps: [
            {
              label: '受力分析',
              content: '竖直 $N = mg = 20\\,\\text{N}$，摩擦力 $f = \\mu N = 4\\,\\text{N}$',
            },
            { label: '求合力', content: '$F_{\\text{合}} = F - f = 10 - 4 = 6\\,\\text{N}$' },
            {
              label: '求加速度',
              content: '$a = \\frac{F_{\\text{合}}}{m} = \\frac{6}{2} = 3\\,\\text{m/s}^2$',
            },
          ],
          knowledgePoints: [
            {
              name: '牛顿第二定律',
              description:
                'F = ma，合力等于质量乘以加速度。注意受力分析时不要遗漏摩擦力、支持力等。',
              difficulty: 'easy',
            },
            {
              name: '匀变速直线运动',
              description: 'v = v₀ + at，s = v₀t + ½at²，v² - v₀² = 2as。适用于加速度恒定的运动。',
              difficulty: 'easy',
            },
          ],
          similarQuestions: [
            {
              problem: '质量 5kg 的物体受 30N 水平力，摩擦系数 0.3，求加速度',
              difficulty: 3,
              knowledgePoint: '牛顿第二定律',
            },
          ],
        },
      },
      {
        name: '库仑定律与电场',
        output: {
          solution:
            '两个点电荷 $q_1 = 2 \\times 10^{-6}\\,\\text{C}$，$q_2 = -3 \\times 10^{-6}\\,\\text{C}$，相距 $r = 0.3\\,\\text{m}$。\n\n' +
            '库仑力大小：\n' +
            '$$F = k\\frac{|q_1||q_2|}{r^2} = 9 \\times 10^9 \\times \\frac{2 \\times 10^{-6} \\times 3 \\times 10^{-6}}{0.3^2}$$\n\n' +
            '$$= 9 \\times 10^9 \\times \\frac{6 \\times 10^{-12}}{0.09} = 9 \\times 10^9 \\times 6.67 \\times 10^{-11} = 0.6\\,\\text{N}$$\n\n' +
            '由于 $q_1 > 0$，$q_2 < 0$，异号电荷相互吸引。\n\n' +
            '中点处电场强度：\n' +
            '$$E_1 = k\\frac{|q_1|}{(r/2)^2} = 9 \\times 10^9 \\times \\frac{2 \\times 10^{-6}}{0.0225} = 8 \\times 10^5\\,\\text{N/C}$$\n' +
            '$$E_2 = k\\frac{|q_2|}{(r/2)^2} = 9 \\times 10^9 \\times \\frac{3 \\times 10^{-6}}{0.0225} = 1.2 \\times 10^6\\,\\text{N/C}$$\n' +
            '中点处 $E_1$ 和 $E_2$ 方向相同（都指向 $q_2$），故：\n' +
            '$$E = E_1 + E_2 = 2 \\times 10^6\\,\\text{N/C}$$',
          answer: '$F = 0.6\\,\\text{N}$，吸引力',
          steps: [
            { label: '库仑力', content: '$F = k\\frac{|q_1||q_2|}{r^2} = 0.6\\,\\text{N}$' },
            { label: '判断方向', content: '异号电荷相互吸引' },
            { label: '中点电场', content: '$E = E_1 + E_2 = 2 \\times 10^6\\,\\text{N/C}$' },
          ],
          knowledgePoints: [
            {
              name: '库仑定律',
              description: 'F = kq₁q₂/r²，k = 9×10⁹ N·m²/C²。适用于真空中两个点电荷之间的力。',
              difficulty: 'medium',
            },
          ],
          similarQuestions: [
            {
              problem: '两个等量同号电荷相距 d，求中点处电场强度',
              difficulty: 4,
              knowledgePoint: '电场叠加',
            },
          ],
        },
      },
    ],
  },

  chemistry: {
    title: '化学',
    problems: [
      {
        name: '化学平衡常数',
        output: {
          solution:
            '对于反应 $\\text{N}_2(g) + 3\\text{H}_2(g) \\rightleftharpoons 2\\text{NH}_3(g)$\n\n' +
            '在某温度下，平衡常数表达式为：\n' +
            '$$K_c = \\frac{[\\text{NH}_3]^2}{[\\text{N}_2][\\text{H}_2]^3}$$\n\n' +
            '已知平衡时各物质浓度：\n' +
            '$[\\text{N}_2] = 0.5\\,\\text{mol/L}$，$[\\text{H}_2] = 1.5\\,\\text{mol/L}$，$[\\text{NH}_3] = 0.8\\,\\text{mol/L}$\n\n' +
            '代入计算：\n' +
            '$$K_c = \\frac{0.8^2}{0.5 \\times 1.5^3} = \\frac{0.64}{0.5 \\times 3.375} = \\frac{0.64}{1.6875} \\approx 0.379$$\n\n' +
            '若温度升高，$K_c$ 减小，说明正反应是放热反应（$\\Delta H < 0$）。\n\n' +
            '转化率计算：设初始 $[\\text{N}_2]_0 = 1\\,\\text{mol/L}$，则：\n' +
            '$$\\alpha = \\frac{[\\text{N}_2]_0 - [\\text{N}_2]}{[\\text{N}_2]_0} = \\frac{1 - 0.5}{1} = 50\\%$$',
          answer: '$K_c \\approx 0.379$',
          steps: [
            {
              label: '写出平衡常数表达式',
              content: '$K_c = \\frac{[\\text{NH}_3]^2}{[\\text{N}_2][\\text{H}_2]^3}$',
            },
            { label: '代入数据', content: '$K_c = \\frac{0.64}{1.6875} \\approx 0.379$' },
            { label: '判断反应类型', content: '温度升高 $K_c$ 减小 → 正反应放热' },
          ],
          knowledgePoints: [
            {
              name: '化学平衡常数',
              description:
                'Kc = 生成物浓度幂次方之积 / 反应物浓度幂次方之积。Kc 只与温度有关，与浓度、压强无关。',
              difficulty: 'medium',
            },
          ],
          similarQuestions: [
            {
              problem:
                '对于 $\\text{H}_2 + \\text{I}_2 \\rightleftharpoons 2\\text{HI}$，写出 $K_c$ 表达式',
              difficulty: 3,
              knowledgePoint: '化学平衡常数',
            },
          ],
        },
      },
      {
        name: '摩尔计算',
        output: {
          solution:
            '标准状况下，$2.24\\,\\text{L}$ 的 $\\text{CO}_2$ 气体。\n\n' +
            '物质的量：\n' +
            '$$n = \\frac{V}{V_m} = \\frac{2.24\\,\\text{L}}{22.4\\,\\text{L/mol}} = 0.1\\,\\text{mol}$$\n\n' +
            '质量：\n' +
            '$$m = nM = 0.1 \\times 44 = 4.4\\,\\text{g}$$\n\n' +
            '分子数：\n' +
            '$$N = nN_A = 0.1 \\times 6.02 \\times 10^{23} = 6.02 \\times 10^{22}$$\n\n' +
            '其中含有碳原子 $0.1\\,\\text{mol}$，氧原子 $0.2\\,\\text{mol}$。',
          answer: '$n = 0.1\\,\\text{mol}$，$m = 4.4\\,\\text{g}$',
          steps: [
            {
              label: '求物质的量',
              content: '$n = \\frac{V}{V_m} = \\frac{2.24}{22.4} = 0.1\\,\\text{mol}$',
            },
            { label: '求质量', content: '$m = nM = 0.1 \\times 44 = 4.4\\,\\text{g}$' },
            { label: '求分子数', content: '$N = nN_A = 6.02 \\times 10^{22}$' },
          ],
          knowledgePoints: [
            {
              name: '物质的量',
              description:
                'n = m/M = V/Vm = N/NA。标准状况下 Vm = 22.4 L/mol。注意区分标准状况和常温常压。',
              difficulty: 'easy',
            },
          ],
          similarQuestions: [
            {
              problem: '标准状况下 11.2L O₂ 的质量是多少？',
              difficulty: 2,
              knowledgePoint: '物质的量',
            },
          ],
        },
      },
    ],
  },

  biology: {
    title: '生物',
    problems: [
      {
        name: '遗传概率计算',
        output: {
          solution:
            '已知父母基因型均为 $Aa$（杂合子），求后代的表现型比例。\n\n' +
            '亲本杂交：$Aa \\times Aa$\n\n' +
            '配子类型：\n' +
            '父本产生 $A$ 和 $a$ 两种配子，各占 $\\frac{1}{2}$\n' +
            '母本产生 $A$ 和 $a$ 两种配子，各占 $\\frac{1}{2}$\n\n' +
            '后代基因型：\n' +
            '$$P(AA) = \\frac{1}{2} \\times \\frac{1}{2} = \\frac{1}{4}$$\n' +
            '$$P(Aa) = 2 \\times \\frac{1}{2} \\times \\frac{1}{2} = \\frac{1}{2}$$\n' +
            '$$P(aa) = \\frac{1}{2} \\times \\frac{1}{2} = \\frac{1}{4}$$\n\n' +
            '表现型比例：显性（$A\\_$）：隐性（$aa$）$= 3:1$\n\n' +
            '若连续两代为隐性：\n' +
            '$$P(aa \\times aa) = 1 \\times 1 = 1$$\n' +
            '后代全为 $aa$，不发生性状分离。',
          answer: '显性：隐性 = 3:1',
          steps: [
            { label: '确定亲本基因型', content: '$Aa \\times Aa$' },
            {
              label: '计算后代基因型',
              content: '$P(AA) = \\frac{1}{4}$，$P(Aa) = \\frac{1}{2}$，$P(aa) = \\frac{1}{4}$',
            },
            { label: '得出表现型比', content: '显性：隐性 = 3:1' },
          ],
          knowledgePoints: [
            {
              name: '分离定律',
              description: '杂合子自交后代基因型比 AA:Aa:aa = 1:2:1，表现型比 显性:隐性 = 3:1。',
              difficulty: 'easy',
            },
          ],
          similarQuestions: [
            {
              problem: 'Aa × aa 后代的表现型比是多少？',
              difficulty: 2,
              knowledgePoint: '分离定律',
            },
          ],
        },
      },
      {
        name: '酶促反应动力学',
        output: {
          solution:
            '米氏方程描述酶促反应速率：\n' +
            '$$v = \\frac{V_{\\max}[S]}{K_m + [S]}$$\n\n' +
            '其中 $V_{\\max}$ 为最大反应速率，$K_m$ 为米氏常数，$[S]$ 为底物浓度。\n\n' +
            '当 $[S] = K_m$ 时：\n' +
            '$$v = \\frac{V_{\\max} \\cdot K_m}{K_m + K_m} = \\frac{V_{\\max}}{2}$$\n\n' +
            '即反应速率达到最大速率的一半。\n\n' +
            '已知 $V_{\\max} = 100\\,\\mu\\text{mol/min}$，$K_m = 2\\,\\text{mmol/L}$，\n' +
            '当 $[S] = 8\\,\\text{mmol/L}$ 时：\n' +
            '$$v = \\frac{100 \\times 8}{2 + 8} = \\frac{800}{10} = 80\\,\\mu\\text{mol/min}$$\n\n' +
            '此时酶已接近饱和，$v \\approx 0.8 V_{\\max}$。',
          answer: '$v = 80\\,\\mu\\text{mol/min}$',
          steps: [
            { label: '写出米氏方程', content: '$v = \\frac{V_{\\max}[S]}{K_m + [S]}$' },
            {
              label: '代入数据',
              content: '$v = \\frac{100 \\times 8}{2 + 8} = 80\\,\\mu\\text{mol/min}$',
            },
            { label: '分析结果', content: '$v \\approx 0.8 V_{\\max}$，酶接近饱和' },
          ],
          knowledgePoints: [
            {
              name: '米氏方程',
              description:
                'v = Vmax[S]/(Km+[S])。Km 值越小，酶与底物亲和力越大。当 [S] >> Km 时，v ≈ Vmax。',
              difficulty: 'hard',
            },
          ],
          similarQuestions: [
            {
              problem: '当 [S] = Km 时，反应速率是多少？',
              difficulty: 3,
              knowledgePoint: '米氏方程',
            },
          ],
        },
      },
    ],
  },
};

// 合并高数专题到数学 tab
TEST_DATA.math.problems.push(...TEST_DATA.advanced.problems);

// ── 原始 LLM 输出模拟 ──────────────────────────────────────────
// 模拟 LLM 实际输出的样子：缺 $、裸 LaTeX、Unicode 混排

const RAW_LLM_EXAMPLES: { name: string; raw: string; answer: string }[] = [
  {
    name: '高数：求极限（LLM 裸输出）',
    raw:
      '求极限 lim(x→0) (sin3x)/(tan5x)\n\n' +
      '第一步：利用等价无穷小\n' +
      '当 x→0 时，sin3x ~ 3x，tan5x ~ 5x\n\n' +
      '第二步：代入等价替换\n' +
      'lim(x→0) (sin3x)/(tan5x) = lim(x→0) 3x/5x = 3/5\n\n' +
      '所以原式 = 3/5',
    answer: '3/5',
  },
  {
    name: '高数：求导数（LLM 裸输出）',
    raw:
      "设 y = x^(sinx)，求 y'\n\n" +
      '取对数：ln y = sinx · lnx\n\n' +
      '两边对x求导：\n' +
      "1/y · y' = cosx · lnx + sinx · 1/x\n\n" +
      "所以 y' = y(cosx · lnx + sinx/x)\n" +
      '= x^(sinx)(cosx · lnx + sinx/x)',
    answer: "y' = x^(sinx)(cosx · lnx + sinx/x)",
  },
  {
    name: '高数：定积分（LLM 裸输出）',
    raw:
      '计算 ∫₀¹ xe^x dx\n\n' +
      '用分部积分法：∫u dv = uv - ∫v du\n' +
      '令 u = x，dv = e^x dx\n' +
      '则 du = dx，v = e^x\n\n' +
      '∫₀¹ xe^x dx = [xe^x]₀¹ - ∫₀¹ e^x dx\n' +
      '= (1·e - 0) - [e^x]₀¹\n' +
      '= e - (e - 1)\n' +
      '= 1',
    answer: '1',
  },
  {
    name: '高数：二阶微分方程（LLM 裸输出）',
    raw:
      "求解 y'' + 4y = sin2x\n\n" +
      '特征方程：r² + 4 = 0，r = ±2i\n' +
      '齐次通解：y_h = C₁cos2x + C₂sin2x\n\n' +
      '因为 λ = 2i 是特征根，设特解：\n' +
      'y_p = x(Acos2x + Bsin2x)\n\n' +
      '求导代入后比较系数得：A = -1/4, B = 0\n\n' +
      '通解：y = C₁cos2x + C₂sin2x - (x/4)cos2x',
    answer: 'y = C₁cos2x + C₂sin2x - (x/4)cos2x',
  },
  {
    name: '线代：行列式展开（LLM 裸输出）',
    raw:
      '计算行列式 D = |2  1  3|\n' +
      '               |1  0  2|\n' +
      '               |3 -1  1|\n\n' +
      '按第一行展开：\n' +
      'D = 2·|0 2| - 1·|1 2| + 3·|1  0|\n' +
      '        |-1 1|     |3 1|     |3 -1|\n\n' +
      '= 2(0·1 - 2·(-1)) - 1(1·1 - 2·3) + 3(1·(-1) - 0·3)\n' +
      '= 2(0+2) - 1(1-6) + 3(-1-0)\n' +
      '= 2·2 - 1·(-5) + 3·(-1)\n' +
      '= 4 + 5 - 3\n' +
      '= 6',
    answer: 'D = 6',
  },
  {
    name: '物理：简谐振动（LLM 裸输出）',
    raw:
      '弹簧振子质量 m=0.5kg，劲度系数 k=200N/m\n' +
      '求周期T和角频率ω\n\n' +
      '角频率：ω = √(k/m) = √(200/0.5) = √400 = 20 rad/s\n\n' +
      '周期：T = 2π/ω = 2π/20 = π/10 ≈ 0.314 s\n\n' +
      '最大速度（振幅A=0.1m时）：\n' +
      'v_max = ωA = 20 × 0.1 = 2 m/s\n\n' +
      '最大加速度：\n' +
      'a_max = ω²A = 400 × 0.1 = 40 m/s²',
    answer: 'ω = 20 rad/s，T = π/10 s',
  },
];

const SUBJECTS = ['math', 'physics', 'chemistry', 'biology'] as const;
type Subject = (typeof SUBJECTS)[number];

export default function MathTestPage() {
  const [activeSubject, setActiveSubject] = useState<Subject>('math');
  const [activeProblem, setActiveProblem] = useState(0);
  const [pageMode, setPageMode] = useState<'preset' | 'raw' | 'custom'>('preset');
  const [rawIndex, setRawIndex] = useState(0);
  const [customText, setCustomText] = useState('');

  const subjectData = TEST_DATA[activeSubject];
  const currentProblem = subjectData.problems[activeProblem];
  const currentRaw = RAW_LLM_EXAMPLES[rawIndex];

  // 管道处理函数（模拟真实 pipeline）
  const pipelineProcess = (text: string) => {
    const afterPostProcess = postProcessMathContent(text);
    return { afterPostProcess };
  };

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 dark:from-sky-400 dark:to-blue-400 bg-clip-text text-transparent">
            解题详解渲染测试
          </h1>
          <p className="text-sm text-muted-foreground">
            预置数据 · 原始 LLM 输出模拟 · 自定义输入 — 调试公式渲染效果
          </p>
        </div>

        {/* 顶部模式切换 */}
        <div className="mb-6">
          <Tabs value={pageMode} onValueChange={(v) => setPageMode(v as typeof pageMode)}>
            <TabsList>
              <TabsTrigger value="preset">精致数据（已格式化）</TabsTrigger>
              <TabsTrigger value="raw">原始 LLM 输出模拟</TabsTrigger>
              <TabsTrigger value="custom">自定义输入</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* ── 左侧：选择区 ── */}
          <div className="space-y-4">
            {pageMode === 'preset' && (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">选择学科</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Tabs
                      value={activeSubject}
                      onValueChange={(v) => {
                        setActiveSubject(v as Subject);
                        setActiveProblem(0);
                      }}
                    >
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="math">数学</TabsTrigger>
                        <TabsTrigger value="physics">物理</TabsTrigger>
                        <TabsTrigger value="chemistry">化学</TabsTrigger>
                        <TabsTrigger value="biology">生物</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{subjectData.title} — 测试题目</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {subjectData.problems.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveProblem(i)}
                        className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                          activeProblem === i
                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30'
                            : 'border-border hover:border-sky-300'
                        }`}
                      >
                        <div className="font-medium">{p.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {p.output.solution.slice(0, 80)}...
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}

            {pageMode === 'raw' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">原始 LLM 输出示例</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {RAW_LLM_EXAMPLES.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setRawIndex(i)}
                      className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                        rawIndex === i
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30'
                          : 'border-border hover:border-sky-300'
                      }`}
                    >
                      <div className="font-medium">{ex.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2 font-mono">
                        {ex.raw.slice(0, 80)}...
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* 调试信息 */}
            {pageMode === 'preset' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">原始数据预览</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <pre className="max-h-60 overflow-auto rounded bg-muted p-2 text-[10px] leading-tight whitespace-pre-wrap break-all">
                    {JSON.stringify(currentProblem.output, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── 右侧：渲染区 ── */}
          <div className="space-y-6">
            {/* ── 模式1：精致数据 ── */}
            {pageMode === 'preset' && (
              <>
                <SolutionPanel output={currentProblem.output} />
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">solution 字段 MathRenderer 单独渲染</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="rounded border bg-background p-4 text-sm leading-loose">
                      <MathRenderer content={currentProblem.output.solution} />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* ── 模式2：原始 LLM 输出模拟 ── */}
            {pageMode === 'raw' && (
              <PipelineDebugView
                raw={currentRaw.raw}
                answer={currentRaw.answer}
                name={currentRaw.name}
              />
            )}

            {/* ── 模式3：自定义输入 ── */}
            {pageMode === 'custom' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">输入任意内容（模拟 LLM 原始输出）</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Textarea
                      placeholder="粘贴 LLM 原始输出，支持裸 LaTeX、Unicode、$...$ 混合..."
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      className="min-h-[200px] font-mono text-xs"
                    />
                  </CardContent>
                </Card>
                {customText && <PipelineDebugView raw={customText} answer="" name="自定义输入" />}
              </div>
            )}
          </div>
        </div>
      </div>
    </SkyAppShell>
  );
}

// ── 管道调试视图 ────────────────────────────────────────────────
// 展示原始文本经过 postProcessMathContent 和 MathRenderer 后的效果

function PipelineDebugView({ raw, answer, name }: { raw: string; answer: string; name: string }) {
  const processed = postProcessMathContent(raw);

  return (
    <div className="space-y-4">
      {/* 管道阶段标签 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs">
          原始 LLM 输出
        </Badge>
        <span className="text-xs text-muted-foreground">→</span>
        <Badge variant="outline" className="text-xs">
          postProcessMathContent
        </Badge>
        <span className="text-xs text-muted-foreground">→</span>
        <Badge variant="default" className="text-xs bg-sky-600">
          MathRenderer 渲染
        </Badge>
      </div>

      {/* 阶段1：原始文本 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            阶段 1：原始 LLM 输出
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <pre className="rounded bg-red-50 dark:bg-red-950/20 p-3 text-xs leading-relaxed whitespace-pre-wrap font-mono overflow-auto max-h-80">
            {raw}
          </pre>
        </CardContent>
      </Card>

      {/* 阶段2：postProcessMathContent 处理后 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
            阶段 2：postProcessMathContent 处理后
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <pre className="rounded bg-yellow-50 dark:bg-yellow-950/20 p-3 text-xs leading-relaxed whitespace-pre-wrap font-mono overflow-auto max-h-80">
            {processed}
          </pre>
        </CardContent>
      </Card>

      {/* 阶段3：最终渲染 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            阶段 3：MathRenderer 最终渲染效果
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="rounded bg-green-50 dark:bg-green-950/20 p-4 text-sm leading-loose">
            <MathRenderer content={processed} />
          </div>
        </CardContent>
      </Card>

      {/* SolutionPanel 模拟 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
            最终效果：SolutionPanel 组件
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <SolutionPanel
            output={{
              solution: processed,
              answer: answer,
              steps: [{ label: '解答', content: processed, keyPoints: [] }],
              knowledgePoints: [],
              similarQuestions: [],
            }}
          />
        </CardContent>
      </Card>

      {/* 差异对比 */}
      {raw !== processed && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
              管道处理差异（绿色=新增，红色=删除）
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DiffView before={raw} after={processed} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── 简易 diff 视图 ──────────────────────────────────────────────

function DiffView({ before, after }: { before: string; after: string }) {
  // 简单的行级 diff
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const maxLen = Math.max(beforeLines.length, afterLines.length);

  const lines: { type: 'same' | 'changed'; before: string; after: string }[] = [];
  for (let i = 0; i < maxLen; i++) {
    const b = beforeLines[i] ?? '';
    const a = afterLines[i] ?? '';
    lines.push({
      type: b === a ? 'same' : 'changed',
      before: b,
      after: a,
    });
  }

  return (
    <div className="max-h-60 overflow-auto rounded bg-muted p-2 text-[11px] font-mono leading-tight">
      {lines.map((line, i) => (
        <div key={i} className="flex gap-2">
          <span className="w-6 text-right text-muted-foreground shrink-0">{i + 1}</span>
          {line.type === 'same' ? (
            <span className="text-muted-foreground">{line.before}</span>
          ) : (
            <>
              <span className="text-red-600 dark:text-red-400 line-through">{line.before}</span>
              <span className="text-green-600 dark:text-green-400">{line.after}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
