import type { Subject } from '@/lib/solve/agents/analyze-types';

export type KnowledgeStage = 'senior-high' | 'university' | 'general';
export type KnowledgeSubject = Subject | 'computer-science' | 'artificial-intelligence';

export interface CanonicalKnowledgePoint {
  id: string;
  name: string;
  stage: KnowledgeStage;
  subject: KnowledgeSubject;
  course: string;
  aliases: string[];
}

const KNOWLEDGE_POINTS: CanonicalKnowledgePoint[] = [
  {
    id: 'functions-basic',
    name: '函数基础',
    stage: 'senior-high',
    subject: 'math',
    course: '高中数学',
    aliases: ['函数基础', '函数', 'function', 'domain and range', 'function definition'],
  },
  {
    id: 'hs-physics-electromagnetic-induction',
    name: '高中物理·电磁感应',
    stage: 'senior-high',
    subject: 'physics',
    course: '高中物理',
    aliases: ['高中物理·电磁感应', '电磁感应'],
  },
  {
    id: 'hs-chemistry-chemical-equilibrium',
    name: '高中化学·化学平衡',
    stage: 'senior-high',
    subject: 'chemistry',
    course: '高中化学',
    aliases: ['高中化学·化学平衡', '化学平衡'],
  },
  {
    id: 'hs-biology-genetics',
    name: '高中生物·遗传规律',
    stage: 'senior-high',
    subject: 'biology',
    course: '高中生物',
    aliases: ['高中生物·遗传规律', '遗传规律'],
  },
  {
    id: 'hs-english-past-perfect',
    name: '高中英语·过去完成时',
    stage: 'senior-high',
    subject: 'english',
    course: '高中英语',
    aliases: ['高中英语·过去完成时', '过去完成时', 'past perfect'],
  },
  {
    id: 'hs-history-industrial-revolution',
    name: '高中历史·工业革命',
    stage: 'senior-high',
    subject: 'history',
    course: '高中历史',
    aliases: ['高中历史·工业革命', '工业革命'],
  },
  {
    id: 'hs-geography-ocean-current',
    name: '高中地理·洋流',
    stage: 'senior-high',
    subject: 'geography',
    course: '高中地理',
    aliases: ['高中地理·洋流', '洋流'],
  },
  {
    id: 'uni-math-multivariable-calculus',
    name: '大学高等数学·多元微积分',
    stage: 'university',
    subject: 'math',
    course: '高等数学',
    aliases: ['大学高等数学·多元微积分', '多元微积分'],
  },
  {
    id: 'uni-linear-algebra-eigenvalue',
    name: '大学线性代数·特征值',
    stage: 'university',
    subject: 'math',
    course: '线性代数',
    aliases: ['大学线性代数·特征值', '线代特征值', '特征值'],
  },
  {
    id: 'uni-cs-dynamic-programming',
    name: '大学计算机·动态规划',
    stage: 'university',
    subject: 'computer-science',
    course: '算法设计',
    aliases: ['大学计算机·动态规划', '动态规划', 'dynamic programming'],
  },
  {
    id: 'uni-ai-rag',
    name: '大学人工智能·RAG',
    stage: 'university',
    subject: 'artificial-intelligence',
    course: '人工智能',
    aliases: ['大学人工智能·RAG', 'RAG', '检索增强生成'],
  },
];

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[•・]/g, '·')
    .replace(/\s+/g, '');
}

const BY_ID = new Map(KNOWLEDGE_POINTS.map((point) => [point.id, point]));
const BY_ALIAS = new Map<string, CanonicalKnowledgePoint>();

for (const point of KNOWLEDGE_POINTS) {
  for (const alias of [point.name, ...point.aliases]) {
    BY_ALIAS.set(normalize(alias), point);
  }
}

function generatedId(value: string): string {
  const normalized = normalize(value);
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (slug) return `kp-${slug}`;

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(index);
    hash |= 0;
  }
  return `kp-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

export function resolveKnowledgePoint(value: string): CanonicalKnowledgePoint | null {
  const trimmed = value.trim();
  return BY_ID.get(trimmed) ?? BY_ALIAS.get(normalize(trimmed)) ?? null;
}

export function canonicalizeKnowledgePoint(value: string): CanonicalKnowledgePoint {
  const trimmed = value.trim();
  const known = resolveKnowledgePoint(trimmed);
  if (known) return known;

  return {
    id: generatedId(trimmed),
    name: trimmed,
    stage: 'general',
    subject: 'unknown',
    course: '未分类',
    aliases: [trimmed],
  };
}

export function sameKnowledgePoint(left: string, right: string): boolean {
  return canonicalizeKnowledgePoint(left).id === canonicalizeKnowledgePoint(right).id;
}
