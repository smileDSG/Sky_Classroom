import type { ProviderId } from '@/lib/ai/providers';

export interface SettingsPreset {
  name: string;
  description: string;
  settings: Record<string, unknown>;
}

export const EDUCATION_PRESET: Readonly<SettingsPreset> = Object.freeze({
  name: 'Education',
  description: 'Restore all settings to factory defaults',
  settings: {
    providerId: 'openai' as ProviderId,
    modelId: '',
    agentMode: 'preset' as const,
    autoAgentCount: 3,
    ttsMuted: false,
    ttsVolume: 1,
    ttsEnabled: true,
    asrEnabled: true,
    timelineCollapsed: true,
    chatAreaCollapsed: true,
    chatAreaWidth: 320,
  },
});
