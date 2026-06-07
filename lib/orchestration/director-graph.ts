/**
 * Director Graph — Barrel Export
 *
 * Re-exports the orchestration graph and state management utilities.
 * The graph has been split into modular components:
 *   - graph-definition.ts: StateGraph topology
 *   - director-node.ts: Director routing logic
 *   - agent-node.ts: Agent generation and streaming
 *   - state-manager.ts: State definition and utilities
 *   - config.ts: Configuration constants
 *   - agent-memory.ts: Cross-turn memory system
 *   - conversation-compression.ts: History summarization
 */

export { createOrchestrationGraph } from './graph-definition';
export {
  buildInitialState,
  OrchestratorState,
  resolveAgent,
  maybeCompressHistory,
} from './state-manager';
export { directorNode, directorCondition } from './director-node';
export { agentGenerateNode, runAgentGeneration } from './agent-node';
export { getAgentMemory, formatAgentMemory } from './agent-memory';
export { compressMessageHistory } from './conversation-compression';
export type { OrchestratorStateType } from './state-manager';
export type { AgentMemory } from './agent-memory';

// Re-export config for external consumers
export * from './config';
