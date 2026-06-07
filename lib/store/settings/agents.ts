export interface AgentsSliceState {
  selectedAgentIds: string[];
  maxTurns: string;
  agentMode: 'preset' | 'auto';
  autoAgentCount: number;
}

export interface AgentsSliceActions {
  setSelectedAgentIds: (ids: string[]) => void;
  setMaxTurns: (turns: string) => void;
  setAgentMode: (mode: 'preset' | 'auto') => void;
  setAutoAgentCount: (count: number) => void;
}

export function getDefaultAgentsState() {
  return {
    selectedAgentIds: ['default-1', 'default-2', 'default-3'],
    maxTurns: '10',
    agentMode: 'auto' as const,
    autoAgentCount: 3,
  };
}

export function createAgentsActions(
  set: (
    partial:
      | Partial<AgentsSliceState>
      | ((state: AgentsSliceState) => Partial<AgentsSliceState>),
  ) => void,
): AgentsSliceActions {
  return {
    setSelectedAgentIds: (ids) => set({ selectedAgentIds: ids }),
    setMaxTurns: (turns) => set({ maxTurns: turns }),
    setAgentMode: (mode) => set({ agentMode: mode }),
    setAutoAgentCount: (count) => set({ autoAgentCount: count }),
  };
}
