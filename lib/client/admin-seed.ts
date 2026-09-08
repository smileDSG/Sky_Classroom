/**
 * Client-side admin seed.
 * Ensures the admin account exists in IndexedDB/localStorage.
 */

export async function ensureAdminUserClient(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;

  try {
    // Keep server storage details out of the client bundle.
    await fetch('/api/auth/seed-admin', { method: 'POST' });
  } catch {
    // Silent fail
  }
}
