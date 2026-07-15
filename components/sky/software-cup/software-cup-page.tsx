'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Code2,
  FileQuestion,
  Film,
  GitBranch,
  Loader2,
  Map,
  Play,
  Presentation,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const DEFAULT_INPUT =
  '我是软件工程大二学生，正在学人工智能导论。Python 基础还可以，线性代数学过但不太熟。现在最困惑的是过拟合、模型评估和 RAG，不太会把概念和代码联系起来。希望两周内补上机器学习基础和大模型智能体，偏好图解、代码案例和分层练习题。每天大概能学 45 分钟，希望系统帮我规划学习顺序并生成资料。';

type StageStatus = 'pending' | 'running' | 'completed' | 'failed';

interface StageItem {
  key: string;
  label: string;
  agent: string;
  status: StageStatus;
}

interface SafetyResult {
  passed: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  categories: string[];
  action: string;
  message: string;
}

interface ProfileDimension<T> {
  value: T;
  confidence: number;
  evidence: string[];
}

interface StudentProfile {
  userId: string;
  lastUpdated: string;
  dimensions: {
    majorBackground: ProfileDimension<string>;
    learningGoal: ProfileDimension<string>;
    knowledgeBase: {
      strongPoints: string[];
      weakPoints: string[];
      confidence: number;
      evidence: string[];
    };
    cognitiveStyle: ProfileDimension<string>;
    errorPatternPreference: ProfileDimension<string[]>;
    resourcePreference: ProfileDimension<string[]>;
    learningPace: ProfileDimension<string>;
    currentLearningState: ProfileDimension<string>;
  };
}

interface CourseHit {
  document: {
    title: string;
    kind: string;
    file: string;
    tags: string[];
  };
  score: number;
  snippet: string;
}

interface AgentTraceItem {
  agent: string;
  status: string;
  output: string;
  progress?: number;
}

interface GeneratedResource {
  id: string;
  type: string;
  title: string;
  personalizationReason?: string;
  sourceCitations: string[];
  contentPreview?: string;
  content?: string;
  slides?: string[];
  questionIds?: string[];
  caseFile?: string;
  scriptFile?: string;
  trust: {
    confidence: number;
    status: string;
  };
}

interface LearningPathNode {
  dayRange: string;
  goal: string;
  resources: string[];
  reason: string;
}

interface GenerationResult {
  jobId: string;
  progress: number;
  studentProfile: StudentProfile;
  safety: SafetyResult;
  courseHits: CourseHit[];
  agentTrace: AgentTraceItem[];
  resources: GeneratedResource[];
  learningPath: LearningPathNode[];
  reviewResult: {
    passed: boolean;
    confidence: number;
    issues: string[];
    suggestions: string[];
  };
}

const INITIAL_STAGES: StageItem[] = [
  { key: 'safety', label: '安全检查', agent: 'SafetyGuard', status: 'pending' },
  { key: 'profile', label: '画像构建', agent: 'ProfileAgent', status: 'pending' },
  { key: 'search', label: '课程检索', agent: 'CourseUnderstandingAgent', status: 'pending' },
  { key: 'generate', label: '资源生成', agent: 'ResourceAgents', status: 'pending' },
  { key: 'review', label: '质量审核', agent: 'QualityReviewAgent', status: 'pending' },
  { key: 'path', label: '路径规划', agent: 'LearningPathAgent', status: 'pending' },
];

const resourceMeta: Record<
  string,
  {
    label: string;
    icon: LucideIcon;
    tone: string;
  }
> = {
  markdown_lecture: { label: '讲义', icon: BookOpen, tone: 'text-sky-700 bg-sky-50 border-sky-200' },
  ppt_outline: {
    label: 'PPT',
    icon: Presentation,
    tone: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  mind_map: { label: '导图', icon: Map, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  quiz_bank: {
    label: '题库',
    icon: FileQuestion,
    tone: 'text-rose-700 bg-rose-50 border-rose-200',
  },
  code_case: { label: '代码', icon: Code2, tone: 'text-violet-700 bg-violet-50 border-violet-200' },
  video_script: { label: '视频', icon: Film, tone: 'text-cyan-700 bg-cyan-50 border-cyan-200' },
};

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchJson<T>(href: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(href, {
    ...init,
    credentials: 'include',
    headers,
  });
  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    data?: T;
    error?: string;
  } | null;

  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || '请求失败');
  }
  return payload.data as T;
}

function Panel({
  icon: Icon,
  title,
  eyebrow,
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/80',
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400">
            {eyebrow}
          </div>
          <h2 className="truncate text-sm font-semibold text-slate-950 dark:text-white">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: StageStatus | string }) {
  const className =
    status === 'completed'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'running'
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : status === 'failed'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-slate-200 bg-slate-50 text-slate-500';

  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px]', className)}>
      {status === 'completed' ? '完成' : status === 'running' ? '生成中' : status === 'failed' ? '失败' : '等待'}
    </span>
  );
}

