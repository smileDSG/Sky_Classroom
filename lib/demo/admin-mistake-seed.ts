import {
  learningEventSchema,
  type DomainLearnerProfile,
  type LearnerPreferences,
  type LearningEvent,
} from '@/lib/adaptive-learning/contracts';
import { applyLearningEvent } from '@/lib/adaptive-learning/profile/knowledge-state-engine';
import { LearnerProfileRepository } from '@/lib/adaptive-learning/profile/repository';
import {
  createMistakeBookDAO,
  type ErrorType,
  type MistakeBookEntry,
} from '@/lib/storage/dao/mistakes';
import type { StorageProvider } from '@/lib/storage/storage-types';
import { StorageEntryAlreadyExistsError } from '@/lib/storage/storage-errors';

interface MistakeDAO {
  list: (userId: string, opts: { pageSize: number }) => Promise<{ items: MistakeBookEntry[] }>;
  delete: (userId: string, id: string) => Promise<boolean>;
  add: (
    userId: string,
    entry: Omit<MistakeBookEntry, 'userId' | 'reviewCount' | 'masteryLevel' | 'reviewed'>,
  ) => Promise<void>;
  update: (
    userId: string,
    id: string,
    patch: Partial<Omit<MistakeBookEntry, 'id' | 'userId'>>,
  ) => Promise<boolean>;
}

const ADMIN_ID = 'admin-default';
const DEMO_ID = 'demo-default';
const DEMO_USER_IDS = new Set([ADMIN_ID, DEMO_ID]);
const SEED_VERSION = 'v4';
const EVIDENCE_SOURCE = 'demo-learning-evidence-v1';
const DEMO_PLANNING_PROFILE_VERSION = 'demo-cross-stage-v1';

function seedPrefix(userId: string): string {
  return `${userId}-knowledge-${SEED_VERSION}-`;
}

