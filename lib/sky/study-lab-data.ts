import type {
  CloudMindToolTarget,
  PersonalizationContext,
  PersonalizationDifficulty,
  WeakPointSummary,
} from '@/lib/cloud-mind/types';
import type { LearningPlan, LearningTask } from '@/lib/adaptive-learning/contracts';
import type { LearningPlanView } from '@/lib/adaptive-learning/planning/learning-plan-view';
import type { LearningPath, LearningPathNode } from '@/lib/teaching/learning-path-types';
import { buildSuspense } from '@/lib/retention/recall-hook';

export type SnapshotResult<T> =
  | {
      status: 'fulfilled';
      data: T;
    }
  | {
      status: 'rejected';
      error: string;
    };

export interface StudyLabWorkshopSnapshot {
  generatedAt?: number;
  mistakeTotal?: number;
  review?: {
    dueCount?: number;
    overdue?: number;
    completed?: number;
    total?: number;
  };
  learningStats?: {
    masteryPercent?: number;
    todayStudyMinutes?: number;
    streakDays?: number;
  } | null;
  memoryProgress?: {
    totalFlipped: number;
    topicCount: number;
    lastStudied: number | null;
  } | null;
  dataSources?: Record<string, string>;
}

export interface StudyLabLearningPathResponse {
  path: LearningPath | null;
}

export interface StudyLabLearningPlanResponse {
  plan: LearningPlan | null;
  view: LearningPlanView | null;
}

export interface StudyLabApiSnapshots {
  personalization: SnapshotResult<PersonalizationContext>;
  workshop: SnapshotResult<StudyLabWorkshopSnapshot>;
  learningPath: SnapshotResult<StudyLabLearningPathResponse>;
  learningPlan: SnapshotResult<StudyLabLearningPlanResponse>;
}

type StudyLabScheduledTask = Pick<
  LearningTask,
  | 'id'
  | 'pathNodeId'
  | 'nodeId'
  | 'type'
  | 'title'
  | 'objective'
  | 'plannedMinutes'
  | 'difficulty'
  | 'status'
  | 'scheduledDate'
  | 'reasonCodes'
  | 'successCriteria'
  | 'actionHref'
>;

export interface StudyLabTodayMission {
  title: string;
  detail: string;
  href: string;
  sourceLabel: string;
  durationLabel: string;
  reason: string;
  successCriteria: string[];
  state: 'ready' | 'completed' | 'buffer-day' | 'starter';
  /**
   * 未掌握点悬念（FR-11）。由**真实薄弱点**生成，没有真实薄弱点时为 undefined。
   * 用于给任务加一个"想回来看看"的理由，而不是编造内容。
   */
  suspense?: string;
}

export interface StudyLabViewModel {
  generatedAt: number;
  profile: {
    hasLearningData: boolean;
    weakPoints: WeakPointSummary[];
    recentAccuracy: number | null;
    preferredDifficulty: PersonalizationDifficulty;
    recommendation: {
      title: string;
      reason: string;
      href: string;
      targetTool: CloudMindToolTarget;
    } | null;
  };
  workshop: {
    mistakeTotal: number;
    dueReviewCount: number;
    todayStudyMinutes: number;
    streakDays: number;
    masteryPercent: number;
    dataSources: Record<string, string>;
  };
  learningPath: {
    title: string;
    nodes: Array<
      Pick<LearningPathNode, 'id' | 'topic' | 'status' | 'knowledgePoints'> & {
        scheduledDate?: string;
        scheduledTaskCount: number;
        isToday: boolean;
      }
    >;
  } | null;
  learningPlan: {
    id: string;
    pathId?: string;
    validFrom: string;
    validTo: string;
    todayDate: string | null;
    todayTask: StudyLabScheduledTask | null;
    tasks: StudyLabScheduledTask[];
    todaySummary: LearningPlanView['summary'] | null;
  } | null;
  errors: {
    personalization?: string;
    workshop?: string;
    learningPath?: string;
    learningPlan?: string;
  };
}

const DEFAULT_PROFILE: StudyLabViewModel['profile'] = {
  hasLearningData: false,
  weakPoints: [],
  recentAccuracy: null,
  preferredDifficulty: 'medium',
  recommendation: null,
};

