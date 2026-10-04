import type { Actor, AnimationScript, ActorState, ArrayCellActor } from './types';

export interface ValidationIssue {
  code:
    | 'unknown-actor'
    | 'arrow-endpoint-missing'
    | 'target-missing'
    | 'out-of-bounds'
    | 'large-displacement'
    | 'duplicate-actor-id'
    | 'duplicate-state'
    | 'cell-overlap';
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

/** 格子包围盒重叠深度在两轴上均超过该值（px）视为挤压，给 warning */
const CELL_OVERLAP_TOLERANCE_PX = 2;

/** 拥有语义坐标（可被箭头/指针/高亮引用定位）的演员种类 */
const POSITIONED = new Set(['node', 'array-cell', 'text', 'bar', 'axes']);

/** 格子状态 + 其定义（用于计算包围盒） */
interface CellBox {
  state: ActorState;
  actor: ArrayCellActor;
}

/**
 * 0-LLM 结构校验（spec §6）。errors 阻断（触发 Script Agent 重试），
 * warnings 仅提示（如位移过大建议加中间步）。
 */
export function validateScript(script: AnimationScript): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const { width, height } = script.stage;

  const byId = new Map<string, Actor>();
  const duplicateIds = new Set<string>();
  for (const actor of script.actors) {
    if (byId.has(actor.id)) duplicateIds.add(actor.id);
    byId.set(actor.id, actor);
  }
  for (const id of duplicateIds) {
    errors.push({
      code: 'duplicate-actor-id',
      message: `演员 id 重复：${id}（重复者仅保留最后一个）`,
      actorId: id,
    });
  }

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
          message: `${actor.kind} ${actor.id} 的目标 ${actor.targetActorId} 不是可定位演员（${target.kind}）`,
          actorId: actor.id,
        });
      }
    }
  }

  const diag = Math.hypot(width, height);
  let prev: Map<string, ActorState> | null = null;

  for (const step of script.steps) {
    const cells: CellBox[] = [];
    const seenIds = new Set<string>();
    const duplicatedIds = new Set<string>();
    for (const st of step.actorStates) {
      if (seenIds.has(st.actorId)) duplicatedIds.add(st.actorId);
      seenIds.add(st.actorId);

      const actor = byId.get(st.actorId);
      if (!actor) {
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
          message: `步骤 ${step.id} 演员 ${st.actorId} 坐标 (${st.x}, ${st.y}) 越界（舞台 ${width}×${height}）`,
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
      if (actor.kind === 'array-cell') {
        cells.push({ state: st, actor });
      }
    }

    // 步内同一演员状态重复 → 报错（渲染端仅保留第一个）
    for (const id of duplicatedIds) {
      errors.push({
        code: 'duplicate-state',
        message: `步骤 ${step.id} 演员 ${id} 的状态重复出现（仅保留第一个）`,
        stepId: step.id,
        actorId: id,
      });
    }

    // 格子间不重叠（容差内警告，spec §6）
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i];
        const b = cells[j];
        const overlapX =
          Math.min(a.state.x + a.actor.w / 2, b.state.x + b.actor.w / 2) -
          Math.max(a.state.x - a.actor.w / 2, b.state.x - b.actor.w / 2);
        const overlapY =
          Math.min(a.state.y + a.actor.h / 2, b.state.y + b.actor.h / 2) -
          Math.max(a.state.y - a.actor.h / 2, b.state.y - b.actor.h / 2);
        if (overlapX > CELL_OVERLAP_TOLERANCE_PX && overlapY > CELL_OVERLAP_TOLERANCE_PX) {
          warnings.push({
            code: 'cell-overlap',
            message: `步骤 ${step.id} 格子 ${a.actor.id} 与 ${b.actor.id} 包围盒重叠（x=${overlapX}px, y=${overlapY}px），建议错开或缩小`,
            stepId: step.id,
            actorId: a.actor.id,
          });
        }
      }
    }
    prev = new Map(step.actorStates.map((st) => [st.actorId, st]));
  }

  return { errors, warnings };
}
