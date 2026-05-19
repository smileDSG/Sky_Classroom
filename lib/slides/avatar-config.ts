/**
 * Sky Classroom — Avatar Configurations (B-002)
 *
 * Predefined avatar personas with voice configurations.
 * All three use VoxCPM (keyless) for zero-config TTS.
 */
import type { AvatarConfig } from './types';
import { VOXCPM_TTS_PROVIDER_ID, VOXCPM_AUTO_VOICE_ID } from '@/lib/audio/voxcpm';

export const AVATAR_CONFIGS: AvatarConfig[] = [
  {
    id: 'serious-professor',
    name: '严肃教授',
    avatarUrl: '/avatars/teacher.png',
    voiceConfig: {
      providerId: VOXCPM_TTS_PROVIDER_ID,
      voiceId: VOXCPM_AUTO_VOICE_ID,
      speed: 0.95,
      pitch: 1.0,
    },
    personality:
      '一位严谨博学的大学教授，语气沉稳专业，讲解深入浅出，偶尔引用经典文献。语速中等偏慢，吐字清晰。',
  },
  {
    id: 'gentle-senior',
    name: '温柔学姐',
    avatarUrl: '/avatars/assist.png',
    voiceConfig: {
      providerId: VOXCPM_TTS_PROVIDER_ID,
      voiceId: VOXCPM_AUTO_VOICE_ID,
      speed: 1.05,
      pitch: 1.1,
    },
    personality:
      '一位温和耐心的学姐，语气亲切鼓励，善于用生活中的例子解释知识点。语速适中，声音柔和。',
  },
  {
    id: 'humorous-underachiever',
    name: '幽默学渣',
    avatarUrl: '/avatars/clown.png',
    voiceConfig: {
      providerId: VOXCPM_TTS_PROVIDER_ID,
      voiceId: VOXCPM_AUTO_VOICE_ID,
      speed: 1.2,
      pitch: 1.15,
    },
    personality:
      '一位幽默风趣的同学，虽然成绩一般但擅长用搞笑类比帮助记忆。语速较快，语气轻松搞怪。',
  },
];

export function getAvatarById(id: string): AvatarConfig | undefined {
  return AVATAR_CONFIGS.find((a) => a.id === id);
}
