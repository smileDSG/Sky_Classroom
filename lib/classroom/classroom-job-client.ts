/**
 * Shared client helpers for classroom background job submission & polling.
 */

export interface ClassroomJobState {
  status: string;
  step: string;
  progress: number;
  message: string;
  scenesGenerated?: number;
  totalScenes?: number;
  outlines?: import('@/lib/types/generation').SceneOutline[];
  outlinesMeta?: { languageDirective: string; totalScenes: number };
  topicSummary?: string;
  result?: { classroomId: string; url: string; scenesCount: number };
  error?: string;
  done: boolean;
}

export async function submitClassroomJob(body: Record<string, unknown>): Promise<string> {
  const opts: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  };

  let res = await fetch('/api/generate-classroom', opts);

  // If 401, the fetch interceptor is already refreshing the token.
  // Wait briefly then retry once.
  if (res.status === 401) {
    await new Promise((r) => setTimeout(r, 600));
    res = await fetch('/api/generate-classroom', opts);
  }

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || '提交课堂生成作业失败');
  }
  const json = await res.json();
  return json.data?.jobId ?? json.jobId;
}

export async function fetchClassroomJob(jobId: string): Promise<ClassroomJobState | null> {
  const res = await fetch(`/api/generate-classroom/${jobId}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `作业查询失败 (${res.status})`);
  }
  const json = await res.json();
  return (json.data ?? json) as ClassroomJobState;
}

export async function pollClassroomJob(
  jobId: string,
  onUpdate: (data: ClassroomJobState) => void,
  signal: AbortSignal,
): Promise<void> {
  const pollUrl = `/api/generate-classroom/${jobId}`;

  while (!signal.aborted) {
    const res = await fetch(pollUrl, { signal });
    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body.error ?? body.details ?? '';
      } catch {
        /* ignore */
      }
      throw new Error(detail || `作业查询失败 (${res.status})`);
    }

    const json = await res.json();
    const data = (json.data ?? json) as ClassroomJobState;

    onUpdate(data);

    if (data.done) {
      if (data.status === 'failed') {
        throw new Error(json.data?.error ?? json.error ?? '课堂生成失败');
      }
      return;
    }

    if (data.status === 'awaiting_review') return;

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}

export async function cancelClassroomJob(jobId: string): Promise<void> {
  const res = await fetch(`/api/generate-classroom/${jobId}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || '取消生成失败');
  }
}

export async function approveClassroomOutline(
  jobId: string,
  outlines?: import('@/lib/types/generation').SceneOutline[],
): Promise<void> {
  const res = await fetch(`/api/generate-classroom/${jobId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: outlines?.length ? JSON.stringify({ outlines }) : undefined,
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body.error ?? body.details ?? '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `审阅提交失败 (${res.status})`);
  }
}
