import type { LearningPlan, LearningTask } from '@/lib/adaptive-learning/contracts';
import { planningDateFromInstant } from '@/lib/adaptive-learning/planning/learning-plan-date';

const DAY_MS = 24 * 60 * 60 * 1000;

export type LearningPlanViewKind = 'today' | 'week' | 'month';

export interface LearningPlanView {
  kind: LearningPlanViewKind;
  planId: string;
  pathId?: string;
  from: string;
  to: string;
  tasks: LearningTask[];
  weeklyTargets: LearningPlan['weeklyTargets'];
  nextTask: LearningTask | null;
  summary: {
    totalTasks: number;
    completedTasks: number;
    plannedMinutes: number;
    completionRate: number;
  };
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function startOfWeek(value: Date): Date {
  const date = startOfUtcDay(value);
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(date.getTime() + offset * DAY_MS);
}

function resolveRange(
  plan: LearningPlan,
  kind: LearningPlanViewKind,
  selectedDate: Date,
): { from: string; to: string } {
  if (kind === 'month') return { from: plan.validFrom, to: plan.validTo };
  const learnerDate = planningDateFromInstant(selectedDate);
  if (kind === 'today') {
    const date = formatDate(learnerDate);
    return { from: date, to: date };
  }

  const from = startOfWeek(learnerDate);
  const to = new Date(from.getTime() + 6 * DAY_MS);
  return { from: formatDate(from), to: formatDate(to) };
}

function isWithin(value: string, from: string, to: string): boolean {
  return value >= from && value <= to;
}

function weeklyTargetOverlaps(
  target: LearningPlan['weeklyTargets'][number],
  from: string,
  to: string,
): boolean {
  const weekEnd = formatDate(
    new Date(new Date(`${target.weekStart}T00:00:00.000Z`).getTime() + 6 * DAY_MS),
  );
  return target.weekStart <= to && weekEnd >= from;
}

export function projectLearningPlan(
  plan: LearningPlan,
  kind: LearningPlanViewKind,
  selectedDate = new Date(),
): LearningPlanView {
  const range = resolveRange(plan, kind, selectedDate);
  const tasks = plan.tasks
    .filter((task) => isWithin(task.scheduledDate, range.from, range.to))
    .sort(
      (left, right) =>
        left.scheduledDate.localeCompare(right.scheduledDate) || left.id.localeCompare(right.id),
    );
  const completedTasks = tasks.filter((task) => task.status === 'completed').length;
  const nextTask =
    tasks.find((task) => task.status === 'in-progress') ??
    tasks.find((task) => task.status === 'pending') ??
    null;

  return {
    kind,
    planId: plan.id,
    ...(plan.pathId ? { pathId: plan.pathId } : {}),
    ...range,
    tasks,
    weeklyTargets: plan.weeklyTargets.filter((target) =>
      weeklyTargetOverlaps(target, range.from, range.to),
    ),
    nextTask,
    summary: {
      totalTasks: tasks.length,
      completedTasks,
      plannedMinutes: tasks.reduce((total, task) => total + task.plannedMinutes, 0),
      completionRate: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
    },
  };
}