const SEEDS: Array<{
  id: string;
  problemText: string;
  userAnswer: string;
  correctAnswer: string;
  errorType: ErrorType;
  errorExplanation: string;
  knowledgePoints: string[];
}> = [
  {
    id: 'hs-calculus',
    problemText: '已知 f(x)=x³-3x²+2，求函数的单调区间与极值。',
    userAnswer: '在全体实数上单调递增',
    correctAnswer: '递增区间为 (-∞,0) 与 (2,+∞)，递减区间为 (0,2)；极大值 2，极小值 -2',
    errorType: 'concept',
    errorExplanation: '未先求导并分析导数符号。',
    knowledgePoints: ['高中数学·导数', '函数单调性', '极值'],
  },
  {
    id: 'hs-vector',
    problemText: '空间中 a=(1,2,-1)，b=(2,-1,3)，求 a·b。',
    userAnswer: '6',
    correctAnswer: '-3',
    errorType: 'calculation',
    errorExplanation: '第三个分量乘积符号计算错误。',
    knowledgePoints: ['高中数学·空间向量', '向量数量积'],
  },
  {
    id: 'hs-physics',
    problemText: '闭合线圈中的磁通量均匀增大，说明感应电流磁场方向及依据。',
    userAnswer: '与原磁场同向',
    correctAnswer: '与原磁场反向，依据楞次定律阻碍磁通量增加',
    errorType: 'concept',
    errorExplanation: '混淆了“阻碍变化”和“阻碍原磁场”。',
    knowledgePoints: ['高中物理·电磁感应', '楞次定律'],
  },
  {
    id: 'hs-chemistry',
    problemText: '可逆反应达到平衡后升高温度，吸热方向的反应速率和平衡如何变化？',
    userAnswer: '反应速率不变，平衡不移动',
    correctAnswer: '正逆反应速率均增大，平衡向吸热方向移动',
    errorType: 'reasoning',
    errorExplanation: '未区分温度对速率和平衡常数的影响。',
    knowledgePoints: ['高中化学·化学平衡', '反应速率'],
  },
  {
    id: 'uni-calculus',
    problemText: '求二元函数 f(x,y)=x²y+eʸ 在点 (1,0) 处的梯度。',
    userAnswer: '∇f=(2,1)',
    correctAnswer: '∇f=(0,2)',
    errorType: 'calculation',
    errorExplanation: '偏导后代入坐标时计算错误。',
    knowledgePoints: ['大学高等数学·多元微积分', '偏导数', '梯度'],
  },
  {
    id: 'uni-linear',
    problemText: '矩阵 A=[[2,1],[1,2]] 的特征值是什么？',
    userAnswer: '2 和 2',
    correctAnswer: '3 和 1',
    errorType: 'reasoning',
    errorExplanation: '未使用 det(A-λI)=0 求特征方程。',
    knowledgePoints: ['大学线性代数·矩阵', '特征值'],
  },
  {
    id: 'uni-algorithm',
    problemText: '0-1 背包为何不能直接使用“单位价值最高优先”的贪心策略？',
    userAnswer: '任何背包问题都可用贪心得到最优解',
    correctAnswer: '物品不可分割，局部最优选择可能阻断全局最优组合，应使用动态规划',
    errorType: 'concept',
    errorExplanation: '混淆了分数背包与 0-1 背包。',
    knowledgePoints: ['大学计算机·算法设计', '动态规划', '0-1背包'],
  },
  {
    id: 'uni-rag',
    problemText: 'RAG 系统回答有引用但内容不相关，最先应检查哪个环节？',
    userAnswer: '只需增大生成模型参数量',
    correctAnswer: '先检查分块、嵌入、召回结果与重排序质量',
    errorType: 'reasoning',
    errorExplanation: '忽略了检索证据质量对生成结果的上游影响。',
    knowledgePoints: ['大学人工智能·RAG', '向量检索', '重排序'],
  },
  {
    id: 'hs-biology',
    problemText: '一对表现正常的夫妇生出白化病孩子，判断白化病遗传方式及再生患儿概率。',
    userAnswer: '显性遗传，概率为 1/2',
    correctAnswer: '常染色体隐性遗传，双方均为携带者，再生患儿概率为 1/4',
    errorType: 'concept',
    errorExplanation: '未根据正常父母生出患儿反推隐性遗传。',
    knowledgePoints: ['高中生物·遗传规律', '基因分离定律'],
  },
  {
    id: 'hs-english',
    problemText: '选择正确形式：By the time he arrived, the meeting ____.',
    userAnswer: 'has started',
    correctAnswer: 'had started',
    errorType: 'reading',
    errorExplanation: '忽略了过去时间点之前已完成动作，应使用过去完成时。',
    knowledgePoints: ['高中英语·时态', '过去完成时'],
  },
  {
    id: 'hs-history',
    problemText: '概括工业革命首先发生在英国的主要条件。',
    userAnswer: '英国人口最多',
    correctAnswer: '政治制度稳定、资本积累、市场扩大、劳动力与技术条件共同作用',
    errorType: 'reasoning',
    errorExplanation: '使用单一因素解释复杂历史事件。',
    knowledgePoints: ['高中历史·工业革命', '历史事件因果分析'],
  },
  {
    id: 'hs-geography',
    problemText: '说明北大西洋暖流对西欧气候的主要影响。',
    userAnswer: '使西欧夏季更炎热干燥',
    correctAnswer: '增温增湿，使西欧温带海洋性气候更显著',
    errorType: 'concept',
    errorExplanation: '混淆暖流对沿岸气温和降水的综合影响。',
    knowledgePoints: ['高中地理·洋流', '气候影响'],
  },
];

const REVIEW_STATES = [
  { daysAgo: 0, reviewCount: 0 },
  { daysAgo: 1, reviewCount: 1 },
  { daysAgo: 2, reviewCount: 6 },
  { daysAgo: 3, reviewCount: 2 },
  { daysAgo: 4, reviewCount: 6 },
  { daysAgo: 5, reviewCount: 3 },
  { daysAgo: 6, reviewCount: 0 },
  { daysAgo: 7, reviewCount: 6 },
  { daysAgo: 9, reviewCount: 2 },
  { daysAgo: 10, reviewCount: 6 },
  { daysAgo: 12, reviewCount: 1 },
  { daysAgo: 13, reviewCount: 6 },
] as const;

interface EvidenceScenario {
  id: string;
  knowledgePoint: string;
  outcomes: boolean[];
}

