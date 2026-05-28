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
  const res = await fetch('/api/generate-classroom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('提交课堂生成作业失败');
  const json = await res.json();
  return json.data?.jobId ?? json.jobId;
}

export async function fetchClassroomJob(jobId: string): Promise<ClassroomJobState> {
  const res = await fetch(`/api/generate-classroom/${jobId}`);
  if (!res.ok) throw new Error(`作业查询失败 (${res.status})`);
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
    if (!res.ok) throw new Error(`作业查询失败 (${res.status})`);

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
  if (!res.ok) throw new Error('取消生成失败');
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
  if (!res.ok) throw new Error('审阅提交失败');
}
