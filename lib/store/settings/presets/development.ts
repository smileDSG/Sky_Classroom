import type { SettingsPreset } from './education';

export const DEVELOPMENT_PRESET: Readonly<SettingsPreset> = Object.freeze({
  name: 'Development',
  description: 'Chat expanded, TTS on, Agent auto mode',
  settings: {
    ttsMuted: false,
    ttsEnabled: true,
    asrEnabled: true,
    timelineCollapsed: true,
    chatAreaCollapsed: false,
    chatAreaWidth: 400,
    agentMode: 'auto' as const,
    autoAgentCount: 5,
  },
});
