'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { AgentVoicePill } from './agent-voice-pill';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { ProviderWithVoices } from '@/lib/audio/voice-resolver';

interface AgentSelectorRowProps {
  agent: AgentConfig;
  agentIndex: number;
  isSelected: boolean;
  isTeacher: boolean;
  availableProviders: ProviderWithVoices[];
  showVoice: boolean;
  ttsEnabled: boolean;
  onToggle: (id: string) => void;
  getDisplayName: (agent: AgentConfig) => string;
  getDisplayRole: (agent: AgentConfig) => string;
}

/**
 * Renders a single agent row within the AgentBar preset selector list.
 * Displays a checkbox, avatar, display name, role label, and optionally
 * the AgentVoicePill for per-agent voice selection.
 */
export function AgentSelectorRow({
  agent,
  agentIndex,
  isSelected,
  isTeacher,
  availableProviders,
  showVoice,
  ttsEnabled,
  onToggle,
  getDisplayName,
  getDisplayRole,
}: AgentSelectorRowProps) {
  const handleClick = isTeacher ? undefined : () => onToggle(agent.id);

  return (
    <div
      onClick={handleClick}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors',
        isTeacher ? 'bg-primary/5' : 'cursor-pointer',
        !isTeacher && isSelected && 'bg-primary/5',
        !isTeacher && !isSelected && 'hover:bg-muted/50',
      )}
    >
      <Checkbox
        checked={isSelected}
        disabled={isTeacher}
        className={cn('pointer-events-none', isTeacher && 'opacity-50')}
      />
      <div
        className="size-7 rounded-full overflow-hidden shrink-0 ring-1 ring-border/40"
        style={{ boxShadow: isSelected ? `0 0 0 2px ${agent.color}30` : undefined }}
      >
        <img src={agent.avatar} alt={getDisplayName(agent)} className="size-full object-cover" />
      </div>
      <span className="text-[13px] font-medium truncate min-w-0 flex-1">
        {getDisplayName(agent)}
      </span>
      <span className="text-[10px] text-muted-foreground/50 shrink-0 w-[52px] text-right">
        {getDisplayRole(agent)}
      </span>
      {showVoice && (
        <AgentVoicePill
          agent={agent}
          agentIndex={agentIndex}
          availableProviders={availableProviders}
          disabled={!ttsEnabled}
        />
      )}
    </div>
  );
}