const DEFAULT_WORKSHOP: StudyLabViewModel['workshop'] = {
  mistakeTotal: 0,
  dueReviewCount: 0,
  todayStudyMinutes: 0,
  streakDays: 0,
  masteryPercent: 0,
  dataSources: {},
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function clampPercent(value: unknown): number {
  if (!isFiniteNumber(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function nonNegativeInteger(value: unknown): number {
  if (!isFiniteNumber(value)) return 0;
  return Math.max(0, Math.round(value));
}

function buildProfile(
  result: StudyLabApiSnapshots['personalization'],
): StudyLabViewModel['profile'] {
  if (result.status === 'rejected') return DEFAULT_PROFILE;

  const context = result.data;
  return {
    hasLearningData: context.hasLearningData,
    weakPoints: context.hasLearningData ? context.weakPoints : [],
    recentAccuracy: context.hasLearningData ? context.recentAccuracy : null,
    preferredDifficulty: context.preferredDifficulty,
    recommendation: context.recommendation
      ? {
          title: context.recommendation.title,
          reason: context.recommendation.reason,
          href: context.recommendation.href,
          targetTool: context.recommendation.targetTool,
        }
      : null,
  };
}

function buildWorkshop(result: StudyLabApiSnapshots['workshop']): StudyLabViewModel['workshop'] {
  if (result.status === 'rejected') return DEFAULT_WORKSHOP;

  const snapshot = result.data;
  return {
    mistakeTotal: nonNegativeInteger(snapshot.mistakeTotal),
    dueReviewCount: nonNegativeInteger(snapshot.review?.dueCount),
    todayStudyMinutes: nonNegativeInteger(snapshot.learningStats?.todayStudyMinutes),
    streakDays: nonNegativeInteger(snapshot.learningStats?.streakDays),
    masteryPercent: clampPercent(snapshot.learningStats?.masteryPercent),
    dataSources: snapshot.dataSources ?? {},
  };
}

const TASK_TITLE_PREFIX: Record<LearningTask['type'], string> = {
  diagnostic: '先测一测',
  learn: '先学懂',
  'worked-example': '跟着例题学会',
  practice: '练一练',
  review: '复习一下',
};

const REASON_EXPLANATIONS: Record<string, string> = {
  'no-evidence': '这部分还没做过题，我们还不知道你会不会，先用几道题摸摸底。',
  'low-confidence': '你做过的题还不够多，我们先多确认几道，看看哪些地方已经会了。',
  'low-mastery': '这部分目前还不熟练，先把基础补清楚，再继续往后学。',
  'repeated-errors': '这部分最近反复出错，先针对易错点练习，避免同样的问题再出现。',
  'low-retention': '这部分以前学过，但有一段时间没复习，先把记忆找回来。',
  'stable-mastery': '这部分已经掌握得不错，继续练习让它变得更稳。',
  'path-sequence': '这是后面内容的基础，所以先从这里开始。',
};

function projectScheduledTask(task: LearningTask): StudyLabScheduledTask {
  return {
    id: task.id,
    ...(task.pathNodeId ? { pathNodeId: task.pathNodeId } : {}),
    nodeId: task.nodeId,
    type: task.type,
    title: task.title,
    objective: task.objective,
    plannedMinutes: task.plannedMinutes,
    difficulty: task.difficulty,
    status: task.status,
    scheduledDate: task.scheduledDate,
    reasonCodes: task.reasonCodes,
    successCriteria: task.successCriteria,
    ...(task.actionHref ? { actionHref: task.actionHref } : {}),
  };
}

export function getLearningTaskTitle(task: {
  type: LearningTask['type'];
  title: string;
  objective: string;
}): string {
  return `${TASK_TITLE_PREFIX[task.type]}：${task.objective}`;
}

function taskMissionTitle(task: StudyLabScheduledTask): string {
  return getLearningTaskTitle(task);
}

function taskMissionReason(task: StudyLabScheduledTask): string {
  return (
    task.reasonCodes.map((code) => REASON_EXPLANATIONS[code]).find(Boolean) ??
    REASON_EXPLANATIONS['path-sequence']
  );
}

function buildLearningPlan(
  result: StudyLabApiSnapshots['learningPlan'],
): StudyLabViewModel['learningPlan'] {
  if (result.status === 'rejected' || !result.data.plan) return null;
  const { plan, view } = result.data;

  return {
    id: plan.id,
    ...(plan.pathId ? { pathId: plan.pathId } : {}),
    validFrom: plan.validFrom,
    validTo: plan.validTo,
    todayDate: view?.from ?? null,
    todayTask: view?.nextTask ? projectScheduledTask(view.nextTask) : null,
    tasks: plan.tasks.map(projectScheduledTask),
    todaySummary: view?.summary ?? null,
  };
}

function buildLearningPath(
  result: StudyLabApiSnapshots['learningPath'],
  learningPlan: StudyLabViewModel['learningPlan'],
): StudyLabViewModel['learningPath'] {
  if (result.status === 'rejected') return null;
  const path = result.data.path;
  if (!path || path.nodes.length === 0) return null;

  return {
    title: path.title,
    nodes: path.nodes.map((node) => {
      const scheduledTasks = (learningPlan?.tasks ?? [])
        .filter(
          (task) =>
            task.pathNodeId === node.id &&
            (task.status === 'pending' || task.status === 'in-progress'),
        )
        .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate));
      const scheduledDate = scheduledTasks[0]?.scheduledDate;

      return {
        id: node.id,
        topic: node.topic,
        status: node.status,
        knowledgePoints: node.knowledgePoints,
        ...(scheduledDate ? { scheduledDate } : {}),
        scheduledTaskCount: scheduledTasks.length,
        isToday: scheduledTasks.some((task) => task.scheduledDate === learningPlan?.todayDate),
      };
    }),
  };
}

function collectErrors(snapshots: StudyLabApiSnapshots): StudyLabViewModel['errors'] {
  return {
    ...(snapshots.personalization.status === 'rejected'
      ? { personalization: snapshots.personalization.error }
      : {}),
    ...(snapshots.workshop.status === 'rejected' ? { workshop: snapshots.workshop.error } : {}),
    ...(snapshots.learningPath.status === 'rejected'
      ? { learningPath: snapshots.learningPath.error }
      : {}),
    ...(snapshots.learningPlan.status === 'rejected'
      ? { learningPlan: snapshots.learningPlan.error }
      : {}),
  };
}

export function getStudyLabTodayMission(viewModel: StudyLabViewModel): StudyLabTodayMission {
  const learningPlan = viewModel.learningPlan;
  const plannedTask = learningPlan?.todayTask;
  // 悬念一律来自真实薄弱点；无数据则不给（宁可没有，不编造）
  const suspense = buildSuspense(viewModel.profile.weakPoints ?? []);

  if (plannedTask) {
    return {
      title: taskMissionTitle(plannedTask),
      detail: plannedTask.objective,
      href: plannedTask.actionHref ?? '/sky/learning/path',
      sourceLabel: '今日计划',
      durationLabel: `约 ${plannedTask.plannedMinutes} 分钟`,
      reason: taskMissionReason(plannedTask),
      successCriteria: plannedTask.successCriteria,
      state: 'ready',
      ...(suspense ? { suspense } : {}),
    };
  }

  const todaySummary = learningPlan?.todaySummary;
  if (todaySummary && todaySummary.totalTasks > 0 && todaySummary.completionRate === 100) {
    return {
      title: '今日计划已完成',
      detail: '今日任务已全部完成。保持节奏，下一批任务会按个人路径继续推进。',
      href: '/sky/learning/today',
      sourceLabel: '计划完成',
      durationLabel: `已完成 ${todaySummary.plannedMinutes} 分钟`,
      reason: '今天的学习目标已经完成，可以查看完整安排或先休息。',
      successCriteria: ['完成今日计划'],
      state: 'completed',
    };
  }

  if (learningPlan) {
    return {
      title: '今日为计划缓冲日',
      detail: '今天不安排新任务，预计用时 0 分钟，可以用来保持节奏或休息。',
      href: '/sky/learning/today',
      sourceLabel: '计划缓冲',
      durationLabel: '',
      reason: '今天不安排新任务，用来保持节奏或休息。',
      successCriteria: ['查看完整安排'],
      state: 'buffer-day',
    };
  }

  if (viewModel.profile.recommendation) {
    return {
      title: viewModel.profile.recommendation.title,
      detail: viewModel.profile.recommendation.reason,
      href: viewModel.profile.recommendation.href,
      sourceLabel: '为你推荐',
      durationLabel: '约 10-20 分钟',
      reason: '根据你最近的学习记录，先处理这项内容最有帮助。',
      successCriteria: ['完成推荐内容'],
      state: 'ready',
    };
  }

  if (viewModel.workshop.dueReviewCount > 0) {
    return {
      title: `处理 ${viewModel.workshop.dueReviewCount} 条到期复习`,
      detail: '将到期内容转为复习卡片，巩固记忆，更新知识点掌握程度。',
      href: '/sky/cloud-mind/memory',
      sourceLabel: '到期复习',
      durationLabel: '约 10-20 分钟',
      reason: '这些内容已经到了适合复习的时间。',
      successCriteria: ['完成到期复习'],
      state: 'ready',
    };
  }

  return {
    title: '完成一次入门练习',
    detail: '通过智能出题或拍照解题留下第一批学习记录。',
    href: '/sky/cloud-mind/quiz',
    sourceLabel: '入门练习',
    durationLabel: '约 10-20 分钟',
    reason: '先留下第一批学习记录，系统才能为你生成更准确的计划。',
    successCriteria: ['完成一次练习'],
    state: 'starter',
  };
}

export function buildStudyLabViewModel(snapshots: StudyLabApiSnapshots): StudyLabViewModel {
  const workshopGeneratedAt =
    snapshots.workshop.status === 'fulfilled' && isFiniteNumber(snapshots.workshop.data.generatedAt)
      ? snapshots.workshop.data.generatedAt
      : 0;
  const personalizationGeneratedAt =
    snapshots.personalization.status === 'fulfilled' &&
    isFiniteNumber(snapshots.personalization.data.generatedAt)
      ? snapshots.personalization.data.generatedAt
      : 0;
  const learningPlan = buildLearningPlan(snapshots.learningPlan);

  return {
    generatedAt: Math.max(workshopGeneratedAt, personalizationGeneratedAt) || Date.now(),
    profile: buildProfile(snapshots.personalization),
    workshop: buildWorkshop(snapshots.workshop),
    learningPath: buildLearningPath(snapshots.learningPath, learningPlan),
    learningPlan,
    errors: collectErrors(snapshots),
  };
}