function ProfilePanel({ profile }: { profile: StudentProfile | null }) {
  if (!profile) {
    return (
      <Panel icon={UserRound} eyebrow="Profile" title="学习画像">
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
          等待自然语言输入。
        </div>
      </Panel>
    );
  }

  const dimensions = [
    ['专业背景', profile.dimensions.majorBackground.value],
    ['学习目标', profile.dimensions.learningGoal.value],
    ['认知风格', profile.dimensions.cognitiveStyle.value],
    ['学习节奏', profile.dimensions.learningPace.value],
    ['强项', profile.dimensions.knowledgeBase.strongPoints.join('、')],
    ['薄弱点', profile.dimensions.knowledgeBase.weakPoints.join('、')],
    ['资源偏好', profile.dimensions.resourcePreference.value.join('、')],
    ['当前状态', profile.dimensions.currentLearningState.value],
  ];

  return (
    <Panel icon={UserRound} eyebrow="Profile" title="8 维学习画像">
      <div className="grid gap-2">
        {dimensions.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
          >
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</div>
            <div className="mt-1 text-sm leading-5 text-slate-900 dark:text-slate-100">{value}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AgentProgressPanel({
  stages,
  traces,
}: {
  stages: StageItem[];
  traces: AgentTraceItem[];
}) {
  const completed = stages.filter((stage) => stage.status === 'completed').length;
  const percent = Math.round((completed / stages.length) * 100);

  return (
    <Panel icon={GitBranch} eyebrow="Agents" title="多智能体协同进度">
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>当前进度</span>
          <span>{percent}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
          <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {stages.map((stage) => (
          <div
            key={stage.key}
            className="rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{stage.label}</span>
              <StatusPill status={stage.status} />
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stage.agent}</div>
          </div>
        ))}
      </div>

      {traces.length > 0 && (
        <div className="mt-3 space-y-2">
          {traces.map((trace) => (
            <div
              key={trace.agent}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{trace.agent}</span>
                <span className="text-[11px] text-slate-500">{trace.progress ?? 100}%</span>
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{trace.output}</div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function CourseHitsPanel({ hits }: { hits: CourseHit[] }) {
  return (
    <Panel icon={Search} eyebrow="RAG" title="课程知识库命中">
      <div className="space-y-2">
        {hits.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            等待检索。
          </div>
        ) : (
          hits.slice(0, 5).map((hit) => (
            <div
              key={hit.document.file}
              className="rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {hit.document.title}
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {hit.document.file}
                  </div>
                </div>
                <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:border-white/10">
                  {hit.score}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                {hit.snippet}
              </p>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function ResourcesPanel({ resources }: { resources: GeneratedResource[] }) {
  return (
    <Panel icon={Sparkles} eyebrow="Resources" title="个性化多模态资源" className="xl:col-span-2">
      <div className="grid gap-3 md:grid-cols-2">
        {resources.map((resource) => {
          const meta = resourceMeta[resource.type] || resourceMeta.markdown_lecture;
          const Icon = meta.icon;
          return (
            <article
              key={resource.id}
              className="flex min-h-[210px] flex-col rounded-lg border border-slate-200 p-3 dark:border-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg border', meta.tone)}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                  {Math.round(resource.trust.confidence * 100)}% 可信
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold leading-5 text-slate-950 dark:text-white">
                {resource.title}
              </h3>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
                {resource.contentPreview || resource.personalizationReason || resource.content}
              </p>
              {resource.slides && (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {resource.slides.length} 页大纲
                </div>
              )}
              {resource.questionIds && (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {resource.questionIds.length} 道精选题
                </div>
              )}
              <div className="mt-auto pt-3">
                <div className="flex flex-wrap gap-1">
                  <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:border-white/10">
                    {meta.label}
                  </span>
                  {resource.sourceCitations.slice(0, 2).map((source) => (
                    <span
                      key={source}
                      className="max-w-[180px] truncate rounded-md border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500 dark:border-white/10"
                    >
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

function LearningPathPanel({ path }: { path: LearningPathNode[] }) {
  return (
    <Panel icon={Route} eyebrow="Path" title="两周学习路径">
      <div className="space-y-3">
        {path.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            等待生成。
          </div>
        ) : (
          path.map((node, index) => (
            <div key={node.dayRange} className="relative rounded-lg border border-slate-200 p-3 dark:border-white/10">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
                  {index + 1}
                </span>
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{node.dayRange}</div>
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">{node.goal}</div>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{node.reason}</p>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function TrustPanel({
  safety,
  review,
}: {
  safety: SafetyResult | null;
  review: GenerationResult['reviewResult'] | null;
}) {
  const ok = safety?.passed && review?.passed;
  return (
    <Panel icon={ShieldCheck} eyebrow="Trust" title="安全与防幻觉审核">
      <div className="grid gap-2">
        <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
          <div className="flex items-center gap-2">
            {safety?.passed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            <span className="text-sm font-semibold text-slate-950 dark:text-white">
              输入安全：{safety ? safety.riskLevel : '等待'}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {safety?.message || '等待内容安全检查。'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 p-3 dark:border-white/10">
          <div className="flex items-center gap-2">
            {ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <ShieldCheck className="h-4 w-4 text-sky-600" />
            )}
            <span className="text-sm font-semibold text-slate-950 dark:text-white">
              学术核验：{review ? `${Math.round(review.confidence * 100)}%` : '等待'}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {(review?.suggestions || ['等待来源引用和置信度检查。']).map((item) => (
              <div key={item} className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function SoftwareCupPage() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [stages, setStages] = useState<StageItem[]>(INITIAL_STAGES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safety, setSafety] = useState<SafetyResult | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [hits, setHits] = useState<CourseHit[]>([]);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const hasAutoRunRef = useRef(false);

  const resources = result?.resources ?? [];
  const learningPath = result?.learningPath ?? [];
  const review = result?.reviewResult ?? null;
  const traces = result?.agentTrace ?? [];

  const updateStage = useCallback((key: string, status: StageStatus) => {
    setStages((items) => items.map((stage) => (stage.key === key ? { ...stage, status } : stage)));
  }, []);

  const runDemo = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setHits([]);
    setStages(INITIAL_STAGES);

    try {
      updateStage('safety', 'running');
      const safetyResult = await fetchJson<SafetyResult>('/api/sky/content-safety/check', {
        method: 'POST',
        body: JSON.stringify({ input }),
      });
      setSafety(safetyResult);
      updateStage('safety', 'completed');
      await wait(120);

      if (!safetyResult.passed && safetyResult.action === 'reject') {
        throw new Error(safetyResult.message);
      }

      updateStage('profile', 'running');
      const profilePayload = await fetchJson<{ profile: StudentProfile }>(
        '/api/sky/student/profile/conversation',
        {
          method: 'POST',
          body: JSON.stringify({ input, userId: 'software-cup-demo-student' }),
        },
      );
      setProfile(profilePayload.profile);
      updateStage('profile', 'completed');
      await wait(120);

      updateStage('search', 'running');
      const searchQuery = profilePayload.profile.dimensions.knowledgeBase.weakPoints.join(' ');
      const searchPayload = await fetchJson<{ results: CourseHit[] }>(
        `/api/sky/course-knowledge/search?q=${encodeURIComponent(searchQuery)}&limit=6`,
      );
      setHits(searchPayload.results);
      updateStage('search', 'completed');
      await wait(120);

      updateStage('generate', 'running');
      const generation = await fetchJson<GenerationResult>('/api/sky/resource-generation/jobs', {
        method: 'POST',
        body: JSON.stringify({ input }),
      });
      setResult(generation);
      setProfile(generation.studentProfile);
      setSafety(generation.safety);
      setHits(generation.courseHits);
      updateStage('generate', 'completed');
      updateStage('review', 'completed');
      updateStage('path', 'completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
      setStages((items) =>
        items.map((stage) => (stage.status === 'running' ? { ...stage, status: 'failed' } : stage)),
      );
    } finally {
      setLoading(false);
    }
  }, [input, updateStage]);

  useEffect(() => {
    if (hasAutoRunRef.current) return;
    hasAutoRunRef.current = true;
    void runDemo();
  }, [runDemo]);

  const completedCount = useMemo(
    () => stages.filter((stage) => stage.status === 'completed').length,
    [stages],
  );

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-7xl space-y-4 pb-24 sm:pb-10">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/80 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                  <BrainCircuit className="h-5 w-5" />
                </span>
                <span className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300">
                  课程资源工坊
                </span>
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {completedCount}/{stages.length} 阶段就绪
                </span>
              </div>
              <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white sm:text-3xl">
                AI 导论课程学习资源生成
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                基于《人工智能导论》课程知识库和学习画像，生成可追溯、可审核的个性化学习方案。
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 justify-center"
                onClick={() => setInput(DEFAULT_INPUT)}
                disabled={loading}
              >
                <Sparkles className="h-4 w-4" />
                示例输入
              </Button>
              <Button type="button" className="min-h-11 justify-center" onClick={runDemo} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                生成学习方案
              </Button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <Panel icon={BrainCircuit} eyebrow="Input" title="自然语言学习需求">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="min-h-[180px] resize-none text-sm leading-6"
              />
            </Panel>
            <ProfilePanel profile={profile} />
          </div>

          <div className="space-y-4">
            <AgentProgressPanel stages={stages} traces={traces} />
            <ResourcesPanel resources={resources} />
          </div>

          <div className="space-y-4">
            <CourseHitsPanel hits={hits} />
            <LearningPathPanel path={learningPath} />
            <TrustPanel safety={safety} review={review} />
          </div>
        </div>
      </div>
    </SkyAppShell>
  );
}
