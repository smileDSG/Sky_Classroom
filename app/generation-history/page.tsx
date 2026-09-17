'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { cancelClassroomJob } from '@/lib/classroom/classroom-job-client';

interface JobListItem {
  jobId: string;
  status: 'initializing' | 'running' | 'awaiting_review' | 'cancelled' | 'failed' | 'succeeded';
  step: string;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  topic: string;
  hasPdf: boolean;
  scenesGenerated: number;
  totalScenes?: number;
  result?: { classroomId: string; url: string; scenesCount: number };
  error?: string;
}

const ACTIVE_STATUSES: JobListItem['status'][] = ['initializing', 'running', 'awaiting_review'];

interface ResourceJobListItem {
  jobId: string;
  status: 'initializing' | 'running' | 'succeeded' | 'failed';
  step: string;
  progress: number;
  message: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  topic: string;
  resourceCount: number;
  error?: string;
}

const RESOURCE_ACTIVE_STATUSES: ResourceJobListItem['status'][] = ['initializing', 'running'];

const RESOURCE_STATUS_LABEL: Record<ResourceJobListItem['status'], string> = {
  initializing: '初始化中',
  running: '生成中',
  succeeded: '已完成',
  failed: '生成失败',
};

const RESOURCE_STATUS_CLASS: Record<ResourceJobListItem['status'], string> = {
  initializing: 'bg-sky-50 text-sky-700 ring-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  running: 'bg-sky-50 text-sky-700 ring-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  succeeded:
    'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  failed: 'bg-red-50 text-red-700 ring-red-500/20 dark:bg-red-500/10 dark:text-red-300',
};

const STATUS_LABEL: Record<JobListItem['status'], string> = {
  initializing: '初始化中',
  running: '生成中',
  awaiting_review: '待审阅大纲',
  cancelled: '已取消',
  failed: '生成失败',
  succeeded: '已完成',
};

const STATUS_CLASS: Record<JobListItem['status'], string> = {
  initializing: 'bg-sky-50 text-sky-700 ring-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  running: 'bg-sky-50 text-sky-700 ring-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  awaiting_review:
    'bg-amber-50 text-amber-700 ring-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-400/20 dark:bg-slate-500/10 dark:text-slate-300',
  failed: 'bg-red-50 text-red-700 ring-red-500/20 dark:bg-red-500/10 dark:text-red-300',
  succeeded:
    'bg-emerald-50 text-emerald-700 ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
};

function fmtTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function JobCard({ job, onCanceled }: { job: JobListItem; onCanceled: () => void }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);

  const isActive = ACTIVE_STATUSES.includes(job.status);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelClassroomJob(job.jobId);
      onCanceled();
    } catch {
      // keep the row; user can retry
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                STATUS_CLASS[job.status],
              )}
            >
              {job.status === 'running' ||
              job.status === 'initializing' ||
              job.status === 'awaiting_review' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : job.status === 'succeeded' ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {STATUS_LABEL[job.status]}
            </span>
            {job.hasPdf && (
              <span className="text-xs text-slate-400 dark:text-slate-500">含 PDF</span>
            )}
          </div>

          <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">
            {job.topic || '未命名课堂'}
          </p>

          {job.status === 'running' && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-sky-600 transition-all"
                  style={{ width: `${Math.max(3, job.progress)}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {job.scenesGenerated > 0 && job.totalScenes
                  ? `${job.scenesGenerated}/${job.totalScenes}`
                  : `${job.progress}%`}
              </span>
            </div>
          )}

          {job.status === 'running' && job.message && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{job.message}</p>
          )}

          {job.status === 'failed' && job.error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{job.error}</p>
          )}

          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {fmtTime(job.createdAt)}
            {job.status === 'succeeded' && job.completedAt
              ? ` · ${fmtTime(job.completedAt)} 完成`
              : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          {isActive && (
            <Button
              size="sm"
              onClick={() =>
                router.push(`/generation-progress?jobId=${encodeURIComponent(job.jobId)}`)
              }
            >
              {job.status === 'awaiting_review' ? (
                <>
                  <Pencil className="h-4 w-4" />
                  去审阅
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  查看进度
                </>
              )}
            </Button>
          )}
          {job.status === 'succeeded' && job.result?.classroomId && (
            <Button size="sm" onClick={() => router.push(`/classroom/${job.result!.classroomId}`)}>
              <CheckCircle2 className="h-4 w-4" />
              进入课堂（{job.scenesGenerated || job.result.scenesCount} 场景）
            </Button>
          )}
          {isActive && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={cancelling}
              className="text-red-600 dark:text-red-400"
            >
              <XCircle className="h-4 w-4" />
              取消
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResourceJobCard({ job }: { job: ResourceJobListItem }) {
  const router = useRouter();

  const isActive = RESOURCE_ACTIVE_STATUSES.includes(job.status);

  const open = () =>
    router.push(`/sky/cloud-mind/course-studio?resourceJobId=${encodeURIComponent(job.jobId)}`);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                RESOURCE_STATUS_CLASS[job.status],
              )}
            >
              {isActive ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : job.status === 'succeeded' ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              {RESOURCE_STATUS_LABEL[job.status]}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">课程资源工坊</span>
          </div>

          <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-900 dark:text-white">
            {job.topic || '个性化学习资料'}
          </p>

          {isActive && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-cyan-600 transition-all"
                  style={{ width: `${Math.max(3, job.progress)}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {job.progress}%
              </span>
            </div>
          )}

          {isActive && job.message && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{job.message}</p>
          )}

          {job.status === 'failed' && job.error && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{job.error}</p>
          )}

          {job.status === 'succeeded' && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              已生成 {job.resourceCount} 份学习资料
            </p>
          )}

          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            {fmtTime(job.createdAt)}
            {job.status === 'succeeded' && job.completedAt
              ? ` · ${fmtTime(job.completedAt)} 完成`
              : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Button size="sm" variant="outline" onClick={open}>
            {isActive ? (
              <>
                <RefreshCw className="h-4 w-4" />
                查看进度
              </>
            ) : job.status === 'succeeded' ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                查看资料
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" />
                查看
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function GenerationHistoryPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListItem[] | null>(null);
  const [resourceJobs, setResourceJobs] = useState<ResourceJobListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchSeqRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    try {
      const res = await fetch('/api/generate-classroom/jobs', { cache: 'no-store' });
      if (!res.ok) {
        let detail = '';
        try {
          const body = await res.json();
          detail = body.error ?? body.details ?? '';
        } catch {
          /* ignore */
        }
        throw new Error(detail || `加载失败 (${res.status})`);
      }
      const json = await res.json();
      const list = (json.data ?? json) as { jobs: JobListItem[] };
      if (seq !== fetchSeqRef.current) return;
      setJobs(list.jobs ?? []);
      setError(null);
    } catch (err) {
      if (seq !== fetchSeqRef.current) return;
      setError(err instanceof Error ? err.message : '加载生成记录失败');
    }

    // Course-studio resource jobs (best effort).
    try {
      const res = await fetch('/api/sky/resource-generation/jobs', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        const list = (json.data ?? json) as { jobs: ResourceJobListItem[] };
        if (seq === fetchSeqRef.current) setResourceJobs(list.jobs ?? []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      fetchSeqRef.current += 1;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  // Poll while any job is still active so a running job's progress stays live
  // even after reopening this page (or returning from a closed tab).
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const hasActive =
      jobs?.some((j) => ACTIVE_STATUSES.includes(j.status)) ||
      resourceJobs?.some((j) => RESOURCE_ACTIVE_STATUSES.includes(j.status));
    if (hasActive) {
      timerRef.current = setInterval(load, 4000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [jobs, resourceJobs, load]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            返回首页
          </button>
        </div>

        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-500/10">
            <History className="h-5 w-5 text-sky-600 dark:text-sky-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">我的生成记录</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              课堂与学习资料都在服务器后台继续生成，关掉页面或稍后回来都能继续查看。
            </p>
          </div>
          {(jobs?.some((j) => ACTIVE_STATUSES.includes(j.status)) ||
            resourceJobs?.some((j) => RESOURCE_ACTIVE_STATUSES.includes(j.status))) && (
            <Loader2 className="ml-auto h-5 w-5 animate-spin text-sky-500" />
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {jobs === null ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-sm">加载中...</span>
          </div>
        ) : jobs.length === 0 && resourceJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-20 text-center dark:border-slate-700">
            <FileText className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">暂无生成记录</p>
            <Button className="mt-4" onClick={() => router.push('/')}>
              去生成课堂
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {jobs.length > 0 && (
              <div>
                {resourceJobs.length > 0 && (
                  <h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    互动课堂
                  </h2>
                )}
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <JobCard key={job.jobId} job={job} onCanceled={load} />
                  ))}
                </div>
              </div>
            )}
            {resourceJobs.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
                  学习包工坊
                </h2>
                <div className="space-y-3">
                  {resourceJobs.map((job) => (
                    <ResourceJobCard key={job.jobId} job={job} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
