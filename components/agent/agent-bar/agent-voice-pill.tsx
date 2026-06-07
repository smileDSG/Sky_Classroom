'use client';

import { useState, useMemo, useCallback } from 'react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { useAgentRegistry } from '@/lib/orchestration/registry/store';
import { resolveAgentVoice } from '@/lib/audio/voice-resolver';
import { useVoicePreview } from './use-voice-preview';
import { getFilteredModelGroups } from './voice-utils';
import { VoicePickerPopover } from './voice-picker-popover';
import { VOXCPM_AUTO_VOICE_ID } from '@/lib/audio/voxcpm';
import type { AgentConfig } from '@/lib/orchestration/registry/types';
import type { TTSProviderId } from '@/lib/audio/types';
import type { ProviderWithVoices } from '@/lib/audio/voice-resolver';

interface AgentVoicePillProps {
  agent: AgentConfig;
  agentIndex: number;
  availableProviders: ProviderWithVoices[];
  disabled?: boolean;
}

/**
 * Voice selection pill for a specific agent.
 * Reads the agent's voiceConfig (or falls back to a deterministic default)
 * and writes through to `useAgentRegistry.updateAgent`.
 */
export function AgentVoicePill({
  agent,
  agentIndex,
  availableProviders,
  disabled,
}: AgentVoicePillProps) {
  const { t } = useI18n();
  const updateAgent = useAgentRegistry((s) => s.updateAgent);

  const resolved = resolveAgentVoice(agent, agentIndex, availableProviders);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');

  const { previewingId, handlePreview, stopPreview } = useVoicePreview({
    agentName: agent.name,
    agentRole: agent.role,
    agentPersona: agent.persona,
  });

  const visibleProviderGroups = useMemo(
    () =>
      availableProviders
        .map((provider) => ({
          provider,
          groups: getFilteredModelGroups(provider, voiceQuery),
        }))
        .filter(({ groups }) => groups.length > 0),
    [availableProviders, voiceQuery],
  );

  const displayName = useMemo(() => {
    for (const p of availableProviders) {
      if (p.providerId === resolved.providerId) {
        const v = p.voices.find((voice) => voice.id === resolved.voiceId);
        if (v) return v.id === VOXCPM_AUTO_VOICE_ID ? t('settings.voxcpmAutoVoice') : v.name;
      }
    }
    return resolved.voiceId;
  }, [availableProviders, resolved.providerId, resolved.voiceId, t]);

  const isActive = useCallback(
    (providerId: TTSProviderId, voiceId: string, modelId: string) =>
      resolved.providerId === providerId &&
      resolved.voiceId === voiceId &&
      (resolved.modelId || '') === modelId,
    [resolved],
  );

  const handleSelect = useCallback(
    (providerId: TTSProviderId, voiceId: string, modelId?: string) => {
      updateAgent(agent.id, {
        voiceConfig: {
          providerId,
          modelId: modelId || undefined,
          voiceId,
        },
      });
      setPopoverOpen(false);
    },
    [agent.id, updateAgent],
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setPopoverOpen(open);
      if (!open) {
        setVoiceQuery('');
        stopPreview();
      }
    },
    [stopPreview],
  );

  return (
    <VoicePickerPopover
      open={popoverOpen}
      onOpenChange={handleOpenChange}
      voiceQuery={voiceQuery}
      onVoiceQueryChange={setVoiceQuery}
      visibleProviderGroups={visibleProviderGroups}
      isActive={isActive}
      onSelect={handleSelect}
      handlePreview={handlePreview}
      previewingId={previewingId}
      displayName={displayName}
      disabled={disabled}
    />
  );
}
