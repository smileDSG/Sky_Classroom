/**
 * Template-based question generator — instant, reliable, no LLM needed.
 *
 * Generates thousands of educational questions using programmatic templates.
 * Each template produces variations via random parameter substitution.
 * The solver pipeline verifies correctness independently.
 */

import type { ExtractedQuestion, SubjectId, GradeLevel } from './types';

// ── Random helpers ──────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randFloat(min: number, max: number, decimals: number = 1): number {
  const v = Math.random() * (max - min) + min;
  return Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// ── Math templates ──────────────────────────────────────────────────

function mathTemplates(): string[] {
  const a = randInt(1, 10);
  const b = randInt(1, 10);
  const c = randInt(-10, 10);
  const d = randInt(-5, 5);
  const n = randInt(5, 20);
  const angle = pick([30, 45, 60, 120, 135, 150]);
  const r = randInt(1, 10);

  return [
    // 函数与导数
    `已知函数 $f(x) = ${a}x^3 + ${b}x^2 + ${c}x + ${d}$，求 $f(x)$ 的极值点。`,
    `已知函数 $f(x) = ${a}x^2 + ${b}x + ${c}$，求 $f(x)$ 在区间 $[${d}, ${d+5}]$ 上的最大值和最小值。`,
    `求函数 $f(x) = \\frac{${a}x + ${b}}{x + ${c}}$ 的导数 $f'(x)$。`,
    `已知曲线 $y = ${a}x^3 - ${b}x + ${c}$ 在点 $(1, ${a-b+c})$ 处的切线方程。`,
    `判断函数 $f(x) = ${a}x^3 - ${b}x$ 的单调区间。`,
    `已知 $f(x) = e^{${a}x} \\cdot \\sin(${b}x)$，求 $f'(0)$。`,
    `求函数 $f(x) = \\ln(${a}x + ${b})$ 的定义域。`,

    // 三角函数
    `已知 $\\sin\\alpha = \\frac{${randInt(1,4)}}{5}$，且 $\\alpha \\in (0, \\frac{\\pi}{2})$，求 $\\cos\\alpha$ 和 $\\tan\\alpha$。`,
    `求 $\\sin${angle}^\\circ + \\cos${angle}^\\circ$ 的值。`,
    `已知 $\\sin\\theta + \\cos\\theta = \\frac{${randInt(4,7)}}{5}$，求 $\\sin 2\\theta$。`,
    `求函数 $y = ${a}\\sin(${b}x + \\frac{\\pi}{${pick([3,4,6])}})$ 的最小正周期和振幅。`,
    `在 $\\triangle ABC$ 中，已知 $a=${a}$, $b=${b}$, $C=${angle}^\\circ$，求 $c$。`,
    `在 $\\triangle ABC$ 中，$a=${a}$, $A=${angle}^\\circ$, $B=${pick([30,45,60])}^\\circ$，求 $b$。`,

    // 数列
    `已知等差数列 $\\{a_n\\}$ 中，$a_1 = ${a}$，$a_${n} = ${a + (n-1)*d}$，求公差 $d$ 和前 $n$ 项和 $S_n$。`,
    `已知等比数列 $\\{a_n\\}$ 中，$a_1 = ${a}$，公比 $q = ${pick([2,3,0.5])}$，求前 ${n} 项和 $S_${n}$。`,
    `在等差数列 $\\{a_n\\}$ 中，已知 $S_${n} = ${randInt(20,100)}$，$a_1 = ${a}$，求公差 $d$。`,
    `求等比数列 ${a}, ${a*2}, ${a*4}, ${a*8}, \\ldots$ 的第 ${n} 项。`,

    // 向量与几何
    `已知 $\\vec{a} = (${a}, ${b})$，$\\vec{b} = (${c}, ${d})$，求 $\\vec{a} \\cdot \\vec{b}$ 和 $|\\vec{a}|$。`,
    `已知 $|\\vec{a}|=${a}$，$|\\vec{b}|=${b}$，$\\vec{a}\\cdot\\vec{b}=${a*b-randInt(1,5)}$，求夹角。`,
    `求过点 $(${a}, ${b})$ 且斜率为 ${c} 的直线方程。`,
    `已知圆的方程为 $(x-${a})^2 + (y-${b})^2 = ${r}^2$，求圆心和半径。`,

    // 概率与统计
    `从数字 $1,2,3,4,5,6$ 中任取两个，求其和为${pick([5,7,8,9])}的概率。`,
    `掷两个骰子，求点数之和为${pick([6,7,8,9])}的概率。`,
    `某班有 ${randInt(20,30)} 名男生和 ${randInt(15,25)} 名女生，随机选 ${randInt(2,4)} 人，求至少有 1 名女生的概率。`,
    `已知随机变量 $X \\sim B(${n}, ${randFloat(0.2,0.7,1)})$，求 $E(X)$ 和 $D(X)$。`,

    // 积分
    `求不定积分 $\\int (${a}x^2 + ${b}x + ${c}) \\, dx$。`,
    `求定积分 $\\int_0^{${randInt(1,3)}} (${a}x^2 + ${b}x) \\, dx$。`,
    `求不定积分 $\\int ${a}x \\cdot e^{${b}x} \\, dx$。`,

    // 复数与方程
    `已知复数 $z = ${a} + ${b}i$，求 $|z|$ 和 $\\bar{z}$。`,
    `解方程 $x^2 - ${a+b}x + ${a*b} = 0$。`,
    `解不等式 $|${a}x - ${b}| < ${c+5}$。`,
  ];
}

