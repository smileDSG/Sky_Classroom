'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, User, Users, Sparkles, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: string;
  priority: number;
  allowedActions: string[];
}

interface AgentSettingsProps {
  agents: Agent[];
  selectedAgentIds: string[];
  maxTurns: string;
  agentMode: 'preset' | 'auto';
  onToggleAgent: (agentId: string) => void;
  onMaxTurnsChange: (value: string) => void;
  onAgentModeChange: (mode: 'preset' | 'auto') => void;
  t?: (key: string) => string;
}

export function AgentSettings({
  agents,
  selectedAgentIds,
  maxTurns,
  agentMode,
  onToggleAgent,
  onMaxTurnsChange,
  onAgentModeChange,
  t = (key: string) => key,
}: AgentSettingsProps) {const getAgentName = (agent: Agent) => {
    const key = `settings.agentNames.${agent.id}`;
    const translated = t(key);
    return translated !== key ? translated : agent.name;
  };

  const getAgentRole = (agent: Agent) => {
    const key = `settings.agentRoles.${agent.role}`;
    const translated = t(key);
    return translated !== key ? translated : agent.role;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-4">
        {/* Mode Toggle */}
        <div className="space-y-2">
          <Label>{'智能体模式'}</Label>
          <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
            <button
              onClick={() => onAgentModeChange('preset')}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
                agentMode === 'preset'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {'预设模式'}
            </button>
            <button
              onClick={() => onAgentModeChange('auto')}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5',
                agentMode === 'auto'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {'自动生成'}
            </button>
          </div>
        </div>

        {agentMode === 'preset' ? (
          <>
            {/* Preset mode: existing agent multi-select */}
            <div className="space-y-2">
              <Label>{'选择智能体'}</Label>
              <p className="text-sm text-muted-foreground">{'选择参与对话的智能体。选择1个为单智能体模式，选择多个为多智能体协作模式。'}</p>
            </div>

            <div className="space-y-2 border rounded-lg p-2 bg-muted/30">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={cn(
                    'flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer',
                    selectedAgentIds.includes(agent.id)
                      ? 'bg-primary/10 border-primary/50 shadow-sm'
                      : 'bg-background hover:bg-muted/50 border-transparent',
                  )}
                  onClick={() => onToggleAgent(agent.id)}
                >
                  <Checkbox
                    id={`agent-${agent.id}`}
                    checked={selectedAgentIds.includes(agent.id)}
                    onCheckedChange={() => onToggleAgent(agent.id)}
                    disabled={agent.role === 'teacher'}
                  />
                  <Avatar className="size-10">
                    <AvatarImage src={agent.avatar} alt={getAgentName(agent)} />
                    <AvatarFallback>{getAgentName(agent).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-1.5">
                      {getAgentName(agent)}
                      {agent.role === 'teacher' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 leading-none">
                          {'必选'}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{getAgentRole(agent)}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mode indicator */}
            <div
              className={`p-3 rounded-lg text-sm ${
                selectedAgentIds.length === 0
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                  : selectedAgentIds.length === 1
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
              }`}
            >
              {selectedAgentIds.length === 0 && (
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  {'请至少选择1个智能体'}
                </span>
              )}
              {selectedAgentIds.length === 1 && (
                <span className="flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  <strong>{'单智能体模式'}</strong> -{' '}
                  {(() => {
                    const agent = agents.find((a) => a.id === selectedAgentIds[0]);
                    return agent ? getAgentName(agent) : '选中的智能体';
                  })()}{' '}
                  {'直接回答'}
                </span>
              )}
              {selectedAgentIds.length > 1 && (
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <strong>{'多智能体模式'}</strong> -{' '}
                  {`已选择 ${selectedAgentIds.length} 个智能体协作讨论`}
                </span>
              )}
            </div>

            {/* Max turns config - only show for multi-agent */}
            {selectedAgentIds.length > 1 && (
              <div className="space-y-2 border-l-4 border-purple-500 pl-4">
                <Label>{'最大讨论轮数'}</Label>
                <p className="text-xs text-muted-foreground">{'智能体之间最多讨论多少轮（每个智能体完成动作并回复算一轮）'}</p>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={maxTurns}
                  onChange={(e) => onMaxTurnsChange(e.target.value)}
                  className="w-24"
                />
              </div>
            )}
          </>
        ) : (
          <>
            {/* Auto mode: description */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 text-sm">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{'AI 将根据课程内容自动生成适合的课堂角色'}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
