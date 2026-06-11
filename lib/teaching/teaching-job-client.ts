/**
 * Client-side helpers for teaching background job submission & polling.
 */

import type { LessonPlan, LessonSection } from './lesson-types';
import type { ContentChunk } from './content-types';

// ── Types ─────────────────────────────────────────────────────────

export interface TeachingJobState {
  id: string;
  topic: string;
  status: string;
  step: string;
  progress: number;
  message: string;
  plan?: LessonPlan;
  sections?: { section: LessonSection; chunks: ContentChunk[] }[];
  sectionsCompleted: number;
  totalSections: number;
  error?: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TeachingHistoryItem {
  id: string;
  topic: string;
  status: string;
  progress: number;
  plan?: LessonPlan;
  sections?: { section: LessonSection; chunks: ContentChunk[] }[];
  sectionsCompleted: number;
  totalSections: number;
  createdAt: string;
  completedAt?: string;
}

// ── Submit ────────────────────────────────────────────────────────

export async function submitTeachingJob(topic: string): Promise<string> {
  const opts: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
    credentials: 'include',
  };

  let res = await fetch('/api/sky/teaching/generate-stream', opts);

  // If 401, retry once after brief delay (token refresh may be in progress)
  if (res.status === 401) {
    await new Promise((r) => setTimeout(r, 600));
    res = await fetch('/api/sky/teaching/generate-stream', opts);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      throw new Error(detail || 'User not found');
    }
    throw new Error(detail || '提交教案任务失败');
  }

  const json = await res.json();
  return json.data?.jobId ?? json.jobId;
}

// ── Poll ──────────────────────────────────────────────────────────

export async function fetchTeachingJob(jobId: string): Promise<TeachingJobState | null> {
  const res = await fetch(`/api/sky/teaching/${jobId}`, { credentials: 'include' });
  if (!res.ok) {
    if (res.status === 404) return null;
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `任务查询失败 (${res.status})`);
  }
  const json = await res.json();
  return (json.data ?? json) as TeachingJobState;
}

export async function pollTeachingJob(
  jobId: string,
  onUpdate: (data: TeachingJobState) => void,
  signal: AbortSignal,
): Promise<TeachingJobState> {
  const startTime = Date.now();
  let lastSectionsCompleted = 0;

  while (!signal.aborted) {
    const data = await fetchTeachingJob(jobId);
    if (!data) throw new Error('任务不存在');

    onUpdate(data);

    if (data.done) {
      if (data.status === 'failed') {
        throw new Error(data.error ?? '教案生成失败');
      }
      return data;
    }

    // Dynamic interval based on elapsed time and updates
    const elapsed = (Date.now() - startTime) / 1000;
    const hasUpdate = (data.sectionsCompleted ?? 0) > lastSectionsCompleted;
    lastSectionsCompleted = data.sectionsCompleted ?? 0;

    let interval: number;
    if (hasUpdate) {
      // Reset to fast interval on update
      interval = 1000;
    } else if (elapsed < 10) {
      // First 10s: 1s interval
      interval = 1000;
    } else if (elapsed < 30) {
      // 10s-30s: 2s interval
      interval = 2000;
    } else {
      // 30s+: 3s interval
      interval = 3000;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Aborted');
}

// ── Cancel ────────────────────────────────────────────────────────

export async function cancelTeachingJob(jobId: string): Promise<void> {
  const res = await fetch(`/api/sky/teaching/${jobId}/cancel`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || '取消任务失败');
  }
}

// ── SSE Stream ───────────────────────────────────────────────────

export interface TeachingStreamEvent {
  type: 'connected' | 'section_done' | 'job_done' | 'error';
  jobId?: string;
  sectionIndex?: number;
  section?: LessonSection;
  chunks?: ContentChunk[];
}

/**
 * Stream teaching job progress via SSE.
 * Falls back to polling if SSE fails.
 */
export async function streamTeachingJob(
  jobId: string,
  onUpdate: (data: TeachingJobState) => void,
  onSectionDone?: (sectionIndex: number, section: LessonSection, chunks: ContentChunk[]) => void,
  signal?: AbortSignal,
): Promise<TeachingJobState> {
  // Try SSE first
  try {
    return await streamViaSSE(jobId, onUpdate, onSectionDone, signal);
  } catch (err) {
    log.warn('SSE failed, falling back to polling:', err);
    // Fall back to polling
    return await pollTeachingJob(jobId, onUpdate, signal!);
  }
}

function streamViaSSE(
  jobId: string,
  onUpdate: (data: TeachingJobState) => void,
  onSectionDone?: (sectionIndex: number, section: LessonSection, chunks: ContentChunk[]) => void,
  signal?: AbortSignal,
): Promise<TeachingJobState> {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`/api/sky/teaching/${jobId}/stream`);
    let resolved = false;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as TeachingStreamEvent;

        if (data.type === 'connected') {
          log.info('SSE connected for job', jobId);
          return;
        }

        if (data.type === 'section_done' && data.section && data.chunks) {
          onSectionDone?.(data.sectionIndex!, data.section, data.chunks);
          return;
        }

        if (data.type === 'job_done') {
          // Fetch final job state
          fetchTeachingJob(jobId).then((job) => {
            if (job) {
              eventSource.close();
              resolved = true;
              resolve(job);
            }
          });
          return;
        }
      } catch (err) {
        log.error('Failed to parse SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      log.error('SSE error:', err);
      eventSource.close();
      if (!resolved) {
        reject(new Error('SSE connection failed'));
      }
    };

    // Handle abort
    signal?.addEventListener('abort', () => {
      eventSource.close();
      if (!resolved) {
        reject(new Error('Aborted'));
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!resolved) {
        eventSource.close();
        reject(new Error('SSE timeout'));
      }
    }, 5 * 60 * 1000);
  });
}

