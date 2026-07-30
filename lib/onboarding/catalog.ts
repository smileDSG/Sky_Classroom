export interface CatalogOption<T extends string = string> {
  id: T;
  label: string;
}

export const PRODUCT_IDENTITIES = [
  'learner',
  'educator',
  'guardian',
  'education-manager',
  'other',
] as const;

export const PROFILE_STAGES = [
  'preschool',
  'primary',
  'middle',
  'high',
  'vocational',
  'undergraduate',
  'postgraduate',
  'professional',
  'other',
] as const;

export type ProductIdentity = (typeof PRODUCT_IDENTITIES)[number];
export type ProfileStage = (typeof PROFILE_STAGES)[number];

export const IDENTITY_LABELS: Record<ProductIdentity, string> = {
  learner: '学习者',
  educator: '教师 / 培训者',
  guardian: '家长 / 辅导者',
  'education-manager': '教育管理 / 教研者',
  other: '其他',
};

export const STAGE_LABELS: Record<ProfileStage, string> = {
  preschool: '学前',
  primary: '小学',
  middle: '初中',
  high: '高中',
  vocational: '中职 / 高职',
  undergraduate: '本科',
  postgraduate: '研究生',
  professional: '职业发展 / 成人学习',
  other: '其他',
};

const option = <T extends string>(id: T, label: string): CatalogOption<T> => ({ id, label });

export const DOMAIN_CATALOG_BY_STAGE = {
  preschool: [
    option('language-enlightenment', '语言启蒙'),
    option('early-math', '数学启蒙'),
    option('science-exploration', '科学探索'),
    option('arts', '艺术'),
    option('movement-health', '运动与健康'),
  ],
  primary: [
    option('chinese', '语文'),
    option('math', '数学'),
    option('english', '英语'),
    option('science', '科学'),
    option('ethics-law', '道德与法治'),
    option('information-technology', '信息科技'),
    option('arts', '艺术'),
    option('physical-health', '体育与健康'),
  ],
  middle: [
    option('chinese', '语文'),
    option('math', '数学'),
    option('english', '英语'),
    option('physics', '物理'),
    option('chemistry', '化学'),
    option('biology', '生物'),
    option('history', '历史'),
    option('geography', '地理'),
    option('ethics-law', '道德与法治'),
    option('information-technology', '信息科技'),
    option('arts', '艺术'),
    option('physical-health', '体育与健康'),
  ],
  high: [
    option('chinese', '语文'),
    option('math', '数学'),
    option('english', '英语'),
    option('physics', '物理'),
    option('chemistry', '化学'),
    option('biology', '生物'),
    option('history', '历史'),
    option('geography', '地理'),
    option('politics', '思想政治'),
    option('information-technology', '信息科技'),
    option('general-technology', '通用技术'),
    option('arts', '艺术'),
    option('physical-health', '体育与健康'),
  ],
  vocational: [
    option('professional-foundations', '专业基础'),
    option('practical-training', '实训实践'),
    option('vocational-skills', '职业技能'),
    option('certification', '证书考试'),
    option('communication', '沟通表达'),
    option('digital-literacy', '数字素养'),
  ],
  undergraduate: [
    option('major-core', '专业核心课'),
    option('general-education', '通识课程'),
    option('languages', '语言学习'),
    option('programming', '编程'),
    option('math-statistics', '数学与统计'),
    option('research-methods', '研究方法'),
    option('career-development', '职业发展'),
  ],
  postgraduate: [
    option('discipline-specialty', '学科专业'),
    option('research-methods', '研究方法'),
    option('academic-writing', '学术写作'),
    option('data-analysis', '数据分析'),
    option('literature-review', '文献综述'),
    option('career-development', '职业发展'),
  ],
  professional: [
    option('workplace-skills', '职场技能'),
    option('certification', '证书考试'),
    option('languages', '语言学习'),
    option('digital-tools', '数字工具'),
    option('management', '管理能力'),
    option('communication', '沟通表达'),
  ],
  other: [
    option('languages', '语言'),
    option('math', '数学'),
    option('science', '科学'),
    option('humanities', '人文'),
    option('technology', '技术'),
    option('arts', '艺术'),
    option('health', '健康'),
  ],
} as const satisfies Record<ProfileStage, readonly CatalogOption[]>;

const OPEN_DOMAIN_STAGES = new Set<ProfileStage>([
  'vocational',
  'undergraduate',
  'postgraduate',
  'professional',
  'other',
]);

export function isOpenDomainStage(stage: ProfileStage): boolean {
  return OPEN_DOMAIN_STAGES.has(stage);
}

export function getDomainsForStage(stage: ProfileStage): readonly CatalogOption[] {
  return DOMAIN_CATALOG_BY_STAGE[stage];
}

export const LEARNER_GOALS = [
  option('improve-grades', '提升表现'),
  option('exam-prep', '准备考试'),
  option('build-foundations', '巩固基础'),
  option('explore-interest', '探索兴趣'),
  option('career-skills', '培养职业能力'),
] as const;
export const EDUCATOR_GOALS = [
  option('prepare-lessons', '备课'),
  option('create-materials', '制作教学材料'),
  option('classroom-interaction', '改善课堂互动'),
  option('design-assessment', '设计评价'),
  option('professional-development', '专业发展'),
] as const;
export const GUARDIAN_GOALS = [
  option('homework-support', '作业辅导'),
  option('learning-habits', '培养学习习惯'),
  option('address-gaps', '补足知识缺口'),
  option('develop-interests', '发展兴趣'),
  option('family-learning-communication', '改善家庭学习沟通'),
] as const;
export const EDUCATION_MANAGER_GOALS = [
  option('curriculum-planning', '课程规划'),
  option('resource-governance', '资源治理'),
  option('teaching-quality', '提升教学质量'),
  option('learning-data-analysis', '分析学习数据'),
  option('educator-development', '教师发展'),
] as const;
export const OTHER_GOALS = [
  option('acquire-knowledge', '获取知识'),
  option('complete-project', '完成项目'),
  option('certification-prep', '准备认证'),
  option('career-skills', '发展职业能力'),
  option('explore-interests', '探索兴趣'),
] as const;