// ── Physics templates ────────────────────────────────────────────────

function physicsTemplates(): string[] {
  const m = randInt(1, 10);
  const F = randInt(5, 50);
  const v = randInt(5, 30);
  const R = randInt(2, 20);
  const U = pick([12, 24, 36, 110, 220]);
  const t = randInt(2, 10);

  return [
    // 力学
    `一质量为 ${m} kg 的物体在光滑水平面上受到 ${F} N 的水平力，求物体的加速度。`,
    `一质量为 ${m} kg 的物体从 ${randInt(5,45)} m 高处自由落下，求落地速度。（$g=10\\text{m/s}^2$）`,
    `一辆汽车以 ${v} m/s 的速度行驶，紧急刹车后以 ${randFloat(2,6)} m/s² 的加速度减速，求刹车距离。`,
    `一质量为 ${m} kg 的物体以 ${v} m/s 的速度运动，求其动能。`,
    `用 ${F} N 的力将物体沿水平面拉动 ${randInt(2,10)} m，力与位移夹角为 ${pick([0,30,45,60])}°，求所做的功。`,
    `一弹簧的劲度系数为 ${randInt(50,200)} N/m，被压缩了 ${randFloat(0.1,0.5)} m，求弹簧储存的弹性势能。`,
    `质量为 ${m} kg 的物体从斜面顶端滑下，斜面高 ${randInt(2,10)} m，不计摩擦，求滑到底端的速度。`,
    `两物体质量分别为 ${m} kg 和 ${m*2} kg，以 ${v} m/s 和 ${-randInt(1,5)} m/s 的速度对心碰撞，若为完全非弹性碰撞，求碰后速度。`,

    // 电磁学
    `一个电阻为 ${R} Ω 的导体，两端电压为 ${U} V，求通过导体的电流和电功率。`,
    `两个电阻 ${R} Ω 和 ${R*2} Ω 并联后接在 ${U} V 电源上，求总电流。`,
    `两个电阻 ${R} Ω 和 ${R*2} Ω 串联后接在 ${U} V 电源上，求每个电阻两端的电压。`,
    `一个电容器电容为 ${randInt(10,100)} μF，充电至 ${U} V，求储存的电荷量。`,

    // 光学
    `一束光从空气射入折射率为 ${randFloat(1.3,1.7,1)} 的介质，入射角为 ${pick([30,45,60])}°，求折射角。`,
    `一凸透镜焦距为 ${randInt(10,30)} cm，物距为 ${randInt(15,60)} cm，求像距和像的性质。`,

    // 热学
    `${randFloat(0.1,2,1)} mol 理想气体在等压过程中温度从 ${randInt(280,320)} K 升高到 ${randInt(340,400)} K，求气体对外做的功。（$R=8.31\\text{J/(mol·K)}$）`,
  ];
}

