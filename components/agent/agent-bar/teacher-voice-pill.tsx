'use client';

import { useState, useMemo, useCallback } from 'react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { useVoicePreview } from './use-voice-preview';
import { getFilteredModelGroups } from './voice-utils';
import { VoicePickerPopover } from './voice-picker-popover';
import { VOXCPM_AUTO_VOICE_ID } from '@/lib/audio/voxcpm';
import type { TTSProviderId } from '@/lib/audio/types';
import type { ProviderWithVoices } from '@/lib/audio/voice-resolver';

interface TeacherVoicePillProps {
  availableProviders: ProviderWithVoices[];
  disabled?: boolean;
}

/**
 * Voice selection pill for the global teacher voice.
 * Reads/writes `ttsProviderId`, `ttsVoice`, and `ttsProviderConfig`
 * from `useSettingsStore`, so the teacher always has a single source of truth.
 */
export function TeacherVoicePill({
  availableProviders,
  disabled,
}: TeacherVoicePillProps) {
  const { t } = useI18n();
  const ttsProviderId = useSettingsStore((s) => s.ttsProviderId);
  const ttsVoice = useSettingsStore((s) => s.ttsVoice);
  const setTTSProvider = useSettingsStore((s) => s.setTTSProvider);
  const setTTSVoice = useSettingsStore((s) => s.setTTSVoice);
  const setTTSProviderConfig = useSettingsStore((s) => s.setTTSProviderConfig);
  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');

  const { previewingId, handlePreview, stopPreview } = useVoicePreview({
    agentName: 'Teacher',
    agentRole: 'teacher',
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
      if (p.providerId === ttsProviderId) {
        const v = p.voices.find((voice) => voice.id === ttsVoice);
        if (v) return v.id === VOXCPM_AUTO_VOICE_ID ? t('settings.voxcpmAutoVoice') : v.name;
      }
    }
    return ttsVoice || 'default';
  }, [availableProviders, ttsProviderId, ttsVoice, t]);

  const isActive = useCallback(
    (providerId: TTSProviderId, voiceId: string, modelId: string) => {
      const currentModelId = ttsProvidersConfig[ttsProviderId]?.modelId || '';
      return (
        ttsProviderId === providerId &&
        ttsVoice === voiceId &&
        currentModelId === (modelId || '')
      );
    },
    [ttsProviderId, ttsVoice, ttsProvidersConfig],
  );

  const handleSelect = useCallback(
    (providerId: TTSProviderId, voiceId: string, modelId?: string) => {
      setTTSProvider(providerId);
      setTTSVoice(voiceId);
      if (modelId) {
        setTTSProviderConfig(providerId, { modelId });
      }
      setPopoverOpen(false);
    },
    [setTTSProvider, setTTSVoice, setTTSProviderConfig],
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
