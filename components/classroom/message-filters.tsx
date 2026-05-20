/**
 * Message filters for ChatArea — filter by type and agent.
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MessageSquare, BookOpen, HelpCircle, Bot } from 'lucide-react';

export interface MessageFilterState {
  types: Set<'discussion' | 'lecture' | 'qa' | 'system'>;
  agentIds: Set<string>;
}

interface MessageFiltersProps {
  filters: MessageFilterState;
  onChange: (filters: MessageFilterState) => void;
  availableAgents: { id: string; name: string }[];
  className?: string;
}

const TYPE_FILTERS: { key: 'discussion' | 'lecture' | 'qa' | 'system'; label: string; icon: React.ReactNode }[] = [
  { key: 'lecture', label: 'Lecture', icon: <BookOpen className="w-3 h-3" /> },
  { key: 'discussion', label: 'Discussion', icon: <MessageSquare className="w-3 h-3" /> },
  { key: 'qa', label: 'Q&A', icon: <HelpCircle className="w-3 h-3" /> },
  { key: 'system', label: 'System', icon: <Bot className="w-3 h-3" /> },
];

export function MessageFilters({ filters, onChange, availableAgents, className }: MessageFiltersProps) {
  const toggleType = (type: MessageFilterState['types'] extends Set<infer U> ? U : never) => {
    const next = new Set(filters.types);
    next.has(type) ? next.delete(type) : next.add(type);
    onChange({ ...filters, types: next });
  };

  const toggleAgent = (agentId: string) => {
    const next = new Set(filters.agentIds);
    next.has(agentId) ? next.delete(agentId) : next.add(agentId);
    onChange({ ...filters, agentIds: next });
  };

  const clearAll = () => {
    onChange({ types: new Set(), agentIds: new Set() });
  };

  const isActive = filters.types.size > 0 || filters.agentIds.size > 0;

  return (
    <div className={cn('flex flex-wrap gap-1.5 items-center px-2 py-1.5 border-b bg-muted/30', className)}>
      {TYPE_FILTERS.map((t) => (
        <Badge
          key={t.key}
          variant={filters.types.has(t.key) ? 'default' : 'outline'}
          className={cn(
            'cursor-pointer text-xs gap-1 px-2 py-0.5 transition-colors',
            !filters.types.has(t.key) && 'opacity-60 hover:opacity-100',
          )}
          onClick={() => toggleType(t.key)}
        >
          {t.icon}
          {t.label}
        </Badge>
      ))}

      {availableAgents.map((agent) => (
        <Badge
          key={agent.id}
          variant={filters.agentIds.has(agent.id) ? 'default' : 'outline'}
          className={cn(
            'cursor-pointer text-xs gap-1 px-2 py-0.5 transition-colors',
            !filters.agentIds.has(agent.id) && 'opacity-60 hover:opacity-100',
          )}
          onClick={() => toggleAgent(agent.id)}
        >
          {agent.name}
        </Badge>
      ))}

      {isActive && (
        <button onClick={clearAll} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
          Clear all
        </button>
      )}
    </div>
  );
}
