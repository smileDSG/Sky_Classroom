import { z } from 'zod';
import type { AnimationScript, AnimationStep } from './types';

export const NARRATION_MAX_LENGTH = 500;
export const LABEL_MAX_LENGTH = 20;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be #rrggbb');

const actorSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('node'),
    id: z.string().min(1),
    label: z.string().max(LABEL_MAX_LENGTH),
    shape: z.enum(['circle', 'rect']),
    color: hexColor,
    r: z.number().positive().optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
  }),
  z.object({
    kind: z.literal('array-cell'),
    id: z.string().min(1),
    label: z.string().max(LABEL_MAX_LENGTH),
    w: z.number().positive(),
    h: z.number().positive(),
    color: hexColor,
  }),
  z.object({
    kind: z.literal('arrow'),
    id: z.string().min(1),
    fromActorId: z.string().min(1),
    toActorId: z.string().min(1),
    label: z.string().max(LABEL_MAX_LENGTH).optional(),
    curved: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('pointer'),
    id: z.string().min(1),
    label: z.string().max(LABEL_MAX_LENGTH),
    targetActorId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('text'),
    id: z.string().min(1),
    content: z.string().max(200),
    size: z.number().positive(),
    color: hexColor,
  }),
  z.object({
    kind: z.literal('highlight'),
    id: z.string().min(1),
    targetActorId: z.string().min(1),
    color: hexColor,
  }),
  z.object({
    kind: z.literal('bar'),
    id: z.string().min(1),
    label: z.string().max(LABEL_MAX_LENGTH),
    w: z.number().positive(),
    color: hexColor,
  }),
  z.object({
    kind: z.literal('axes'),
    id: z.string().min(1),
    xmin: z.number(),
    xmax: z.number(),
    ymin: z.number(),
    ymax: z.number(),
  }),
]);

const actorStateSchema = z.object({
  actorId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  opacity: z.number().min(0).max(1).optional(),
  scale: z.number().positive().optional(),
  labelOverride: z.string().max(LABEL_MAX_LENGTH).optional(),
  colorOverride: hexColor.optional(),
  entering: z.boolean().optional(),
  exiting: z.boolean().optional(),
});

const stepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(60),
  narration: z.string().min(1).max(NARRATION_MAX_LENGTH),
  actorStates: z.array(actorStateSchema).min(1),
});

// 步数下限取 1 而非 5：autoFix 可能丢弃坏步骤，硬卡 5 会误伤；
// 5~20 步的目标由 plan-agent 的 planSchema 约束（后续任务）。
export const scriptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(80),
  topic: z.string().min(1).max(120),
  subjectArea: z.enum(['algorithm', 'data-structure', 'math', 'physics']),
  stage: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    showGrid: z.boolean().optional(),
    showAxes: z.boolean().optional(),
  }),
  actors: z.array(actorSchema),
  steps: z.array(stepSchema).min(1).max(30),
});

export type ScriptInput = z.input<typeof scriptSchema>;

/**
 * 对 LLM 产出的脏 JSON 做尽力修复：剔除未知演员状态、clamp 越界坐标、
 * 截断超长字段、丢弃无法修复的 step。返回修复后的脚本与修复清单。
 * 修复后仍不合法则抛错（调用方重试，fail hard）。
 */
