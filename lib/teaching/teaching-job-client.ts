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

    await new Promise((resolve) => setTimeout(resolve, 1500));
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
