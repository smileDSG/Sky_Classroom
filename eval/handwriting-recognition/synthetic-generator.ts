export type SyntheticSplit = 'tune' | 'dev' | 'test';
export type SyntheticSubject = 'math' | 'physics';

export interface SyntheticRecognitionCase {
  id: string;
  source: 'synthetic';
  split: SyntheticSplit;
  subject: SyntheticSubject;
  image: string;
  groundTruth: {
    text: string;
    latex: string[];
  };
  tags: string[];
  degradation: {
    rotation: number;
    blur: number;
    shadow: number;
    crop: number;
    noise: number;
  };
  rendering: {
    fontFamily: string;
    lineJitter: number;
  };
}

interface Template {
  subject: SyntheticSubject;
  text: string;
  latex: string[];
  tags: string[];
}

const TEMPLATES: Template[] = [
  {
    subject: 'math',
    text: '1. 解方程：2x + 5 = 17。',
    latex: ['2x+5=17'],
    tags: ['equation', 'chinese'],
  },
  {
    subject: 'math',
    text: '2. 计算：1/2 + 3/4，并写出最简结果。',
    latex: ['\\frac{1}{2}+\\frac{3}{4}'],
    tags: ['fraction', 'chinese'],
  },
  {
    subject: 'math',
    text: '3. 化简：√18 - √8。',
    latex: ['\\sqrt{18}-\\sqrt{8}'],
    tags: ['radical', 'chinese'],
  },
  {
    subject: 'math',
    text: '4. 已知 y = x² + 2x + 1，求 x = 2 时的 y。',
    latex: ['y=x^2+2x+1', 'x=2'],
    tags: ['superscript', 'function'],
  },
  {
    subject: 'math',
    text: '5. 计算积分：∫₀¹ 2x dx。',
    latex: ['\\int_0^1 2x\\,dx'],
    tags: ['integral', 'subscript', 'superscript'],
  },
  {
    subject: 'math',
    text: '6. 已知向量 a = (1, 2)，b = (3, -1)，求 a + b。',
    latex: ['\\vec{a}=(1,2)', '\\vec{b}=(3,-1)', '\\vec{a}+\\vec{b}'],
    tags: ['vector', 'mixed-symbols'],
  },
  {
    subject: 'physics',
    text: '7. 质量 m = 2 kg，合力 F = 10 N，求加速度 a。',
    latex: ['F=ma', 'm=2\\,kg', 'F=10\\,N'],
    tags: ['unit', 'physics-formula'],
  },
  {
    subject: 'physics',
    text: '8. 小车速度从 2 m/s 增加到 8 m/s，用时 3 s，求加速度。',
    latex: ['a=\\frac{v-v_0}{t}'],
    tags: ['unit', 'fraction', 'subscript'],
  },
  {
    subject: 'physics',
    text: '9. 电阻 R = 5 Ω，电流 I = 2 A，求电压 U。',
    latex: ['U=IR', 'R=5\\,\\Omega', 'I=2\\,A'],
    tags: ['unit', 'greek-symbol', 'physics-formula'],
  },
  {
    subject: 'physics',
    text: '10. 波长 λ = 0.5 m，频率 f = 20 Hz，求波速 v。',
    latex: ['v=\\lambda f', '\\lambda=0.5\\,m', 'f=20\\,Hz'],
    tags: ['unit', 'greek-symbol', 'physics-formula'],
  },
];

const FONTS = ['KaiTi', 'STKaiti', 'FangSong', 'SimSun', 'Comic Sans MS'];

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function splitFor(index: number, count: number): SyntheticSplit {
  const tuneEnd = Math.round(count * 0.6);
  const devEnd = tuneEnd + Math.round(count * 0.2);
  if (index < tuneEnd) return 'tune';
  if (index < devEnd) return 'dev';
  return 'test';
}

export function buildSyntheticCases(
  count = 50,
  seed = 20260722,
): SyntheticRecognitionCase[] {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('count must be a positive integer');
  }

  const random = mulberry32(seed);

  return Array.from({ length: count }, (_, index) => {
    const template = TEMPLATES[index % TEMPLATES.length];
    const rotation = index % 7 === 0 ? (index % 2 === 0 ? 4 : -4) : round((random() - 0.5) * 4, 1);
    const blur = index % 9 === 0 ? 1.4 : round(random() * 0.7, 1);
    const shadow = index % 5 === 0 ? round(0.35 + random() * 0.3) : round(random() * 0.25);
    const crop = index % 13 === 0 ? round(0.03 + random() * 0.03) : 0;
    const noise = round(0.03 + random() * 0.12);
    const id = `synthetic-${String(index + 1).padStart(3, '0')}`;

    return {
      id,
      source: 'synthetic' as const,
      split: splitFor(index, count),
      subject: template.subject,
      image: `images/${id}.png`,
      groundTruth: {
        text: template.text,
        latex: [...template.latex],
      },
      tags: [...template.tags],
      degradation: { rotation, blur, shadow, crop, noise },
      rendering: {
        fontFamily: FONTS[index % FONTS.length],
        lineJitter: round(0.5 + random() * 2, 1),
      },
    };
  });
}