export function autoFixScript(dirty: unknown): { script: AnimationScript; fixes: string[] } {
  const parsed = scriptSchema.safeParse(dirty);

  // 结构已合法时只做跨字段修复（引用检查 + 越界 clamp），其余字段原样保留；
  // 这些约束 schema 无法表达，即便 parse 成功也必须检查。
  if (parsed.success) return repairReferences(parsed.data);

  const d = (dirty ?? {}) as Record<string, unknown>;
  const fixes: string[] = [];
  const stage = (d.stage ?? {}) as Record<string, unknown>;
  const width = typeof stage.width === 'number' && stage.width > 0 ? stage.width : 1200;
  const height = typeof stage.height === 'number' && stage.height > 0 ? stage.height : 675;

  const actors = Array.isArray(d.actors) ? d.actors : [];
  const knownIds = new Set(
    actors
      .map((a) => (a && typeof a === 'object' ? (a as Record<string, unknown>).id : null))
      .filter((v): v is string => typeof v === 'string'),
  );

  const rawSteps = Array.isArray(d.steps) ? d.steps : [];
  const steps = rawSteps
    .map((raw, i) => {
      const s = (raw ?? {}) as Record<string, unknown>;
      const narration =
        typeof s.narration === 'string' ? s.narration.slice(0, NARRATION_MAX_LENGTH) : '';
      if (!narration.trim()) {
        fixes.push(`step[${i}]: narration 缺失，已丢弃该步`);
        return null;
      }
      const rawStates = Array.isArray(s.actorStates) ? s.actorStates : [];
      const actorStates = rawStates
        .filter((st) => {
          const id = (st as Record<string, unknown> | null)?.actorId;
          if (typeof id === 'string' && knownIds.has(id)) return true;
          fixes.push(`step[${i}]: 剔除未知演员状态 ${String(id)}`);
          return false;
        })
        .map((st) => {
          const o = (st as Record<string, unknown>) ?? {};
          const clamp = (v: unknown, max: number) => Math.min(Math.max(Number(v) || 0, 0), max);
          return {
            actorId: String(o.actorId),
            x: clamp(o.x, width),
            y: clamp(o.y, height),
          };
        });
      if (actorStates.length === 0) {
        fixes.push(`step[${i}]: 修复后无有效状态，已丢弃该步`);
        return null;
      }
      return {
        id: typeof s.id === 'string' && s.id ? s.id : `step-${i + 1}`,
        title:
          typeof s.title === 'string' && s.title.trim() ? s.title.slice(0, 60) : `第 ${i + 1} 步`,
        narration,
        actorStates,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (steps.length === 0) throw new Error('autoFix 后仍无有效步骤');

  const candidate = {
    id: typeof d.id === 'string' && d.id ? d.id : `anim-${Date.now()}`,
    title: typeof d.title === 'string' && d.title.trim() ? d.title.slice(0, 80) : '动画讲解',
    topic: typeof d.topic === 'string' && d.topic.trim() ? d.topic.slice(0, 120) : '未提供话题',
    subjectArea: ['algorithm', 'data-structure', 'math', 'physics'].includes(
      d.subjectArea as string,
    )
      ? d.subjectArea
      : 'algorithm',
    stage: { width, height },
    actors,
    steps,
  };

  const reparsed = scriptSchema.safeParse(candidate);
  if (!reparsed.success) {
    throw new Error(`autoFix 后仍不合法: ${reparsed.error.issues[0]?.message ?? 'unknown'}`);
  }
  return { script: reparsed.data, fixes };
}

/** 跨字段修复：剔除指向未知演员的状态、clamp 越界坐标、丢弃修复后无状态的 step */
function repairReferences(script: AnimationScript): { script: AnimationScript; fixes: string[] } {
  const knownIds = new Set(script.actors.map((a) => a.id));
  const fixes: string[] = [];
  const steps = script.steps
    .map((step, i) => {
      const actorStates = step.actorStates
        .filter((st) => {
          if (knownIds.has(st.actorId)) return true;
          fixes.push(`step[${i}]: 剔除未知演员状态 ${st.actorId}`);
          return false;
        })
        .map((st) => {
          const x = Math.min(Math.max(st.x, 0), script.stage.width);
          const y = Math.min(Math.max(st.y, 0), script.stage.height);
          if (x !== st.x || y !== st.y) {
            fixes.push(
              `step[${i}]: clamp 越界坐标 ${st.actorId} (${st.x}, ${st.y}) → (${x}, ${y})`,
            );
          }
          return { ...st, x, y };
        });
      if (actorStates.length === 0) {
        fixes.push(`step[${i}]: 修复后无有效状态，已丢弃该步`);
        return null;
      }
      return { ...step, actorStates };
    })
    .filter((s): s is AnimationStep => s !== null);

  if (steps.length === 0) throw new Error('autoFix 后仍无有效步骤');
  return { script: { ...script, steps }, fixes };
}