export const LEARNER_NEEDS = [
  option('identify-gaps', '定位薄弱点'),
  option('learning-plan', '制定学习计划'),
  option('clearer-explanations', '获得清晰讲解'),
  option('practice-feedback', '练习与反馈'),
  option('motivation', '保持学习动力'),
] as const;
export const EDUCATOR_NEEDS = [
  option('differentiated-instruction', '分层教学'),
  option('question-design', '问题设计'),
  option('resource-adaptation', '资源改编'),
  option('feedback-support', '反馈支持'),
  option('reduce-repetitive-work', '减少重复工作'),
] as const;
export const GUARDIAN_NEEDS = [
  option('age-appropriate-guidance', '符合年龄的引导'),
  option('hint-strategy', '提示策略'),
  option('short-session-plan', '短时辅导计划'),
  option('understand-progress', '理解学习进展'),
  option('resource-selection', '选择学习资源'),
] as const;
export const EDUCATION_MANAGER_NEEDS = [
  option('standards-alignment', '标准对齐'),
  option('content-organization', '内容组织'),
  option('cohort-comparison', '群体比较'),
  option('report-generation', '报告生成'),
  option('cross-team-collaboration', '跨团队协作'),
] as const;
export const OTHER_NEEDS = [
  option('learning-path', '学习路径'),
  option('material-selection', '材料选择'),
  option('practice-feedback', '练习反馈'),
  option('ai-collaboration', 'AI 协作'),
  option('time-planning', '时间规划'),
] as const;

export const LEARNER_PREFERENCES = [
  option('example-first', '示例优先'),
  option('visual-explanation', '图示讲解'),
  option('step-by-step', '分步讲解'),
  option('practice-first', '练习优先'),
  option('balanced', '均衡安排'),
] as const;
export const EDUCATOR_PREFERENCES = [
  option('lesson-plan-structure', '教案结构'),
  option('classroom-interaction', '课堂互动'),
  option('difficulty-progression', '难度递进'),
  option('material-presentation', '材料呈现'),
  option('balanced', '均衡支持'),
] as const;
export const GUARDIAN_PREFERENCES = [
  option('step-by-step-guidance', '分步引导'),
  option('hint-first', '提示优先'),
  option('encouraging-feedback', '鼓励反馈'),
  option('short-session', '短时辅导'),
  option('balanced', '均衡安排'),
] as const;
export const EDUCATION_MANAGER_PREFERENCES = [
  option('overview-analysis', '概览分析'),
  option('detailed-reporting', '详细报告'),
  option('resource-organization', '资源组织'),
  option('cross-group-comparison', '跨群体比较'),
  option('balanced', '均衡呈现'),
] as const;
export const OTHER_PREFERENCES = [
  option('structured-content', '结构化内容'),
  option('visual-content', '视觉内容'),
  option('interactive-practice', '互动练习'),
  option('conversational-guidance', '对话引导'),
  option('balanced', '均衡协作'),
] as const;

export const IDENTITY_CONFIG = {
  learner: {
    label: IDENTITY_LABELS.learner,
    stageQuestion: '你目前处于哪个学习阶段？',
    domainQuestion: '你想学习或重点提升哪些领域？',
    goals: LEARNER_GOALS,
    needs: LEARNER_NEEDS,
    preferences: LEARNER_PREFERENCES,
    preferenceLabel: '你更喜欢怎样学习？',
    multipleContexts: false,
  },
  educator: {
    label: IDENTITY_LABELS.educator,
    stageQuestion: '你主要教授哪些学习阶段？',
    domainQuestion: '你主要教授哪些领域？',
    goals: EDUCATOR_GOALS,
    needs: EDUCATOR_NEEDS,
    preferences: EDUCATOR_PREFERENCES,
    preferenceLabel: '你最希望 AI 优先支持什么？',
    multipleContexts: true,
  },
  guardian: {
    label: IDENTITY_LABELS.guardian,
    stageQuestion: '你主要支持哪个学习阶段？',
    domainQuestion: '你主要协助哪些领域？',
    goals: GUARDIAN_GOALS,
    needs: GUARDIAN_NEEDS,
    preferences: GUARDIAN_PREFERENCES,
    preferenceLabel: '你更偏好怎样的辅导方式？',
    multipleContexts: true,
  },
  'education-manager': {
    label: IDENTITY_LABELS['education-manager'],
    stageQuestion: '你服务或管理哪些学习阶段？',
    domainQuestion: '你关注哪些教育领域？',
    goals: EDUCATION_MANAGER_GOALS,
    needs: EDUCATION_MANAGER_NEEDS,
    preferences: EDUCATION_MANAGER_PREFERENCES,
    preferenceLabel: '你最关注怎样的信息呈现？',
    multipleContexts: true,
  },
  other: {
    label: IDENTITY_LABELS.other,
    stageQuestion: '哪个阶段最接近你的当前场景？',
    domainQuestion: '你关注哪些领域？',
    goals: OTHER_GOALS,
    needs: OTHER_NEEDS,
    preferences: OTHER_PREFERENCES,
    preferenceLabel: '你更希望怎样与 AI 协作？',
    multipleContexts: false,
  },
} as const;

export function getIdentityConfig(identity: ProductIdentity) {
  return IDENTITY_CONFIG[identity];
}
