/**
 * Director Rule Engine — Fast-Path Decision Router
 *
 * Rule-based pre-evaluation that bypasses LLM for common, predictable
 * routing decisions. Falls back to LLM director when rules cannot decide.
 *
 * This implements the "director decision fast path" from P6-002:
 * rule engine pre-judgment + LLM fallback.
 */

import type { AgentConfig } from '@/lib/orchestration/registry/types';

export interface RoutingContext {
  agents: AgentConfig[];
  respondedAgents: Set<string>; // agent IDs that already spoke
  currentTurn: number;
  maxTurns: number;
  whiteboardElementCount: number;
  maxWhiteboardElements: number;
  lastSpeakerRole?: string;
  discussionMode?: boolean;
  discussionInitiator?: string;
  userMessage?: string;
}

export interface RoutingDecision {
  nextAgentId: string | null;
  shouldEnd: boolean;
  reason: string;
  usedFastPath: boolean;
}

// ─── Rule types ───

type RuleFn = (ctx: RoutingContext) => RoutingDecision | null;

// ─── Rules ───

/** Rule 1: If all agents have spoken, end the round. */
const ruleAllSpoken: RuleFn = (ctx): RoutingDecision | null => {
  const activeAgents = ctx.agents.filter((a) => a.enabled !== false);
  const allSpoken = activeAgents.every((a) => ctx.respondedAgents.has(a.id));
  if (allSpoken && activeAgents.length > 0) {
    return { nextAgentId: null, shouldEnd: true, reason: 'All agents have spoken', usedFastPath: true };
  }
  return null;
};

/** Rule 2: If max turns reached, end the round. */
const ruleMaxTurns: RuleFn = (ctx): RoutingDecision | null => {
  if (ctx.currentTurn >= ctx.maxTurns) {
    return { nextAgentId: null, shouldEnd: true, reason: 'Max turns reached', usedFastPath: true };
  }
  return null;
};

/** Rule 3: Whiteboard crowded → route to organizer/clearer. */
const ruleWhiteboardCrowded: RuleFn = (ctx): RoutingDecision | null => {
  const ratio = ctx.whiteboardElementCount / ctx.maxWhiteboardElements;
  if (ratio > 0.8) {
    const organizer = ctx.agents.find(
      (a) =>
        a.role === 'assistant' &&
        !ctx.respondedAgents.has(a.id),
    );
    if (organizer) {
      return {
        nextAgentId: organizer.id,
        shouldEnd: false,
        reason: 'Whiteboard crowded, route to assistant to organize',
        usedFastPath: true,
      };
    }
  }
  return null;
};

/** Rule 4: Discussion mode → initiator speaks first, then teacher. */
const ruleDiscussionOrder: RuleFn = (ctx): RoutingDecision | null => {
  if (!ctx.discussionMode) return null;

  // Initiator should speak first
  if (ctx.discussionInitiator && !ctx.respondedAgents.has(ctx.discussionInitiator)) {
    return {
      nextAgentId: ctx.discussionInitiator,
      shouldEnd: false,
      reason: 'Discussion initiator speaks first',
      usedFastPath: true,
    };
  }

  // After initiator, teacher should guide
  if (ctx.respondedAgents.has(ctx.discussionInitiator!)) {
    const teacher = ctx.agents.find(
      (a) => a.role === 'teacher' && !ctx.respondedAgents.has(a.id),
    );
    if (teacher) {
      return {
        nextAgentId: teacher.id,
        shouldEnd: false,
        reason: 'Teacher guides discussion after initiator',
        usedFastPath: true,
      };
    }
  }

  return null;
};

/** Rule 5: Teacher-first heuristic for user questions. */
const ruleTeacherFirst: RuleFn = (ctx): RoutingDecision | null => {
  if (ctx.lastSpeakerRole === 'teacher') return null; // Teacher just spoke
  if (!ctx.userMessage) return null;

  const questionKeywords = ['是什么', '为什么', '如何', '定义', '概念', 'what', 'why', 'how', 'define'];
  const hasQuestion = questionKeywords.some((kw) => ctx.userMessage!.toLowerCase().includes(kw));

  if (hasQuestion) {
    const teacher = ctx.agents.find(
      (a) => a.role === 'teacher' && !ctx.respondedAgents.has(a.id),
    );
    if (teacher) {
      return {
        nextAgentId: teacher.id,
        shouldEnd: false,
        reason: 'User asked a question, teacher answers first',
        usedFastPath: true,
      };
    }
  }
  return null;
};

/** Rule 6: Round-robin fallback for balanced participation. */
const ruleRoundRobin: RuleFn = (ctx): RoutingDecision | null => {
  const available = ctx.agents.filter(
    (a) => a.enabled !== false && !ctx.respondedAgents.has(a.id),
  );
  if (available.length === 0) return null;

  // Prefer lower-priority (higher number) agents first for balance
  available.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return {
    nextAgentId: available[0].id,
    shouldEnd: false,
    reason: 'Round-robin: next available agent',
    usedFastPath: true,
  };
};

// ─── Rule engine ───

const RULES: RuleFn[] = [
  ruleAllSpoken,
  ruleMaxTurns,
  ruleWhiteboardCrowded,
  ruleDiscussionOrder,
  ruleTeacherFirst,
  ruleRoundRobin,
];

/**
 * Evaluate routing rules in priority order.
 * Returns first matching decision or null if no rule matches.
 */
export function evaluateRoutingRules(ctx: RoutingContext): RoutingDecision | null {
  for (const rule of RULES) {
    const decision = rule(ctx);
    if (decision) return decision;
  }
  return null;
}

/**
 * Make a routing decision using the fast-path rule engine.
 * Falls back to LLM if no rule produces a decision.
 *
 * @returns Routing decision with `usedFastPath` flag indicating
 *          whether the rule engine or LLM was used.
 */
export function makeRoutingDecision(
  ctx: RoutingContext,
  llmDecisionFn?: () => Promise<{ nextAgentId: string | null; shouldEnd: boolean; reason: string }>,
): Promise<RoutingDecision> {
  const fastPath = evaluateRoutingRules(ctx);
  if (fastPath) {
    return Promise.resolve(fastPath);
  }

  // LLM fallback
  if (llmDecisionFn) {
    return llmDecisionFn().then((r) => ({ ...r, usedFastPath: false }));
  }

  return Promise.resolve({
    nextAgentId: null,
    shouldEnd: true,
    reason: 'No rule matched and no LLM fallback provided',
    usedFastPath: false,
  });
}
