/**
 * Shared constants for agent profile generation.
 *
 * Used by both the client-side agent-profiles API route and the
 * server-side classroom-generation pipeline to keep colors / avatars in sync.
 */

/** Color palette cycled for generated agents */
export const AGENT_COLOR_PALETTE = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
  '#e11d48',
  '#6366f1',
  '#84cc16',
  '#a855f7',
] as const;

/**
 * Default avatar paths cycled for generated agents.
 *
 * Every entry MUST correspond to a file that exists under `public/avatars/`.
 * 使用与主页一致的 .jpg 格式新头像
 */
export const AGENT_DEFAULT_AVATARS = [
  // 新设计的天空课堂风格头像 (.jpg 格式，与主页一致)
  '/avatars/teacher-new.jpg',
  '/avatars/assistant-new.jpg',
  '/avatars/student-curious-new.jpg',
  '/avatars/student-meme-new.jpg',
  '/avatars/student-reader-new.jpg',
  '/avatars/student-glasses-new.jpg',
  '/avatars/student-cool-new.jpg',
  '/avatars/user.png',
] as const;
