/**
 * Role Balance — Speaking Counter + Forced Rotation Fallback
 *
 * Ensures balanced participation across agents in multi-agent
 * conversations. Tracks speaking counts and enforces rotation
 * when a single agent dominates.
 */

import type { AgentConfig } from '@/lib/orchestration/registry/types';

export interface RoleBalanceState {
  speakingCounts: Map<string, number>; // agentId -> count
  totalTurns: number;
  lastSpeakerId: string | null;
  consecutiveSameAgent: number;
}

export interface BalanceCheck {
  isBalanced: boolean;
  overrepresentedAgent?: string;
  underrepresentedAgents: string[];
  recommendation: string;
}

export function createBalanceState(): RoleBalanceState {
  return {
    speakingCounts: new Map(),
    totalTurns: 0,
    lastSpeakerId: null,
    consecutiveSameAgent: 0,
  };
}

/**
 * Record that an agent has spoken.
 */
export function recordSpeaker(state: RoleBalanceState, agentId: string): void {
  const current = state.speakingCounts.get(agentId) || 0;
  state.speakingCounts.set(agentId, current + 1);
  state.totalTurns++;

  if (state.lastSpeakerId === agentId) {
    state.consecutiveSameAgent++;
  } else {
    state.consecutiveSameAgent = 1;
  }
  state.lastSpeakerId = agentId;
}

/**
 * Check if speaking distribution is balanced.
 * An agent is overrepresented if it has spoken >2x the average.
 */
export function checkBalance(
  state: RoleBalanceState,
  agents: AgentConfig[],
): BalanceCheck {
  const activeAgents = agents.filter((a) => a.enabled !== false);
  if (activeAgents.length === 0 || state.totalTurns === 0) {
    return {
      isBalanced: true,
      underrepresentedAgents: activeAgents.map((a) => a.id),
      recommendation: 'No turns yet',
    };
  }

  const avg = state.totalTurns / activeAgents.length;
  const threshold = avg * 2; // 2x average is overrepresented

  const overrepresented: string[] = [];
  const underrepresented: string[] = [];

  for (const agent of activeAgents) {
    const count = state.speakingCounts.get(agent.id) || 0;
    if (count > threshold) {
      overrepresented.push(agent.id);
    } else if (count < avg * 0.5) {
      underrepresented.push(agent.id);
    }
  }

  const isBalanced = overrepresented.length === 0;

  let recommendation = 'Distribution is balanced';
  if (!isBalanced) {
    recommendation = `Route to: ${underrepresented.join(', ') || 'any available agent'}`;
  }

  return {
    isBalanced,
    overrepresentedAgent: overrepresented[0],
    underrepresentedAgents: underrepresented,
    recommendation,
  };
}

/**
 * Get the next agent to speak based on forced rotation.
 * Selects the agent with the lowest speaking count.
 */
export function selectNextByRotation(
  state: RoleBalanceState,
  agents: AgentConfig[],
  respondedAgents: Set<string>,
): string | null {
  const available = agents.filter(
    (a) => a.enabled !== false && !respondedAgents.has(a.id),
  );

  if (available.length === 0) return null;

  // Select agent with lowest speaking count
  available.sort((a, b) => {
    const countA = state.speakingCounts.get(a.id) || 0;
    const countB = state.speakingCounts.get(b.id) || 0;
    return countA - countB;
  });

  return available[0].id;
}

/**
 * Get speaking statistics for reporting.
 */
export function getSpeakingStats(state: RoleBalanceState, agents: AgentConfig[]) {
  const stats: Record<string, { count: number; percentage: number }> = {};
  for (const agent of agents) {
    const count = state.speakingCounts.get(agent.id) || 0;
    stats[agent.id] = {
      count,
      percentage: state.totalTurns > 0 ? count / state.totalTurns : 0,
    };
  }
  return { stats, totalTurns: state.totalTurns };
}
