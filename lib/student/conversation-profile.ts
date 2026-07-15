export type ConversationProfileStage = 'onboarding' | 'learning' | 'review';

export interface ConversationalProfileDimension<T> {
  value: T;
  confidence: number;
  evidence: string[];
}

export interface ConversationalKnowledgeBasePatch {
  strongPoints: string[];
  weakPoints: string[];
  confidence: number;
  evidence: string[];
}

export interface ConversationalProfilePatch {
  majorBackground?: ConversationalProfileDimension<string>;
  learningGoal?: ConversationalProfileDimension<string>;
  knowledgeBase?: ConversationalKnowledgeBasePatch;
  cognitiveStyle?: ConversationalProfileDimension<string>;
  errorPatternPreference?: ConversationalProfileDimension<string[]>;
  resourcePreference?: ConversationalProfileDimension<string[]>;
  interactionPreference?: ConversationalProfileDimension<string>;
  learningPace?: ConversationalProfileDimension<string>;
  currentLearningState?: ConversationalProfileDimension<string>;
}

export interface ConversationProfileExtractionInput {
  message: string;
  stage?: ConversationProfileStage;
}

export interface ConversationProfileExtractionResult {
  stage: ConversationProfileStage;
  profilePatch: ConversationalProfilePatch;
  evidence: string[];
  nextQuestion: string;
  needsConfirmation: boolean;
}

interface KeywordRule {
  label: string;
  patterns: RegExp[];
}

const SUBJECT_RULES: KeywordRule[] = [
  { label: 'AI', patterns: [/人工智能|AI|ai/i] },
  { label: '机器学习', patterns: [/机器学习|machine learning|ML\b/i] },
  { label: 'Python', patterns: [/Python/i] },
  { label: '数学', patterns: [/数学|微积分|线性代数|概率论/] },
  { label: 'RAG', patterns: [/RAG|检索增强|向量检索/i] },
];

const WEAK_POINT_RULES: KeywordRule[] = [
  { label: '过拟合', patterns: [/过拟合|泛化/] },
  { label: '模型评估', patterns: [/模型评估|评价指标|准确率|召回率|F1/i] },
  { label: 'RAG', patterns: [/RAG|检索增强|向量检索/i] },
  { label: '极限', patterns: [/极限|洛必达/] },
  { label: '代码实践', patterns: [/代码|编程|实操|项目|Python/i] },
];

const RESOURCE_RULES: KeywordRule[] = [
  { label: '代码案例', patterns: [/代码|Python|案例|实操/i] },
  { label: '图解', patterns: [/图解|流程图|思维导图|可视化/] },
  { label: '练习', patterns: [/练习|刷题|题目|小测/] },
  { label: '视频', patterns: [/视频|动画/] },
  { label: '文字总结', patterns: [/文字|总结|讲义/] },
];

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function matchesRule(text: string, rule: KeywordRule): boolean {
  return rule.patterns.some((pattern) => pattern.test(text));
}

function collectLabels(text: string, rules: KeywordRule[]): string[] {
  return rules.filter((rule) => matchesRule(text, rule)).map((rule) => rule.label);
}

function collectEvidence(text: string, candidates: string[]): string[] {
  return candidates.filter((candidate) => text.toLowerCase().includes(candidate.toLowerCase()));
}

function inferMajorBackground(text: string): ConversationalProfileDimension<string> | undefined {
  const majorMatch = text.match(/(?:我是|我学|专业是)(.{2,18}?)(?:专业|学生|同学|，|,|。|$)/);
  if (!majorMatch?.[1]) return undefined;

  const value = majorMatch[1].includes('专业') ? majorMatch[1] : `${majorMatch[1]}专业`;
  return {
    value,
    confidence: 0.78,
    evidence: [majorMatch[0].replace(/[，,。]$/, '')],
  };
}

function inferLearningGoal(
  text: string,
  subjects: string[],
): ConversationalProfileDimension<string> | undefined {
  const explicitGoal = text.match(
    /(?:想|希望|打算|需要|准备).{0,8}?(?:学|提升|补|掌握|复习)(.{1,30}?)(?:，|,|。|；|;|$)/,
  );
  const value = explicitGoal?.[1]?.trim() || subjects[0];
  if (!value) return undefined;

  const cleanValue = value
    .replace(/^一下/, '')
    .replace(/^一下子/, '')
    .replace(/^一下/, '')
    .trim();

  const explicitEvidence = explicitGoal?.[0]?.replace(/[，,。；;]$/, '');

  return {
    value: cleanValue || value,
    confidence: explicitGoal ? 0.84 : 0.68,
    evidence: unique([
      ...(explicitEvidence ? [explicitEvidence] : []),
      ...collectEvidence(text, subjects),
    ]),
  };
}

function inferLearningPace(text: string): ConversationalProfileDimension<string> | undefined {
  const deadlineMatch = text.match(/(?:两周|一周|下个月|月底|明天|考试|比赛|截止|ddl|deadline)/i);
  if (!deadlineMatch) return undefined;

  const value =
    deadlineMatch[0] === '两周' ? '两周内完成一轮补强' : `存在时间压力：${deadlineMatch[0]}`;
  return {
    value,
    confidence: 0.82,
    evidence: [deadlineMatch[0]],
  };
}

