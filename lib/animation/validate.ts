import type { Actor, AnimationScript, ActorState } from './types';

export interface ValidationIssue {
  code:
    | 'unknown-actor'
    | 'arrow-endpoint-missing'
    | 'target-missing'
    | 'out-of-bounds'
    | 'large-displacement';
  message: string;
  stepId?: string;
  actorId?: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** 相邻步之间单演员位移超过该值（对角线比例）视为跳变，给 warning */
const DISPLACEMENT_WARNING_RATIO = 0.6;

/** 拥有语义坐标（可被箭头/指针/高亮引用定位）的演员种类 */
const POSITIONED = new Set(['node', 'array-cell', 'text', 'bar', 'axes']);

/**
 * 0-LLM 结构校验（spec §6）。errors 阻断（触发 Script Agent 重试），
 * warnings 仅提示（如位移过大建议加中间步）。
 */
export function validateScript(script: AnimationScript): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { width, height } = script.stage;

  const byId = new Map<string, Actor>(script.actors.map((a) => [a.id, a]));

  for (const actor of script.actors) {
    if (actor.kind === 'arrow') {
      for (const end of [actor.fromActorId, actor.toActorId]) {
        const target = byId.get(end);
        if (!target) {
          errors.push({
            code: 'arrow-endpoint-missing',
            message: `箭头 ${actor.id} 端点 ${end} 不存在`,
            actorId: actor.id,
          });
        } else if (!POSITIONED.has(target.kind)) {
          errors.push({
            code: 'arrow-endpoint-missing',
            message: `箭头 ${actor.id} 端点 ${end} 不是可定位演员（${target.kind}）`,
            actorId: actor.id,
          });
        }
      }
    }
    if (actor.kind === 'pointer' || actor.kind === 'highlight') {
      const target = byId.get(actor.targetActorId);
      if (!target) {
        errors.push({
          code: 'target-missing',
          message: `${actor.kind} ${actor.id} 的目标 ${actor.targetActorId} 不存在`,
          actorId: actor.id,
        });
      } else if (!POSITIONED.has(target.kind)) {
        errors.push({
          code: 'target-missing',
          message: `${actor.kind} ${actor.id} 的目标 ${actor.targetActorId} 不是可定位演员`,
          actorId: actor.id,
        });
      }
    }
  }

  const diag = Math.hypot(width, height);
  let prev: Map<string, ActorState> | null = null;

  for (const step of script.steps) {
    for (const st of step.actorStates) {
      if (!byId.has(st.actorId)) {
        errors.push({
          code: 'unknown-actor',
          message: `步骤 ${step.id} 引用未知演员 ${st.actorId}`,
          stepId: step.id,
          actorId: st.actorId,
        });
        continue;
      }
      if (st.x < 0 || st.x > width || st.y < 0 || st.y > height) {
        errors.push({
          code: 'out-of-bounds',
          message: `步骤 ${step.id} 演员 ${st.actorId} 坐标 (${st.x}, ${st.y}) 越界`,
          stepId: step.id,
          actorId: st.actorId,
        });
      }
      if (prev) {
        const before = prev.get(st.actorId);
        if (
          before &&
          Math.hypot(st.x - before.x, st.y - before.y) > diag * DISPLACEMENT_WARNING_RATIO
        ) {
          warnings.push({
            code: 'large-displacement',
            message: `步骤 ${step.id} 演员 ${st.actorId} 位移过大，建议增加中间过渡步`,
            stepId: step.id,
            actorId: st.actorId,
          });
        }
      }
    }
    prev = new Map(step.actorStates.map((st) => [st.actorId, st]));
  }

  return { errors, warnings };
}
