/**
 * Sky Classroom — Avatar Presets (B-004)
 *
 * Structured preset data for all 7 NPC avatars.
 * Each preset includes id, name, description, and teaching style.
 */
import { AVATAR_CONFIGS } from './avatar-config';

export interface AvatarPreset {
  id: string;
  name: string;
  avatarUrl: string;
  description: string;
  style: 'academic' | 'friendly' | 'humorous' | 'curious' | 'analytical' | 'creative' | 'organized';
}

export const AVATAR_PRESETS: AvatarPreset[] = AVATAR_CONFIGS.map((a) => ({
  id: a.id,
  name: a.name,
  avatarUrl: a.avatarUrl,
  description: a.personality,
  style: inferStyle(a.id),
}));

function inferStyle(id: string): AvatarPreset['style'] {
  const map: Record<string, AvatarPreset['style']> = {
    'serious-professor': 'academic',
    'gentle-senior': 'friendly',
    'humorous-underachiever': 'humorous',
    'curious-explorer': 'curious',
    'analytical-thinker': 'analytical',
    'creative-dreamer': 'creative',
    'diligent-note-taker': 'organized',
  };
  return map[id] || 'friendly';
}

export function getAvatarPresetById(id: string): AvatarPreset | undefined {
  return AVATAR_PRESETS.find((a) => a.id === id);
}
