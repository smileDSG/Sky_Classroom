/**
 * Offline sync queue — stores pending API calls for retry when online.
 */

const QUEUE_KEY = 'openmaic-sync-queue';

export interface QueuedAction {
  id: string;
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  createdAt: number;
  retryCount: number;
}

function getQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueAction(action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount'>): void {
  const queue = getQueue();
  queue.push({
    ...action,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    retryCount: 0,
  });
  saveQueue(queue);
}

export async function syncQueue(): Promise<void> {
  const queue = getQueue();
  if (queue.length === 0) return;

  const remaining: QueuedAction[] = [];
  for (const action of queue) {
    try {
      const res = await fetch(action.url, {
        method: action.method,
        headers: { 'Content-Type': 'application/json', ...action.headers },
        body: action.body,
      });
      if (!res.ok && action.retryCount < 3) {
        action.retryCount++;
        remaining.push(action);
      }
    } catch {
      if (action.retryCount < 3) {
        action.retryCount++;
        remaining.push(action);
      }
    }
  }
  saveQueue(remaining);
}

export function getPendingCount(): number {
  return getQueue().length;
}
