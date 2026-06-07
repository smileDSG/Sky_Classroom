'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { getAvailableProvidersWithVoices } from '@/lib/audio/voice-resolver';
import { useVoxCPMVoiceProfiles } from '@/lib/audio/voxcpm-voices';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Shuffle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TeacherVoicePill } from './teacher-voice-pill';
import { AgentSelectorRow } from './agent-selector-row';
import { MaxTurnsStepper } from './max-turns-stepper';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { TTSProviderId } from '@/lib/audio/types';
import type { ProviderWithVoices } from '@/lib/audio/voice-resolver';

export function AgentBar() {
  const { t } = useI18n();
  const { listAgents } = useAgentRegistry();
  const selectedAgentIds = useSettingsStore((s) => s.selectedAgentIds);
  const setSelectedAgentIds = useSettingsStore((s) => s.setSelectedAgentIds);
  const maxTurns = useSettingsStore((s) => s.maxTurns);
  const setMaxTurns = useSettingsStore((s) => s.setMaxTurns);
  const agentMode = useSettingsStore((s) => s.agentMode);
  const setAgentMode = useSettingsStore((s) => s.setAgentMode);
  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);

  const [open, setOpen] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const { profiles: voxcpmProfiles } = useVoxCPMVoiceProfiles();
  const containerRef = useRef<HTMLDivElement>(null);

  // Load browser native TTS voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const loadVoices = () => setBrowserVoices(speechSynthesis.getVoices());
    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const allAgents = listAgents();
  const agents = allAgents.filter((a) => !a.isGenerated);
  const teacherAgent = agents.find((a) => a.role === 'teacher');
  const selectedAgents = agents.filter((a) => selectedAgentIds.includes(a.id));
  const nonTeacherSelected = selectedAgents.filter((a) => a.role !== 'teacher');

  const serverProviders = getAvailableProvidersWithVoices(ttsProvidersConfig, voxcpmProfiles);
  const availableProviders: ProviderWithVoices[] = [
    ...serverProviders,
    ...(browserVoices.length > 0
      ? [
          {
            providerId: 'browser-native-tts' as TTSProviderId,
            providerName: 'Browser Native',
            voices: browserVoices.map((v) => ({ id: v.voiceURI, name: v.name })),
            modelGroups: [
              {
                modelId: '',
                modelName: 'Browser Native',
                voices: browserVoices.map((v) => ({ id: v.voiceURI, name: v.name })),
              },
            ],
          },
        ]
      : []),
  ];
  const showVoice = availableProviders.length > 0;

  // Collapse on outside click (except Radix portals)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current && containerRef.current.contains(target)) return;
      if ((target as Element).closest?.('[data-radix-popper-content-wrapper]')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleModeChange = (mode: 'preset' | 'auto') => {
    setAgentMode(mode);
    if (mode === 'preset') {
      // Remove stale auto-generated agent IDs that may linger from a previous auto classroom
      const presetIds = selectedAgentIds.filter((id) => agents.some((a) => a.id === id));
      const hasTeacher = presetIds.some((id) => {
        const a = agents.find((agent) => agent.id === id);
        return a?.role === 'teacher';
      });
      if (!hasTeacher && teacherAgent) {
        presetIds.unshift(teacherAgent.id);
      }
      setSelectedAgentIds(
        presetIds.length > 0 ? presetIds : ['default-1', 'default-2', 'default-3'],
      );
    }
  };

  const toggleAgent = (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent?.role === 'teacher') return;
    if (selectedAgentIds.includes(agentId)) {
      setSelectedAgentIds(selectedAgentIds.filter((id) => id !== agentId));
    } else {
      setSelectedAgentIds([...selectedAgentIds, agentId]);
    }
  };

  const getAgentName = (agent: { id: string; name: string }) => {
    const key = `settings.agentNames.${agent.id}`;
    const translated = t(key);
    return translated !== key ? translated : agent.name;
  };

  const getAgentRole = (agent: { role: string }) => {
    const key = `settings.agentRoles.${agent.role}`;
    const translated = t(key);
    return translated !== key ? translated : agent.role;
  };

  const avatarRow = (
    <div className="flex items-center gap-1.5 shrink-0">
      {teacherAgent && (
        <div className="size-8 rounded-full overflow-hidden ring-2 ring-blue-400/40 dark:ring-blue-500/30 shrink-0">
          <img
            src={teacherAgent.avatar}
            alt={getAgentName(teacherAgent)}
            className="size-full object-cover"
          />
        </div>
      )}

      {agentMode === 'auto' ? (
        <>
          <div className="flex -space-x-2">
            {agents.find((a) => a.role === 'assistant') && (
              <div className="size-6 rounded-full overflow-hidden ring-[1.5px] ring-background">
                <img
                  src={agents.find((a) => a.role === 'assistant')!.avatar}
                  alt=""
                  className="size-full object-cover"
                />
              </div>
            )}
          </div>
          <Shuffle className="size-4 text-violet-400 dark:text-violet-500" />
        </>
      ) : (
        <>
          {nonTeacherSelected.length > 0 && (
            <div className="flex -space-x-2">
              {nonTeacherSelected.slice(0, 4).map((agent) => (
                <div
                  key={agent.id}
                  className="size-6 rounded-full overflow-hidden ring-[1.5px] ring-background"
                >
                  <img
                    src={agent.avatar}
                    alt={getAgentName(agent)}
                    className="size-full object-cover"
                  />
                </div>
              ))}
              {nonTeacherSelected.length > 4 && (
                <div className="size-6 rounded-full bg-muted ring-[1.5px] ring-background flex items-center justify-center">
                  <span className="text-[9px] font-bold text-muted-foreground">
                    +{nonTeacherSelected.length - 4}
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {showVoice &&
        (ttsEnabled ? (
          <Volume2 className="size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
        ) : (
          <VolumeX className="size-3.5 text-muted-foreground/30" />
        ))}
    </div>
  );

  return (
    <div ref={containerRef} className="relative w-96">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={cn(
              'group flex items-center gap-2 cursor-pointer rounded-full px-2.5 py-2 transition-all w-full',
              'border border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-muted/60',
            )}
            onClick={() => setOpen(!open)}
          >
            <span className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors hidden sm:block font-medium flex-1 text-left truncate">
              {open ? t('agentBar.expandedTitle') : t('agentBar.readyToLearn')}
            </span>
            {avatarRow}
            {open ? (
              <ChevronUp className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
            ) : (
              <ChevronDown className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
            )}
          </button>
        </TooltipTrigger>
        {!open && (
          <TooltipContent side="bottom" sideOffset={4}>
            {t('agentBar.configTooltip')}
          </TooltipContent>
        )}
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute right-0 top-full mt-1 z-50 w-96"
          >
            <div className="rounded-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] shadow-[0_1px_8px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_8px_-2px_rgba(0,0,0,0.3)] px-2 py-1.5">
              {/* Teacher — always visible */}
              {teacherAgent && (
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-primary/5 mb-2">
                  <div
                    className="size-7 rounded-full overflow-hidden shrink-0 ring-1 ring-border/40"
                    style={{ boxShadow: `0 0 0 2px ${teacherAgent.color}30` }}
                  >
                    <img
                      src={teacherAgent.avatar}
                      alt={getAgentName(teacherAgent)}
                      className="size-full object-cover"
                    />
                  </div>
                  <span className="text-[13px] font-medium truncate min-w-0 flex-1">
                    {getAgentName(teacherAgent)}
                  </span>
                  {showVoice && (
                    <TeacherVoicePill
                      availableProviders={availableProviders}
                      disabled={!ttsEnabled}
                    />
                  )}
                </div>
              )}

              {/* Mode tabs */}
              <div className="flex rounded-lg border bg-muted/30 p-0.5 mb-2">
                <button
                  onClick={() => handleModeChange('preset')}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center',
                    agentMode === 'preset'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t('settings.agentModePreset')}
                </button>
                <button
                  onClick={() => handleModeChange('auto')}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-medium rounded-md transition-all text-center flex items-center justify-center gap-1',
                    agentMode === 'auto'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  {t('settings.agentModeAuto')}
                </button>
              </div>

              {agentMode === 'preset' ? (
                <div className="max-h-56 overflow-y-auto -mx-0.5">
                  {agents
                    .filter((a) => a.role !== 'teacher')
                    .map((agent, idx) => (
                      <AgentSelectorRow
                        key={agent.id}
                        agent={agent}
                        agentIndex={idx + 1}
                        isSelected={selectedAgentIds.includes(agent.id)}
                        isTeacher={false}
                        availableProviders={availableProviders}
                        showVoice={showVoice}
                        ttsEnabled={ttsEnabled}
                        onToggle={toggleAgent}
                        getDisplayName={getAgentName}
                        getDisplayRole={getAgentRole}
                      />
                    ))}
                </div>
              ) : (
                <div className="flex flex-col items-center pt-6 pb-3 gap-4">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute size-10 rounded-full bg-violet-400/10 dark:bg-violet-400/15 animate-ping [animation-duration:3s]" />
                    <div className="absolute size-12 rounded-full bg-violet-400/5 dark:bg-violet-400/10 animate-pulse [animation-duration:2.5s]" />
                    <Shuffle className="relative size-5 text-violet-400 dark:text-violet-500" />
                  </div>
                  <div className="flex-1" />
                  <div className="text-center space-y-1">
                    <p className="text-[11px] text-muted-foreground/60">
                      {t('settings.agentModeAutoDesc')}
                    </p>
                    <p className="text-[10px] text-muted-foreground/40">
                      {t('agentBar.voiceAutoAssign')}
                    </p>
                  </div>
                </div>
              )}

              <MaxTurnsStepper maxTurns={maxTurns} onSetMaxTurns={setMaxTurns} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
