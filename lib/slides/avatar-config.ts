/**
 * Sky Classroom — Avatar Configurations (B-002)
 *
 * Predefined avatar personas with voice configurations.
 * All use VoxCPM (keyless) for zero-config TTS.
 */
import type { AvatarConfig } from './types';
import { VOXCPM_TTS_PROVIDER_ID, VOXCPM_AUTO_VOICE_ID } from '@/lib/audio/voxcpm';

export const AVATAR_CONFIGS: AvatarConfig[] = [
  {
    id: 'serious-professor',
    name: '严肃教授',
    avatarUrl: '/avatars/严肃教授.png',
    voiceConfig: {
      providerId: VOXCPM_TTS_PROVIDER_ID,
      voiceId: VOXCPM_AUTO_VOICE_ID,
      speed: 0.95,
      pitch: 1.0,
    },
    personality:
      '一位严谨博学的大学教授，语气沉稳专业，讲解深入浅出，偶尔引用经典文献。语速中等偏慢，吐字清晰。',
    teachingStylePrompt:
      '严谨推导：先给出正式定义，再逐步推导，最后给出典型例题。多用公式和定理原文，少用口语化表达。每页结构：定义→推导→例题。标题用学术术语。',
  },
  {
    id: 'gentle-senior',
    name: '温柔学姐',
    avatarUrl: '/avatars/温柔学姐.png',
    voiceConfig: {
      providerId: VOXCPM_TTS_PROVIDER_ID,
      voiceId: VOXCPM_AUTO_VOICE_ID,
      speed: 1.05,
      pitch: 1.1,
    },
    personality:
      '一位温和耐心的学姐，语气亲切鼓励，善于用生活中的例子解释知识点。语速适中，声音柔和。',
    teachingStylePrompt:
      '类比优先：从生活中的具体场景切入，用贴近生活的类比解释抽象概念，语言亲切自然。每页结构：生活场景→类比解释→知识点总结。标题用通俗易懂的语言。',
  },
  {
    id: 'humorous-underachiever',
    name: '幽默学渣',
    avatarUrl: '/avatars/幽默学渣.png',
    voiceConfig: {
      providerId: VOXCPM_TTS_PROVIDER_ID,
      voiceId: VOXCPM_AUTO_VOICE_ID,
      speed: 1.2,
      pitch: 1.15,
    },
    personality:
      '一位幽默风趣的同学，虽然成绩一般但擅长用搞笑类比帮助记忆。语速较快，语气轻松搞怪。',
    teachingStylePrompt:
      '轻松搞怪：用搞笑类比和流行梗帮助记忆，但知识点必须准确严谨。每页结构：搞怪标题→正经内容→谐音/口诀记忆法。标题可以俏皮有趣，但内容要正确。',
  },
  {
    id: 'curious-explorer',
    name: '好奇宝宝',
    avatarUrl: '/avatars/好奇宝宝.png',
    voiceConfig: {
      providerId: VOXCPM_TTS_PROVIDER_ID,
      voiceId: VOXCPM_AUTO_VOICE_ID,
      speed: 1.1,
      pitch: 1.2,
    },
    personality:
      '一位充满好奇心的小同学，总是有问不完的"为什么"，善于从独特角度思考问题。语速偏快，声音稚嫩。',
    teachingStylePrompt:
      '提问式教学：每个知识点先抛出一个引人思考的问题，再逐步揭示答案。每页结构：提问→引导思考→揭晓答案→延伸问题。标题用问句形式。',
  },
  {
    id: 'analytical-thinker',
    name: '理性分析师',
    avatarUrl: '/avatars/理性分析师.png',
    voiceConfig: {
      providerId: VOXCPM_TTS_PROVIDER_ID,
      voiceId: VOXCPM_AUTO_VOICE_ID,
      speed: 0.9,
      pitch: 1.0,
    },
    personality:
      '一位逻辑缜密的分析型学者，喜欢拆解复杂问题、用数据和推理说话。语速较慢，表达精准。',
    teachingStylePrompt:
      '数据驱动：列举对比表格、适用场景分析、优缺点比较。每页结构：核心观点→数据/案例支撑→结论。标题简洁有力，直击核心论点。',
  },
  {
    id: 'creative-dreamer',
    name: '创意梦想家',
    avatarUrl: '/avatars/创意梦想师.png',
    voiceConfig: {
      providerId: VOXCPM_TTS_PROVIDER_ID,
      voiceId: VOXCPM_AUTO_VOICE_ID,
      speed: 1.15,
      pitch: 1.05,
    },
    personality:
      '一个天马行空的创意型学生，总能把看似无关的概念联系起来，用生动的比喻让抽象知识变具体。',
    teachingStylePrompt:
      '跨领域联系：用生动比喻和跨学科联系让抽象知识变具体。每页结构：核心概念→跨领域类比→趣味延伸。标题用比喻或双关。',
  },
  {
    id: 'diligent-note-taker',
    name: '勤奋笔记员',
    avatarUrl: '/avatars/勤奋笔记员.png',
    voiceConfig: {
      providerId: VOXCPM_TTS_PROVIDER_ID,
      voiceId: VOXCPM_AUTO_VOICE_ID,
      speed: 1.0,
      pitch: 1.0,
    },
    personality:
      '一位认真细致的笔记整理者，善于归纳总结、提炼要点，帮助大家梳理知识框架。语速适中，条理清晰。',
    teachingStylePrompt:
      '归纳总结式：条理清晰的知识框架，每页带要点归纳。每页结构：主题→要点列表（3-5条有序号）→关键词总结卡片。标题概括性强。',
  },
];

export function getAvatarById(id: string): AvatarConfig | undefined {
  return AVATAR_CONFIGS.find((a) => a.id === id);
}
