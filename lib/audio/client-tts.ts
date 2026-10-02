/**
 * Client-side on-demand TTS: synthesize speech for a single action and cache
 * the result in IndexedDB so playback can reuse it across sessions.
 */

import { useSettingsStore } from '@/lib/store/settings';
import { db } from '@/lib/utils/database';
import { getVoxCPMProviderOptions } from '@/lib/audio/voxcpm-voices';
import { createLogger } from '@/lib/logger';

const log = createLogger('ClientTTS');

/** Generate TTS for one speech action and store in IndexedDB */
export async function generateAndStoreTTS(
  audioId: string,
  text: string,
  language?: string,
  signal?: AbortSignal,
): Promise<void> {
  const settings = useSettingsStore.getState();
  if (settings.ttsProviderId === 'browser-native-tts') return;

  const ttsProviderConfig = settings.ttsProvidersConfig?.[settings.ttsProviderId];
  const providerOptions =
    settings.ttsProviderId === 'voxcpm-tts'
      ? {
          ...(ttsProviderConfig?.providerOptions || {}),
          ...(await getVoxCPMProviderOptions(settings.ttsVoice, { role: 'teacher', language })),
        }
      : undefined;
  const response = await fetch('/api/generate/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      audioId,
      ttsProviderId: settings.ttsProviderId,
      ttsModelId: ttsProviderConfig?.modelId,
      ttsVoice: settings.ttsVoice,
      ttsSpeed: settings.ttsSpeed,
      ttsProviderOptions: providerOptions,
    }),
    signal,
  });

  const data = await response
    .json()
    .catch(() => ({ success: false, error: response.statusText || 'Invalid TTS response' }));
  if (!response.ok || !data.success || !data.base64 || !data.format) {
    const err = new Error(
      data.details || data.error || `TTS request failed: HTTP ${response.status}`,
    );
    log.warn('TTS failed for', audioId, ':', err);
    throw err;
  }

  const binary = atob(data.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: `audio/${data.format}` });
  await db.audioFiles.put({
    id: audioId,
    blob,
    format: data.format,
    createdAt: Date.now(),
  });
}