const EVIDENCE_SCENARIOS: EvidenceScenario[] = [
  {
    id: 'hs-electromagnetic-induction',
    knowledgePoint: '高中物理·电磁感应',
    outcomes: [false, true, false, false, false],
  },
  {
    id: 'uni-linear-algebra',
    knowledgePoint: '大学线性代数·特征值',
    outcomes: [false, false, true, false, false],
  },
  {
    id: 'hs-chemical-equilibrium',
    knowledgePoint: '高中化学·化学平衡',
    outcomes: [true, false, true, false],
  },
  {
    id: 'uni-multivariable-calculus',
    knowledgePoint: '大学高等数学·多元微积分',
    outcomes: [false, true, true, false, true],
  },
  {
    id: 'hs-past-perfect',
    knowledgePoint: '高中英语·过去完成时',
    outcomes: [true, true, true, true, true],
  },
  {
    id: 'uni-dynamic-programming',
    knowledgePoint: '大学计算机·动态规划',
    outcomes: [true, true, true, true, true],
  },
  {
    id: 'uni-rag',
    knowledgePoint: '大学人工智能·RAG',
    outcomes: [true, false, true, true],
  },
  {
    id: 'hs-genetics',
    knowledgePoint: '高中生物·遗传规律',
    outcomes: [false, false, true, false],
  },
  {
    id: 'hs-industrial-revolution',
    knowledgePoint: '高中历史·工业革命',
    outcomes: [true, true, false, true],
  },
  {
    id: 'hs-ocean-current',
    knowledgePoint: '高中地理·洋流',
    outcomes: [true, false, false, true],
  },
];

interface MistakeSeedResult {
  changed: boolean;
  seeded: number;
}

export interface DemoLearningSeedResult {
  enabled: boolean;
  changed: boolean;
  mistakesSeeded: number;
  evidenceSeeded: number;
}

async function replaceKnowledgeMistakes(
  userId: string,
  dao: MistakeDAO,
): Promise<MistakeSeedResult> {
  const prefix = seedPrefix(userId);
  const current = await dao.list(userId, { pageSize: 99999 });
  if (
    current.items.length === SEEDS.length &&
    current.items.every((item) => item.id.startsWith(prefix))
  )
    return { changed: false, seeded: 0 };

  await Promise.all(current.items.map((item) => dao.delete(userId, item.id)));
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  await Promise.all(
    SEEDS.map(async (seed, index) => {
      const id = `${prefix}${seed.id}`;
      await dao.add(userId, {
        ...seed,
        id,
        source: 'manual',
      });
      const state = REVIEW_STATES[index];
      const reviewed = state.reviewCount >= 6;
      await dao.update(userId, id, {
        reviewCount: state.reviewCount,
        masteryLevel: state.reviewCount,
        reviewed,
        lastReview: now - state.daysAgo * day,
        nextReview: reviewed ? Number.MAX_SAFE_INTEGER : now + ((index % 3) - 1) * day,
      });
    }),
  );

  return { changed: true, seeded: SEEDS.length };
}

async function seedKnowledgeEvidence(
  userId: string,
  storage: StorageProvider,
): Promise<number> {
  const repository = new LearnerProfileRepository(storage);
  const existingEvents = await repository.listLearningEvents(userId);
  const existingEventIds = new Set(existingEvents.map((event) => event.eventId));
  const totalEvents = EVIDENCE_SCENARIOS.reduce(
    (total, scenario) => total + scenario.outcomes.length,
    0,
  );
  const now = Date.now();
  let sequence = 0;
  let seeded = 0;

  for (const scenario of EVIDENCE_SCENARIOS) {
    for (let index = 0; index < scenario.outcomes.length; index += 1) {
      sequence += 1;
      const eventId = `${EVIDENCE_SOURCE}:${scenario.id}:${index + 1}`;
      if (existingEventIds.has(eventId)) continue;

      const event: LearningEvent = learningEventSchema.parse({
        eventId,
        userId,
        type: 'answer-submitted',
        occurredAt: new Date(now - (totalEvents - sequence) * 20 * 60 * 1000).toISOString(),
        source: EVIDENCE_SOURCE,
        nodeIds: [],
        evidenceQuality: 'verified',
        payload: {
          correct: scenario.outcomes[index],
          knowledgePoints: [scenario.knowledgePoint],
        },
        schemaVersion: '1.0.0',
        correlationId: `demo-seed:${scenario.id}`,
      });

      const inserted = await repository.appendLearningEvent(event);
      if (!inserted) continue;
      await applyLearningEvent(userId, event, storage);
      existingEventIds.add(eventId);
      seeded += 1;
    }
  }

  return seeded;
}

