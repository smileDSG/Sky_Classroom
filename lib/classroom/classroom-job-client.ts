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

export interface ClassroomRuntimeModelConfig {
  modelString?: string;
  apiKey?: string;
  baseUrl?: string;
}

const TRANSIENT_FETCH_ERROR_PATTERN =
  /failed to fetch|fetch failed|networkerror|load failed|network request failed/i;

export function isClassroomPollAbort(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  );
}

export function isTransientClassroomPollError(error: unknown): boolean {
  if (isClassroomPollAbort(error)) return false;
  if (error instanceof TypeError && !error.message) return true;
  return error instanceof Error && TRANSIENT_FETCH_ERROR_PATTERN.test(error.message);
}

function waitForNextPoll(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
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
    // Surface auth errors so callers can redirect to login
    if (res.status === 401) {
      throw new Error(detail || 'User not found');
    }
    throw new Error(detail || '提交课堂生成作业失败');
  }
  const json = await res.json();
  return json.data?.jobId ?? json.jobId;
}

export async function fetchClassroomJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<ClassroomJobState | null> {
  const init: RequestInit = { cache: 'no-store' };
  if (signal) init.signal = signal;

  const res = await fetch(`/api/generate-classroom/${jobId}`, init);
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
  let transientFailureCount = 0;

  while (!signal.aborted) {
    let res: Response;
    try {
      res = await fetch(pollUrl, { cache: 'no-store', signal });
      transientFailureCount = 0;
    } catch (error) {
      if (signal.aborted || isClassroomPollAbort(error)) return;
      if (isTransientClassroomPollError(error)) {
        transientFailureCount += 1;
        await waitForNextPoll(Math.min(8000, 1000 + transientFailureCount * 1000), signal);
        continue;
      }
      throw error;
    }

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

    if (data.done) return;

    if (data.status === 'awaiting_review') return;

    await waitForNextPoll(1500, signal);
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
  modelConfig?: ClassroomRuntimeModelConfig,
): Promise<void> {
  const body = {
    ...(outlines?.length ? { outlines } : {}),
    ...(modelConfig?.modelString ? { modelString: modelConfig.modelString } : {}),
    ...(modelConfig?.apiKey ? { apiKey: modelConfig.apiKey } : {}),
    ...(modelConfig?.baseUrl ? { baseUrl: modelConfig.baseUrl } : {}),
  };
  const res = await fetch(`/api/generate-classroom/${jobId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
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
