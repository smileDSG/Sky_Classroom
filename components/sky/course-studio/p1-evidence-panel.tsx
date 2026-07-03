'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Edit3,
  Loader2,
  MousePointerClick,
  ShieldCheck,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type InteractionAction = 'favorite' | 'skip' | 'complete';

interface ResourceQualityCheck {
  resourceId: string;
  citationCoverage: string;
  difficultyFit: string;
  personalizationFit: string;
  confidence: number;
  issues: string[];
  suggestions: string[];
}

interface GeneratedResource {
  id: string;
  type: string;
  title: string;
}

interface LearningEffectReport {
  accuracy: number;
  masteryDelta: Array<{
    knowledgePoint: string;
    delta: number;
  }>;
  resourceEffectiveness: Array<{
    resourceId: string;
    status: string;
    effectScore: number;
  }>;
  nextResourceStrategy: string[];
}

interface P1GenerationResult {
  resources: GeneratedResource[];
  reviewResult?: {
    resourceChecks?: ResourceQualityCheck[];
  };
}

async function postJson<T>(href: string, body: unknown): Promise<T> {
  const response = await fetch(href, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: T;
    error?: string;
  } | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || 'request failed');
  }
  return payload.data as T;
}

function statusTone(status: string): string {
  if (status === 'pass' || status === 'effective') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100';
  }
  if (status === 'fail' || status === 'mismatch') {
    return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-100';
  }
  return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100';
}

export function CourseStudioP1EvidencePanel({
  result,
  userId,
}: {
  result: P1GenerationResult;
  userId: string;
}) {
  const [report, setReport] = useState<LearningEffectReport | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const resourceChecks = result.reviewResult?.resourceChecks ?? [];
  const firstResource = result.resources[0];

  const sampleUsage = useMemo(
    () =>
      result.resources.slice(0, 2).map((resource, index) => ({
        resourceId: resource.id,
        resourceType: resource.type,
        action: index === 0 ? 'complete' : 'skip',
        completionRate: index === 0 ? 0.92 : 0.2,
        durationSeconds: index === 0 ? 360 : 20,
      })),
    [result.resources],
  );

  const runReport = async () => {
    setBusyKey('report');
    setMessage(null);
    try {
      const data = await postJson<{ report: LearningEffectReport }>(
        '/api/sky/learning-effect/evaluate',
        {
          userId,
          input: 'P1 learning effect report',
          results: [
            {
              questionId: 'p1-q1',
              knowledgePoint: 'vector retrieval',
              correct: false,
              errorTag: 'concept boundary',
            },
            {
              questionId: 'p1-q2',
              knowledgePoint: 'RAG workflow',
              correct: true,
            },
          ],
          resourceUsage: sampleUsage,
        },
      );
      setReport(data.report);
      setMessage('Learning effect report saved to profile signals.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'report failed');
    } finally {
      setBusyKey(null);
    }
  };

  const submitCorrection = async () => {
    setBusyKey('correction');
    setMessage(null);
    try {
      await postJson('/api/sky/student/profile/corrections', {
        userId,
        dimension: 'resourcePreference',
        value: ['code cases', 'diagrams'],
        evidence: 'student corrected the profile in P1 panel',
      });
      setMessage(
        'Profile correction saved. New recommendations will use the corrected preference.',
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'correction failed');
    } finally {
      setBusyKey(null);
    }
  };

  const submitInteraction = async (action: InteractionAction) => {
    if (!firstResource) return;
    setBusyKey(action);
    setMessage(null);
    try {
      await postJson('/api/sky/resource-generation/interactions', {
        userId,
        resourceId: firstResource.id,
        resourceType: firstResource.type,
        action,
        completionRate: action === 'skip' ? 0.18 : 1,
        durationSeconds: action === 'skip' ? 12 : 300,
      });
      setMessage(`Resource behavior saved: ${action}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'interaction failed');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-cyan-600 dark:text-cyan-100" />
          <h2 className="text-sm font-semibold text-slate-950 dark:text-white">P1 Evidence</h2>
        </div>
        {message && (
          <Badge variant="outline" className="min-h-7 rounded-full px-3">
            {message}
          </Badge>
        )}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/40 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4" />
            QA Agent
          </div>
          <div className="space-y-2">
            {resourceChecks.slice(0, 3).map((check) => (
              <div key={check.resourceId} className="rounded-lg bg-white p-2 dark:bg-slate-950/70">
                <div className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {check.resourceId}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[check.citationCoverage, check.difficultyFit, check.personalizationFit].map(
                    (status, index) => (
                      <span
                        key={`${check.resourceId}-${index}`}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px]',
                          statusTone(status),
                        )}
                      >
                        {status}
                      </span>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/40 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Activity className="h-4 w-4" />
              Effect Report
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={runReport}
              disabled={!!busyKey}
            >
              {busyKey === 'report' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Run
            </Button>
          </div>
          {report ? (
            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div>Accuracy: {report.accuracy}%</div>
              {report.masteryDelta.map((item) => (
                <div key={item.knowledgePoint}>
                  {item.knowledgePoint}: {item.delta > 0 ? '+' : ''}
                  {item.delta}
                </div>
              ))}
              {report.resourceEffectiveness.slice(0, 2).map((item) => (
                <div key={item.resourceId}>
                  {item.resourceId}: {item.status} ({item.effectScore})
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">No report yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/40 dark:bg-slate-900/60">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Edit3 className="h-4 w-4" />
            Profile Feedback
          </div>
          <div className="grid gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={submitCorrection}
              disabled={!!busyKey}
            >
              {busyKey === 'correction' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Edit3 className="h-4 w-4" />
              )}
              Correct preference
            </Button>
            <div className="grid grid-cols-3 gap-1.5">
              {(['favorite', 'complete', 'skip'] as const).map((action) => (
                <Button
                  key={action}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="px-2"
                  onClick={() => submitInteraction(action)}
                  disabled={!!busyKey || !firstResource}
                >
                  {busyKey === action ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MousePointerClick className="h-4 w-4" />
                  )}
                  {action}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