async function ensureDemoPlanningProfile(
  userId: string,
  storage: StorageProvider,
): Promise<boolean> {
  const repository = new LearnerProfileRepository(storage);
  const now = new Date().toISOString();
  let changed = false;

  if (!(await repository.getLatestPreferences(userId))) {
    const preferences: LearnerPreferences = {
      userId,
      preferredLanguage: 'zh-CN',
      contentFormatPreferences: ['diagram', 'worked-example', 'interactive'],
      explanationDepth: 'detailed',
      learningPace: 'standard',
      stepByStepMode: 'when-needed',
      interactionTone: 'professional',
      assistantName: '知行助教',
      preferenceNotes: '高中知识衔接大学数学、计算机与人工智能，优先补薄弱点。',
      privacy: {
        conversationMemory: 'persistent',
        optionalBehaviorSignals: true,
        privateKnowledgeRetrieval: true,
      },
      version: 1,
      schemaVersion: '1.0.0',
      updatedAt: now,
      updatedBy: 'system',
    };
    try {
      await repository.insertPreferences(preferences);
      changed = true;
    } catch (error) {
      if (!(error instanceof StorageEntryAlreadyExistsError)) throw error;
    }
  }

  if (!(await repository.getLatestDomainProfile(userId, 'default'))) {
    const domainProfile: DomainLearnerProfile = {
      id: 'default',
      userId,
      subjectId: DEMO_PLANNING_PROFILE_VERSION,
      educationStage: 'undergraduate',
      gradeLevel: '大学二年级（高中衔接）',
      curriculumPackId: 'gaokao-math-2026.1',
      curriculumPackVersion: '2026.1',
      targetNodeIds: [
        'functions-properties',
        'derivative-concept',
        'derivative-applications',
        'solid-geometry',
        'probability',
        'statistics',
      ],
      horizonDays: 28,
      weeklyAvailableMinutes: 390,
      dailyAvailability: {
        mon: 60,
        tue: 60,
        wed: 45,
        thu: 60,
        fri: 45,
        sat: 120,
        sun: 0,
      },
      preferredSessionMinutes: 45,
      constraints: {
        restDays: ['sun'],
        maxDailyMinutes: 120,
        teacherLockedNodeIds: ['derivative-concept'],
      },
      status: 'active',
      version: 1,
      schemaVersion: '1.0.0',
      createdAt: now,
      updatedAt: now,
    };
    try {
      await repository.insertDomainProfile(domainProfile);
      changed = true;
    } catch (error) {
      if (!(error instanceof StorageEntryAlreadyExistsError)) throw error;
    }
  }

  return changed;
}

export async function ensureAdminKnowledgeMistakes(userId: string, dao: MistakeDAO): Promise<void> {
  if (userId !== ADMIN_ID) return;
  await replaceKnowledgeMistakes(userId, dao);
}

export async function ensureDemoLearningData(
  userId: string,
  storage: StorageProvider,
): Promise<DemoLearningSeedResult> {
  if (!DEMO_USER_IDS.has(userId)) {
    return {
      enabled: false,
      changed: false,
      mistakesSeeded: 0,
      evidenceSeeded: 0,
    };
  }

  const planningProfileSeeded = await ensureDemoPlanningProfile(userId, storage);
  const mistakeResult = await replaceKnowledgeMistakes(userId, createMistakeBookDAO(storage));
  const evidenceSeeded = await seedKnowledgeEvidence(userId, storage);

  return {
    enabled: true,
    changed: planningProfileSeeded || mistakeResult.changed || evidenceSeeded > 0,
    mistakesSeeded: mistakeResult.seeded,
    evidenceSeeded,
  };
}