function inferInteractionPreference(
  text: string,
): ConversationalProfileDimension<string> | undefined {
  if (/直接|步骤|一步步|别讲原理|先给答案/.test(text)) {
    return {
      value: '步骤优先',
      confidence: 0.8,
      evidence: collectEvidence(text, ['直接', '步骤', '一步步', '别讲原理', '先给答案']),
    };
  }

  if (/原理|讲透|为什么|推导/.test(text)) {
    return {
      value: '原理优先',
      confidence: 0.76,
      evidence: collectEvidence(text, ['原理', '讲透', '为什么', '推导']),
    };
  }

  return undefined;
}

function inferCurrentLearningState(
  text: string,
): ConversationalProfileDimension<string> | undefined {
  const emotions = collectEvidence(text, ['焦虑', '挫败', '着急', '压力', '看不懂', '搞不懂']);
  if (emotions.length === 0) return undefined;

  return {
    value: `当前状态包含${emotions.join('、')}信号，适合降低解释负荷并及时确认理解。`,
    confidence: 0.72,
    evidence: emotions,
  };
}

function buildNextQuestion(input: {
  patch: ConversationalProfilePatch;
  needsConfirmation: boolean;
}): string {
  if (input.needsConfirmation) {
    const goal = input.patch.learningGoal?.value ?? '当前目标';
    const weakPoints = input.patch.knowledgeBase?.weakPoints.join('、') || '待确认薄弱点';
    const style =
      input.patch.interactionPreference?.value ??
      input.patch.resourcePreference?.value.join('、') ??
      '适合你的讲解方式';
    return `我先按这个画像来：目标是${goal}，当前薄弱点是${weakPoints}，讲解方式偏${style}。对吗？`;
  }

  if (!input.patch.knowledgeBase || input.patch.knowledgeBase.weakPoints.length === 0) {
    return '你现在主要卡在哪里？是完全没入门，还是有基础但做题或项目容易断？';
  }

  if (!input.patch.resourcePreference) {
    return '你更希望我怎么带你学？直接给步骤、先讲原理、用例子带，还是多给练习？';
  }

  return '这件事有没有时间压力？比如考试、作业、比赛、项目截止。';
}

export function extractConversationProfile(
  input: ConversationProfileExtractionInput,
): ConversationProfileExtractionResult {
  const text = input.message.trim();
  const stage = input.stage ?? 'onboarding';
  const subjects = collectLabels(text, SUBJECT_RULES);
  const weakPoints = collectLabels(text, WEAK_POINT_RULES);
  const resourcePreference = collectLabels(text, RESOURCE_RULES);
  const patch: ConversationalProfilePatch = {};

  const majorBackground = inferMajorBackground(text);
  if (majorBackground) patch.majorBackground = majorBackground;

  const learningGoal = inferLearningGoal(text, subjects);
  if (learningGoal) patch.learningGoal = learningGoal;

  if (weakPoints.length > 0 || /卡|不会|不懂|搞不懂|薄弱|断/.test(text)) {
    patch.knowledgeBase = {
      strongPoints: [],
      weakPoints: unique(weakPoints),
      confidence: weakPoints.length > 0 ? 0.82 : 0.58,
      evidence: unique([
        ...collectEvidence(text, weakPoints),
        ...collectEvidence(text, ['卡', '不会', '不懂', '搞不懂']),
      ]),
    };
  }

  if (resourcePreference.length > 0) {
    patch.resourcePreference = {
      value: unique(resourcePreference),
      confidence: 0.82,
      evidence: collectEvidence(text, resourcePreference),
    };
  }

  const interactionPreference = inferInteractionPreference(text);
  if (interactionPreference) patch.interactionPreference = interactionPreference;

  const learningPace = inferLearningPace(text);
  if (learningPace) patch.learningPace = learningPace;

  const currentLearningState = inferCurrentLearningState(text);
  if (currentLearningState) patch.currentLearningState = currentLearningState;

  if (resourcePreference.includes('图解')) {
    patch.cognitiveStyle = {
      value: '具象化理解',
      confidence: 0.7,
      evidence: collectEvidence(text, ['图解', '流程图', '思维导图', '可视化']),
    };
  }

  const evidence = unique(
    Object.values(patch).flatMap((dimension) => {
      if (!dimension) return [];
      if ('evidence' in dimension) return dimension.evidence;
      return [];
    }),
  );
  const coveredCoreFields = [
    Boolean(patch.learningGoal),
    Boolean(patch.knowledgeBase?.weakPoints.length),
    Boolean(patch.resourcePreference || patch.interactionPreference),
  ].filter(Boolean).length;
  const needsConfirmation =
    coveredCoreFields >= 3 || (stage !== 'onboarding' && coveredCoreFields >= 2);

  return {
    stage,
    profilePatch: patch,
    evidence,
    nextQuestion: buildNextQuestion({ patch, needsConfirmation }),
    needsConfirmation,
  };
}
