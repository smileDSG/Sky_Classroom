export const QUICK_IDENTITY_KEY = 'skyIdentity';

export type QuickIdentity = 'learner' | 'educator';

export function isQuickIdentity(value: string | null): value is QuickIdentity {
  return value === 'learner' || value === 'educator';
}

export function persistQuickIdentity(identity: QuickIdentity): void {
  try {
    localStorage.setItem(QUICK_IDENTITY_KEY, identity);
  } catch {
    /* localStorage 不可用时静默失败 */
  }
}

export function getQuickIdentity(): QuickIdentity | null {
  try {
    const stored = localStorage.getItem(QUICK_IDENTITY_KEY);
    return isQuickIdentity(stored) ? stored : null;
  } catch {
    return null;
  }
}
