import { useState, useRef, useCallback, useEffect } from 'react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useSettingsStore } from '@/lib/store/settings';
import { playBrowserTTSPreview } from '@/lib/audio/browser-tts-preview';
import { getVoxCPMProviderOptions } from '@/lib/audio/voxcpm-voices';
import type { TTSProviderId } from '@/lib/audio/types';

/**
 * Shared voice-preview logic used by both AgentVoicePill and TeacherVoicePill.
 *
 * Returns:
 * - `previewingId` — the key of the voice currently previewing, or null
 * - `handlePreview` — start or toggle a preview for a given provider + voice
 * - `stopPreview`   — cancel any in-flight preview and reset state
 */
export function useVoicePreview(opts: {
  agentName: string;
  agentRole?: string;
  agentPersona?: string;
}) {
  const { t, locale } = useI18n();
  const ttsProvidersConfig = useSettingsStore((s) => s.ttsProvidersConfig);

  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewCancelRef = useRef<(() => void) | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);

  const stopPreview = useCallback(() => {
    previewCancelRef.current?.();
    previewCancelRef.current = null;
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.src = '';
      previewAudioRef.current = null;
    }
    setPreviewingId(null);
  }, []);

  const handlePreview = useCallback(
    async (providerId: TTSProviderId, voiceId: string, modelId?: string) => {
      const key = `${providerId}::${voiceId}`;
      if (previewingId === key) {
        stopPreview();
        return;
      }
      stopPreview();
      setPreviewingId(key);

      const previewText = t('settings.ttsTestTextDefault');

      if (providerId === 'browser-native-tts') {
        const { promise, cancel } = playBrowserTTSPreview({ text: previewText, voice: voiceId });
        previewCancelRef.current = cancel;
        try {
          await promise;
        } catch {
          // ignore abort
        }
        setPreviewingId(null);
        return;
      }

      // Server TTS
      try {
        const controller = new AbortController();
        previewAbortRef.current = controller;
        const providerConfig = ttsProvidersConfig[providerId];
        const providerOptions =
          providerId === 'voxcpm-tts'
            ? {
                ...(providerConfig?.providerOptions || {}),
                ...(await getVoxCPMProviderOptions(voiceId, {
                  agentName: opts.agentName,
                  role: opts.agentRole,
                  persona: opts.agentPersona,
                  locale,
                })),
              }
            : undefined;
        const res = await fetch('/api/generate/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: previewText,
            audioId: 'voice-preview',
            ttsProviderId: providerId,
            ttsModelId: modelId || providerConfig?.modelId,
            ttsVoice: voiceId,
            ttsSpeed: 1,
            ttsProviderOptions: providerOptions,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('TTS error');
        const data = await res.json();
        if (!data.base64) throw new Error('No audio');

        const audio = new Audio(`data:audio/${data.format || 'mp3'};base64,${data.base64}`);
        previewAudioRef.current = audio;
        audio.addEventListener('ended', () => setPreviewingId(null));
        audio.addEventListener('error', () => setPreviewingId(null));
        await audio.play();
      } catch {
        setPreviewingId(null);
      }
    },
    [
      opts.agentName,
      opts.agentPersona,
      opts.agentRole,
      locale,
      previewingId,
      stopPreview,
      t,
      ttsProvidersConfig,
    ],
  );

  // Cleanup on unmount
  useEffect(() => () => stopPreview(), [stopPreview]);

  return { previewingId, handlePreview, stopPreview };
}
