/**
 * Dev-only seed endpoint: clears all mistakes and populates realistic ones.
 *
 * POST /api/dev/seed-mistakes
 * GET  /api/dev/seed-mistakes?clear=true to clear without seeding.
 */
import { NextRequest } from 'next/server';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';
import { getServerStorage } from '@/lib/server/server-storage';
import { createMistakeBookDAO } from '@/lib/storage/dao/mistakes';
import type { MistakeBookEntry } from '@/lib/storage/dao/mistakes';
import { createLogger } from '@/lib/logger';

const log = createLogger('API:SeedMistakes');

interface SeedMistake {
  id: string;
  problemText: string;
  userAnswer: string;
  correctAnswer: string;
  errorType: 'calculation' | 'concept' | 'reasoning' | 'reading' | 'careless';
  knowledgePoints: string[];
  source: NonNullable<MistakeBookEntry['source']>;
}

const SAMPLE_MISTAKES: SeedMistake[] = [
  {
    id: 'seed-derivative-001',
    problemText: '已知函数 f(x)=x³-3x，判断它在区间 (-1, 1) 上的单调性。',
    userAnswer: '单调递增',
    correctAnswer: '单调递减',
    errorType: 'concept',
    knowledgePoints: ['高中数学·导数', '函数单调性'],
    source: 'solve',
  },
  {
    id: 'seed-trig-001',
    problemText: '在 △ABC 中，已知 AB=5, BC=6, AC=7，求 ∠B 的余弦值。',
    userAnswer: 'cos B = 1/5',
    correctAnswer: 'cos B = 1/5',
    errorType: 'calculation',
    knowledgePoints: ['余弦定理', '三角形'],
    source: 'solve',
  },
  {
    id: 'seed-ineq-001',
    problemText: '解不等式组：2x - 3 > 5 且 x + 1 ≤ 4，求 x 的取值范围。',
    userAnswer: 'x > 4 且 x ≤ 3，无解',
    correctAnswer: '无解',
    errorType: 'careless',
    knowledgePoints: ['不等式', '不等式组'],
    source: 'solve',
  },
  {
    id: 'seed-calc-001',
    problemText: '已知函数 f(x) = x³ - 3x² + 2x，求 f(x) 的极值点及极值。',
    userAnswer: '极大值点 x=0, 极大值 0；极小值点 x=2, 极小值 -4',
    correctAnswer: '极大值点 x=0, 极大值 0；极小值点 x=2, 极小值 -4',
    errorType: 'reasoning',
    knowledgePoints: ['导数', '极值', '函数'],
    source: 'solve',
  },
  {
    id: 'seed-prob-001',
    problemText: '从 5 名男生和 4 名女生中选出 3 人组成小组，要求至少有 1 名女生，问有多少种选法？',
    userAnswer: 'C(4,1) × C(8,2) = 4 × 28 = 112',
    correctAnswer: 'C(9,3) - C(5,3) = 84 - 10 = 74',
    errorType: 'reasoning',
    knowledgePoints: ['排列组合', '概率'],
    source: 'solve',
  },
  {
    id: 'seed-seq-001',
    problemText: '已知等差数列 {aₙ} 的前 n 项和 Sₙ = 3n² + 2n，求通项公式 aₙ。',
    userAnswer: 'aₙ = 6n - 1',
    correctAnswer: 'aₙ = 6n - 1',
    errorType: 'calculation',
    knowledgePoints: ['等差数列', '数列求和'],
    source: 'solve',
  },
  {
    id: 'seed-line-001',
    problemText: '已知直线 l₁: 3x + 4y - 5 = 0 与直线 l₂: 6x + 8y + c = 0 平行，且两直线之间的距离为 2，求 c 的值。',
    userAnswer: 'c = 15 或 c = -25',
    correctAnswer: 'c = 15 或 c = -25',
    errorType: 'reading',
    knowledgePoints: ['直线方程', '点到直线距离'],
    source: 'solve',
  },
  {
    id: 'seed-tangent-001',
    problemText: '求曲线 y = x² 在点 (1, 1) 处的切线方程。',
    userAnswer: 'y = 2x - 1',
    correctAnswer: 'y = 2x - 1',
    errorType: 'concept',
    knowledgePoints: ['导数', '切线方程'],
    source: 'solve',
  },
  {
    id: 'seed-dist-001',
    problemText: '已知随机变量 X ~ B(10, 0.3)，求 E(X) 和 D(X)。',
    userAnswer: 'E(X) = 3, D(X) = 2.1',
    correctAnswer: 'E(X) = 3, D(X) = 2.1',
    errorType: 'careless',
    knowledgePoints: ['二项分布', '期望', '方差'],
    source: 'solve',
  },
  {
    id: 'seed-vec-001',
    problemText: '在空间直角坐标系中，已知点 A(1, 2, 3) 和点 B(4, 5, 6)，求向量 AB 的模和方向余弦。',
    userAnswer: '|AB| = 3√3, cosα=1/√3, cosβ=1/√3, cosγ=1/√3',
    correctAnswer: '|AB| = 3√3, cosα=1/√3, cosβ=1/√3, cosγ=1/√3',
    errorType: 'calculation',
    knowledgePoints: ['空间向量', '方向余弦'],
    source: 'solve',
  },
  {
    id: 'seed-ellipse-001',
    problemText: '已知椭圆的焦点在 x 轴上，焦距为 4，离心率为 1/2，求椭圆的标准方程。',
    userAnswer: 'x²/16 + y²/12 = 1',
    correctAnswer: 'x²/16 + y²/12 = 1',
    errorType: 'concept',
    knowledgePoints: ['椭圆', '离心率'],
    source: 'solve',
  },
  {
    id: 'seed-int-001',
    problemText: '求定积分 ∫₀¹ (x² + 2x + 1) dx 的值。',
    userAnswer: '7/3',
    correctAnswer: '7/3',
    errorType: 'reading',
    knowledgePoints: ['定积分', '积分计算'],
    source: 'solve',
  },
  {
    id: 'seed-complex-001',
    problemText: '已知复数 z 满足 |z - 1| = |z - i|，求 z 在复平面上对应点的轨迹方程。',
    userAnswer: 'x = y',
    correctAnswer: 'x = y',
    errorType: 'reasoning',
    knowledgePoints: ['复数', '轨迹方程'],
    source: 'solve',
  },
  {
    id: 'seed-triangle-001',
    problemText: '在 △ABC 中，已知 a=3, b=4, c=5，判断三角形的形状并求其内切圆半径。',
    userAnswer: '直角三角形，r = 1',
    correctAnswer: '直角三角形，r = 1',
    errorType: 'careless',
    knowledgePoints: ['三角形', '内切圆'],
    source: 'solve',
  },
  {
    id: 'seed-log-001',
    problemText: '已知函数 f(x) = log₂(x² - 3x + 2)，求 f(x) 的定义域。',
    userAnswer: '(-∞, 1) ∪ (2, +∞)',
    correctAnswer: '(-∞, 1) ∪ (2, +∞)',
    errorType: 'concept',
    knowledgePoints: ['对数函数', '定义域'],
    source: 'solve',
  },
];

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return apiError(API_ERROR_CODES.FORBIDDEN, 403, '仅限开发环境');
  }

  const body = await req.json().catch(() => ({}));
  const clearOnly = body.clear === true;

  const userId = (body.userId as string | undefined) ?? 'dev-seed-user';

  try {
    const dao = await createMistakeBookDAO(await getServerStorage());

    // Clear existing
    const { items: existing } = await dao.list(userId, { page: 1, pageSize: 9999 });
    for (const item of existing) {
      await dao.delete(userId, item.id);
    }
    log.info(`Cleared ${existing.length} existing mistakes`);

    if (clearOnly) {
      return apiSuccess({ cleared: existing.length, seeded: 0 });
    }

    // Seed new
    const now = Date.now();
    let seeded = 0;
    for (const s of SAMPLE_MISTAKES) {
      const offset = Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
      const solvedAt = now - offset;

      await dao.add(userId, {
        id: s.id,
        problemText: s.problemText,
        userAnswer: s.userAnswer,
        correctAnswer: s.correctAnswer,
        errorType: s.errorType,
        knowledgePoints: s.knowledgePoints,
        source: s.source,
      });

      // Set a realistic lastReview / nextReview
      await dao.update(userId, s.id, {
        lastReview: solvedAt,
        nextReview: solvedAt + 1 * 24 * 60 * 60 * 1000, // due tomorrow
      });

      seeded++;
    }

    log.info(`Seeded ${seeded} mistakes`);
    return apiSuccess({ cleared: existing.length, seeded });
  } catch (err) {
    log.error('Seed mistakes error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '数据填充失败');
  }
}

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return apiError(API_ERROR_CODES.FORBIDDEN, 403, '仅限开发环境');
  }

  const url = new URL(req.url);
  const clearOnly = url.searchParams.get('clear') === 'true';
  const userId = url.searchParams.get('userId') ?? 'dev-seed-user';

  try {
    const dao = await createMistakeBookDAO(await getServerStorage());
    const { items: existing } = await dao.list(userId, { page: 1, pageSize: 9999 });

    for (const item of existing) {
      await dao.delete(userId, item.id);
    }

    if (clearOnly) {
      return apiSuccess({ cleared: existing.length, seeded: 0 });
    }

    const now = Date.now();
    let seeded = 0;
    for (const s of SAMPLE_MISTAKES) {
      const offset = Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
      const solvedAt = now - offset;

      await dao.add(userId, {
        id: s.id,
        problemText: s.problemText,
        userAnswer: s.userAnswer,
        correctAnswer: s.correctAnswer,
        errorType: s.errorType,
        knowledgePoints: s.knowledgePoints,
        source: s.source,
      });

      // Set a realistic lastReview / nextReview
      await dao.update(userId, s.id, {
        lastReview: solvedAt,
        nextReview: solvedAt + 1 * 24 * 60 * 60 * 1000,
      });

      seeded++;
    }

    log.info(`GET seeded ${seeded} mistakes`);
    return apiSuccess({ cleared: existing.length, seeded });
  } catch (err) {
    log.error('Seed mistakes GET error:', err);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '数据填充失败');
  }
}
