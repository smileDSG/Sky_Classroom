/**
 * Agent Registry — unified public API
 */

// Types
export type { AgentConfig, AgentTemplate } from './types';
export { getActionsForRole, ROLE_ACTIONS, WHITEBOARD_ACTIONS, SLIDE_ACTIONS } from './types';

// Store
export {
  useAgentRegistry,
  getDefaultAgents,
  agentsToParticipants,
  loadGeneratedAgentsForStage,
  saveGeneratedAgents,
} from './store';

// Factory
export { AgentFactory, getAgentFactory, resetAgentFactory } from './factory';
export type { GeneratedAgentParams, CustomAgentParams, CourseInfo } from './factory';

// Combination rules
export {
  CombinationRuleEngine,
  getRuleEngine,
  resetRuleEngine,
  DEFAULT_COMBO_RULES,
} from './combination-rules';
export type { ComboRule, RecommendedCombo } from './combination-rules';

// Templates
export {
  ALL_DEFAULT_TEMPLATES,
  DEFAULT_AGENT_IDS,
  DEFAULT_AGENT_TEMPLATE_MAP,
} from './templates';