// ── Chemistry templates ──────────────────────────────────────────────

function chemistryTemplates(): string[] {
  const m = randFloat(1, 20, 1);
  const M = pick([56, 64, 23, 27, 65, 40]);
  const V = randFloat(0.5, 11.2, 1);

  return [
    `配平化学方程式并计算：${pick(['Fe + HCl → FeCl₂ + H₂', 'Zn + H₂SO₄ → ZnSO₄ + H₂', 'CaCO₃ + HCl → CaCl₂ + CO₂ + H₂O'])}。若反应物为 ${m} g，求生成气体的体积（标准状况）。`,
    `${m} g ${pick(['NaOH', 'NaCl', 'KOH', 'MgO'])} 溶于水配成 ${randInt(100,500)} mL 溶液，求物质的量浓度。`,
    `已知反应 ${pick(['N₂ + 3H₂ ⇌ 2NH₃', '2SO₂ + O₂ ⇌ 2SO₃'])}，平衡常数 $K=${randInt(1,10)}$，若各物质浓度均为 ${randFloat(0.5,3,1)} mol/L，判断反应进行方向。`,
    `某有机物含 C ${randInt(40,80)}%、H ${randInt(5,15)}%、O ${randInt(10,40)}%，摩尔质量为 ${randInt(60,180)} g/mol，求其分子式。`,
    `计算 ${randFloat(2,10,1)} g ${pick(['NaOH', 'HCl', 'H₂SO₄'])} 的物质的量。`,
  ];
}

// ── Biology templates ────────────────────────────────────────────────

function biologyTemplates(): string[] {
  return [
    `在孟德尔的豌豆杂交实验中，纯种高茎（TT）与纯种矮茎（tt）杂交，F₁ 全为高茎。若 F₁ 自交，求 F₂ 中高茎与矮茎的比例。`,
    `DNA 复制时，一条模板链的碱基序列为 ${pick(['ATCG', 'GCTA', 'TACG', 'CGAT'])}，求互补链的碱基序列。`,
    `若某蛋白由 ${randInt(100,300)} 个氨基酸组成，则编码该蛋白的基因至少含有多少个碱基对？`,
    `在细胞有丝分裂过程中，若某生物的体细胞有 ${pick([8,12,16,24,46])} 条染色体，在有丝分裂后期有多少条染色体？`,
    `一对正常夫妇生了一个白化病孩子（常染色体隐性遗传），求他们再生一个孩子患白化病的概率。`,
  ];
}

// ── Public API ──────────────────────────────────────────────────────

const TEMPLATE_FNS: Record<string, () => string[]> = {
  math: mathTemplates,
  physics: physicsTemplates,
  chemistry: chemistryTemplates,
  biology: biologyTemplates,
};

export interface TemplateGenerateOptions {
  subject: SubjectId;
  gradeLevel: GradeLevel;
  count: number;
}

/**
 * Instantly generate questions using programmatic templates.
 * No LLM, no API calls, no latency.
 */
export function generateTemplateQuestions(
  opts: TemplateGenerateOptions,
): ExtractedQuestion[] {
  const { subject, gradeLevel, count } = opts;

  const fn = TEMPLATE_FNS[subject];
  if (!fn) return [];

  const questions: ExtractedQuestion[] = [];
  const seen = new Set<string>();

  // Generate up to 3x count to dedup and get enough unique ones
  const maxAttempts = count * 3;
  let attempts = 0;

  while (questions.length < count && attempts < maxAttempts) {
    const templates = fn();
    for (const text of templates) {
      if (questions.length >= count) break;
      const key = text.slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      questions.push({
        problemText: text,
        subject,
        gradeLevel,
        questionType: 'solve',
        sourceUrl: `template://${subject}/${gradeLevel}`,
        extractionConfidence: 1.0,
      });
    }
    attempts++;
  }

  return questions.slice(0, count);
}
