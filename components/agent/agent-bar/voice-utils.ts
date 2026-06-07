import type { TTSProviderId } from '@/lib/audio/types';
import type { ProviderWithVoices } from '@/lib/audio/voice-resolver';
import { VOXCPM_AUTO_VOICE_ID, VOXCPM_TTS_PROVIDER_ID } from '@/lib/audio/voxcpm';

/**
 * Case-insensitive substring match — returns true when `value` contains `query`.
 * `undefined` values are treated as no-match (returns false).
 */
export function matchesVoiceQuery(value: string | undefined, query: string): boolean {
  return !!value?.toLowerCase().includes(query);
}

/**
 * Filter a provider's model groups by a search query.
 * An empty / whitespace-only query returns all groups unfiltered.
 * Each group is only included if at least one voice matches
 * (or the provider/group name itself matches).
 */
export function getFilteredModelGroups(provider: ProviderWithVoices, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return provider.modelGroups;

  return provider.modelGroups
    .map((group) => {
      const groupMatches =
        matchesVoiceQuery(provider.providerName, normalizedQuery) ||
        matchesVoiceQuery(provider.providerId, normalizedQuery) ||
        matchesVoiceQuery(group.modelName, normalizedQuery) ||
        matchesVoiceQuery(group.modelId, normalizedQuery);
      const voices = group.voices.filter(
        (voice) =>
          groupMatches ||
          matchesVoiceQuery(voice.name, normalizedQuery) ||
          matchesVoiceQuery(voice.id, normalizedQuery) ||
          matchesVoiceQuery(voice.language, normalizedQuery),
      );
      return { ...group, voices };
    })
    .filter((group) => group.voices.length > 0);
}

/**
 * Returns `true` for the VoxCPM "auto" voice, which cannot be previewed
 * (it is generated on-the-fly per request, not a fixed voice to audition).
 */
export function isNonPreviewableVoice(providerId: TTSProviderId, voiceId: string): boolean {
  return providerId === VOXCPM_TTS_PROVIDER_ID && voiceId === VOXCPM_AUTO_VOICE_ID;
}