const log = {
  info: (...args: unknown[]) => console.log('[TeachingClient]', ...args),
  warn: (...args: unknown[]) => console.warn('[TeachingClient]', ...args),
  error: (...args: unknown[]) => console.error('[TeachingClient]', ...args),
};

// ── History ───────────────────────────────────────────────────────

export async function fetchTeachingHistory(limit = 50): Promise<TeachingHistoryItem[]> {
  const res = await fetch(`/api/sky/teaching/history?limit=${limit}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || '获取历史记录失败');
  }
  const json = await res.json();
  return (json.data?.history ?? json.history ?? []) as TeachingHistoryItem[];
}

export async function deleteTeachingHistory(id: string): Promise<void> {
  const res = await fetch(`/api/sky/teaching/history?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || '删除失败');
  }
}

// ── Retry Section ────────────────────────────────────────────────

export async function retrySection(
  jobId: string,
  sectionId: string,
): Promise<{ section: LessonSection; chunks: ContentChunk[] } | null> {
  const res = await fetch(`/api/sky/teaching/${jobId}/retry-section`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sectionId }),
    credentials: 'include',
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || '重新生成失败');
  }

  const json = await res.json();
  return json.data ?? null;
}

// ── Chat (Multi-turn Teaching) ────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function sendTeachingChat(
  jobId: string,
  message: string,
  sectionId?: string,
  history: ChatMessage[] = [],
): Promise<string> {
  const res = await fetch(`/api/sky/teaching/${jobId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sectionId, history }),
    credentials: 'include',
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || '对话失败');
  }

  const json = await res.json();
  return json.data?.reply ?? '';
}

// ── Favorite ──────────────────────────────────────────────────────

export async function toggleTeachingFavorite(
  jobId: string,
): Promise<boolean> {
  const res = await fetch(`/api/sky/teaching/${jobId}/favorite`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || '收藏失败');
  }

  const json = await res.json();
  return json.data?.isFavorited ?? false;
}

// ── Share ─────────────────────────────────────────────────────────

export interface ShareInfo {
  token: string;
  shareUrl: string;
  expiresAt: string;
}

export async function shareTeachingJob(
  jobId: string,
): Promise<ShareInfo> {
  const res = await fetch(`/api/sky/teaching/${jobId}/share`, {
    method: 'POST',
    credentials: 'include',
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || '分享失败');
  }

  const json = await res.json();
  return json.data;
}

export async function getShareInfo(
  jobId: string,
): Promise<{ isShared: boolean; token?: string; shareUrl?: string }> {
  const res = await fetch(`/api/sky/teaching/${jobId}/share`, {
    credentials: 'include',
  });

  if (!res.ok) {
    return { isShared: false };
  }

  const json = await res.json();
  return json.data;
}
