import type {
  CloudMindToolTarget,
  PersonalizationContext,
  PersonalizationDifficulty,
  WeakPointSummary,
} from '@/lib/cloud-mind/types';
import type { LearningPlan, LearningTask } from '@/lib/adaptive-learning/contracts';
import type { LearningPlanView } from '@/lib/adaptive-learning/planning/learning-plan-view';
import type { LearningPath, LearningPathNode } from '@/lib/teaching/learning-path-types';

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
  | 'status'
  | 'scheduledDate'
  | 'successCriteria'
  | 'actionHref'
>;

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

function projectScheduledTask(task: LearningTask): StudyLabScheduledTask {
  return {
    id: task.id,
    ...(task.pathNodeId ? { pathNodeId: task.pathNodeId } : {}),
    nodeId: task.nodeId,
    type: task.type,
    title: task.title,
    objective: task.objective,
    plannedMinutes: task.plannedMinutes,
    status: task.status,
    scheduledDate: task.scheduledDate,
    successCriteria: task.successCriteria,
    ...(task.actionHref ? { actionHref: task.actionHref } : {}),
  };
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
