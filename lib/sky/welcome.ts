export const WELCOME_SEEN_KEY = 'skyWelcomeSeen';
export const QUICK_IDENTITY_KEY = 'skyIdentity';

export interface WelcomeEntry {
  href: string;
  label: string;
}

export function welcomeEntriesFor(identity: string | null): WelcomeEntry[] {
  if (identity === 'educator') {
    return [
      { href: '/sky/teaching', label: '备课总览' },
      { href: '/sky/cloud-mind/slides', label: '生成课件' },
    ];
  }
  return [
    { href: '/sky/learning/today', label: '今日计划' },
    { href: '/sky/cloud-mind/solve', label: '拍题解析' },
  ];
}

export function isWelcomeSeen(): boolean {
  try {
    return localStorage.getItem(WELCOME_SEEN_KEY) === 'true';
  } catch {
    return true;
  }
}

export function markWelcomeSeen(): void {
  try {
    localStorage.setItem(WELCOME_SEEN_KEY, 'true');
  } catch {
    /* ignore */
  }
}
