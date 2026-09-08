import { nanoid } from 'nanoid';

import {
  learningPlanSchema,
  type LearningPlan,
  type LearningTask,
  type PlanningProfileProjection,
} from '@/lib/adaptive-learning/contracts';
import { planningDateFromInstant } from '@/lib/adaptive-learning/planning/learning-plan-date';
import type { LearningPath, LearningPathNode } from '@/lib/teaching/learning-path-types';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HORIZON_DAYS = 28;
const MIN_TASK_MINUTES = 10;
const PLANNER_VERSION = '2.0.0';
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

interface CandidateTask {
  pathNodeId: string;
  nodeId: string;
  type: LearningTask['type'];
  title: string;
  objective: string;
  plannedMinutes: number;
  difficulty: number;
  resourceIds: string[];
  successCriteria: string[];
  reasonCodes: string[];
  actionHref: string;
}

export interface BuildScheduledLearningPlanInput {
  path: LearningPath;
  projection: PlanningProfileProjection;
  evidenceEventIds?: string[];
  now?: Date;
  planId?: string;
  version?: number;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function startOfWeek(value: Date): Date {
  const date = startOfUtcDay(value);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

function inclusiveDays(from: Date, to: Date): number {
  return Math.floor((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / DAY_MS) + 1;
}

function resolveHorizonDays(projection: PlanningProfileProjection, now: Date): number {
  const domain = projection.data.activeDomain;
  const configured = domain.horizonDays ?? DEFAULT_HORIZON_DAYS;
  const untilExam = domain.examDate
    ? Math.max(1, inclusiveDays(now, parseDate(domain.examDate)))
    : DEFAULT_HORIZON_DAYS;
  return Math.max(1, Math.min(DEFAULT_HORIZON_DAYS, configured, untilExam));
}

function normalizeNodeId(value: string): string {
  const normalized = value.trim().toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (slug) return slug;

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(index);
    hash |= 0;
  }
  return `kp-${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

function signalForPathNode(
  node: LearningPathNode,
  projection: PlanningProfileProjection,
): PlanningProfileProjection['data']['targetKnowledge'][number] | undefined {
  const candidates = new Set([node.topic, ...node.knowledgePoints]);
  return projection.data.targetKnowledge.find(
    (signal) =>
      candidates.has(signal.nodeId) ||
      (signal.displayName !== undefined && candidates.has(signal.displayName)),
  );
}

function orderPathNodes(
  path: LearningPath,
  projection: PlanningProfileProjection,
): LearningPathNode[] {
  const nodes = path.nodes.filter(
    (node) => node.status === 'pending' || node.status === 'in_progress',
  );
  const pathOrder = new Map(nodes.map((node, index) => [node.id, index]));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const remaining = new Set(nodes.map((node) => node.id));
  const ordered: LearningPathNode[] = [];

  const priorityRank = (node: LearningPathNode): number => {
    const signal = signalForPathNode(node, projection);
    if (!signal) return Number.MAX_SAFE_INTEGER;
    const rank = projection.data.targetKnowledge.findIndex(
      (candidate) => candidate.nodeId === signal.nodeId,
    );
    return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
  };

  const hasPendingPrerequisite = (node: LearningPathNode): boolean =>
    node.prerequisites.some((prerequisite) =>
      [...remaining].some((nodeId) => {
        if (nodeId === node.id) return false;
        const candidate = nodesById.get(nodeId);
        return (
          candidate?.topic === prerequisite || candidate?.knowledgePoints.includes(prerequisite)
        );
      }),
    );

  while (remaining.size > 0) {
    const eligible = [...remaining]
      .map((nodeId) => nodesById.get(nodeId)!)
      .filter((node) => !hasPendingPrerequisite(node));
    const pool =
      eligible.length > 0 ? eligible : [...remaining].map((nodeId) => nodesById.get(nodeId)!);

    pool.sort((left, right) => {
      const statusOrder =
        Number(right.status === 'in_progress') - Number(left.status === 'in_progress');
      if (statusOrder !== 0) return statusOrder;
      return (
        priorityRank(left) - priorityRank(right) ||
        pathOrder.get(left.id)! - pathOrder.get(right.id)!
      );
    });

    const next = pool[0];
    ordered.push(next);
    remaining.delete(next.id);
  }

  return ordered;
}

function taskMinutes(type: LearningTask['type'], sessionMinutes: number): number {
  if (type === 'diagnostic') return Math.max(MIN_TASK_MINUTES, Math.min(15, sessionMinutes));
  if (type === 'review') {
    return Math.max(MIN_TASK_MINUTES, Math.round(sessionMinutes / 2));
  }
  return sessionMinutes;
}

function taskDifficulty(type: LearningTask['type'], mastery: number | undefined): number {
  if (type === 'diagnostic') return 1;
  if (type === 'learn' || type === 'worked-example') {
    return mastery !== undefined && mastery >= 0.7 ? 3 : 2;
  }
  if (type === 'review') return mastery !== undefined && mastery >= 0.8 ? 4 : 2;
  if (mastery === undefined || mastery < 0.55) return 2;
  if (mastery < 0.8) return 3;
  return 4;
}

function taskHref(type: LearningTask['type'], topic: string): string {
  const encodedTopic = encodeURIComponent(topic);
  if (type === 'learn' || type === 'worked-example') {
    return `/sky/cloud-mind/teaching?topic=${encodedTopic}`;
  }
  if (type === 'review') return `/sky/cloud-mind/memory?topic=${encodedTopic}`;
  const mode = type === 'diagnostic' ? '&mode=diagnostic' : '';
  return `/sky/cloud-mind/quiz?topic=${encodedTopic}${mode}`;
}

function taskTypesForNode(
  signal: PlanningProfileProjection['data']['targetKnowledge'][number] | undefined,
): LearningTask['type'][] {
  if (!signal || signal.confidence < 0.4) return ['diagnostic'];
  if (signal.mastery < 0.55) return ['learn', 'worked-example', 'practice', 'review'];
  if (signal.retention < 0.7) return ['review', 'practice'];
  if (signal.mastery < 0.8) return ['practice', 'review'];
  return ['review'];
}

function buildCandidates(
  path: LearningPath,
  projection: PlanningProfileProjection,
): CandidateTask[] {
  const maxAvailability = Math.max(
    ...Object.values(projection.data.availability.dailyAvailability),
    MIN_TASK_MINUTES,
  );
  const sessionMinutes = Math.max(
    MIN_TASK_MINUTES,
    Math.min(
      projection.data.availability.preferredSessionMinutes,
      projection.data.availability.maxDailyMinutes,
      maxAvailability,
    ),
  );

  return orderPathNodes(path, projection).flatMap((node) => {
    const signal = signalForPathNode(node, projection);
    const topic = node.topic || node.knowledgePoints[0] || node.id;
    const nodeId = signal?.nodeId ?? normalizeNodeId(node.knowledgePoints[0] ?? topic);
    const reasonCodes = Array.from(
      new Set([...(signal?.reasonCodes ?? ['no-evidence']), 'path-sequence']),
    );

    return taskTypesForNode(signal).map((type) => ({
      pathNodeId: node.id,
      nodeId,
      type,
      title:
        type === 'diagnostic'
          ? `诊断：${topic}`
          : type === 'learn'
            ? `学习：${topic}`
            : type === 'worked-example'
              ? `例题：${topic}`
              : type === 'review'
                ? `复习：${topic}`
                : `练习：${topic}`,
      objective: `推进个人路径中的“${topic}”节点`,
      plannedMinutes: taskMinutes(type, sessionMinutes),
      difficulty: taskDifficulty(type, signal?.mastery),
      resourceIds: [],
      successCriteria: [
        type === 'diagnostic' ? '完成诊断并产生可用于更新画像的学习证据' : '完成任务并提交学习结果',
      ],
      reasonCodes,
      actionHref: taskHref(type, topic),
    }));
  });
}

function dailyBudget(projection: PlanningProfileProjection, date: Date): number {
  const weekday = WEEKDAYS[date.getUTCDay()];
  if (projection.data.availability.restDays.includes(weekday)) return 0;
  return Math.min(
    projection.data.availability.dailyAvailability[weekday] ?? 0,
    projection.data.availability.maxDailyMinutes,
  );
}

export function buildWeeklyTargets(tasks: LearningTask[]): LearningPlan['weeklyTargets'] {
  const groups = new Map<string, LearningTask[]>();
  for (const task of tasks) {
    const weekStart = formatDate(startOfWeek(parseDate(task.scheduledDate)));
    groups.set(weekStart, [...(groups.get(weekStart) ?? []), task]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([weekStart, weekTasks]) => ({
      weekStart,
      targetNodeIds: Array.from(new Set(weekTasks.map((task) => task.nodeId))),
      plannedMinutes: weekTasks.reduce((total, task) => total + task.plannedMinutes, 0),
      expectedOutcomes: [`完成 ${weekTasks.length} 项计划任务并更新个人路径证据`],
    }));
}

export function buildScheduledLearningPlan(input: BuildScheduledLearningPlanInput): LearningPlan {
  const generatedAt = input.now ?? new Date();
  const validFromDate = planningDateFromInstant(generatedAt);
  const horizonDays = resolveHorizonDays(input.projection, validFromDate);
  const validToDate = addDays(validFromDate, horizonDays - 1);
  const candidates = buildCandidates(input.path, input.projection);
  const tasks: LearningTask[] = [];
  const weeklyUsed = new Map<string, number>();
  const planId = input.planId ?? `plan-${nanoid(10)}`;
  let candidateIndex = 0;

  for (
    let dayOffset = 0;
    dayOffset < horizonDays && candidateIndex < candidates.length;
    dayOffset += 1
  ) {
    const date = addDays(validFromDate, dayOffset);
    const weekStart = formatDate(startOfWeek(date));
    const remainingWeek = Math.max(
      0,
      input.projection.data.availability.weeklyAvailableMinutes - (weeklyUsed.get(weekStart) ?? 0),
    );
    const budget = Math.min(dailyBudget(input.projection, date), remainingWeek);
    let usedToday = 0;

    while (candidateIndex < candidates.length) {
      const candidate = candidates[candidateIndex];
      if (candidate.plannedMinutes > budget - usedToday) break;

      tasks.push({
        id: `${planId}:task:${candidateIndex + 1}`,
        ...candidate,
        status: 'pending',
        scheduledDate: formatDate(date),
      });
      usedToday += candidate.plannedMinutes;
      candidateIndex += 1;
    }

    weeklyUsed.set(weekStart, (weeklyUsed.get(weekStart) ?? 0) + usedToday);
  }

  const constraintChecks = [
    'daily-capacity-respected',
    'weekly-capacity-respected',
    'rest-days-respected',
    'path-order-preserved',
  ];
  if (candidateIndex < candidates.length) {
    constraintChecks.push(`unscheduled-tasks:${candidates.length - candidateIndex}`);
  }

  return learningPlanSchema.parse({
    id: planId,
    userId: input.path.userId,
    pathId: input.path.id,
    version: input.version ?? 1,
    status: tasks.length > 0 ? 'active' : 'draft',
    generatedAt: generatedAt.toISOString(),
    validFrom: formatDate(validFromDate),
    validTo: formatDate(validToDate),
    curriculumPackVersion: input.projection.data.activeDomain.curriculumPackVersion,
    plannerVersion: PLANNER_VERSION,
    profileSnapshot: input.projection,
    tasks,
    weeklyTargets: buildWeeklyTargets(tasks),
    constraintChecks,
    evidenceEventIds: input.evidenceEventIds ?? [],
  });
}
