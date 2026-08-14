'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  Code2,
  Download,
  Eye,
  FileQuestion,
  Film,
  Info,
  Layers,
  Loader2,
  Map,
  Play,
  Presentation,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';

import { SkyAppShell } from '@/components/sky/layout/app-shell';
import { CourseStudioP1EvidencePanel } from '@/components/sky/course-studio/p1-evidence-panel';
import { CourseStudioP2LongTermPanel } from '@/components/sky/course-studio/p2-long-term-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { submitClassroomJob } from '@/lib/classroom/classroom-job-client';
import { addActiveJobEntry } from '@/lib/classroom/classroom-session';
import type { PersonalizationContext } from '@/lib/cloud-mind/types';
import { cn } from '@/lib/utils';

type StageStatus = 'pending' | 'running' | 'completed' | 'failed';

interface StageItem {
  key: string;
  label: string;
  agent: string;
  status: StageStatus;
  progress: number;
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
  personalizationReason?: string;
  sourceCitations: string[];
  contentPreview?: string;
  format?: string;
  content?: string;
  downloadFileName?: string;
  slides?: string[];
  questionIds?: string[];
  caseFile?: string;
  scriptFile?: string;
  trust: {
    confidence: number;
    status: string;
  };
  qualityReview?: ResourceQualityCheck;
}

interface LearningPathNode {
  dayRange: string;
  goal: string;
  resources: string[];
  reason: string;
}

interface P2Enhancements {
  videoHandoff: {
    status: 'ready_for_generation';
    providerHint: string;
    scenes: Array<{
      sceneId: string;
      title: string;
      durationSeconds: number;
    }>;
  };
  weeklyPlan: Array<{
    weekIndex: number;
    theme: string;
    goals: string[];
    reviewItems: string[];
    estimatedMinutes: number;
  }>;
  spacedReviews: Array<{
    knowledgePoint: string;
    dueInDays: number;
    priority: string;
  }>;
  masteryEstimates: Array<{
    knowledgePoint: string;
    mastery: number;
    stability: number;
    nextReviewInDays: number;
  }>;
  classGroupProfile: {
    learnerCount: number;
    weakPointTrends: Array<{
      knowledgePoint: string;
      affectedLearners: number;
      averageMastery: number;
    }>;
    tierRecommendations: Array<{
      tier: string;
      learnerCount: number;
      focus: string;
    }>;
    teacherActions: string[];
  };
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
  p2Enhancements: P2Enhancements;
  reviewResult: {
    passed: boolean;
    confidence: number;
    issues: string[];
    suggestions: string[];
    resourceChecks?: ResourceQualityCheck[];
  };
}

interface ResourceTypeOption {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

type DetailTabId = 'fit' | 'process' | 'trust' | 'follow';

const RESOURCE_TYPES: ResourceTypeOption[] = [
  { id: 'markdown_lecture', label: '讲义', hint: '结构化解释', icon: BookOpen },
  { id: 'ppt_outline', label: 'PPT', hint: '课件大纲', icon: Presentation },
  { id: 'mind_map', label: '导图', hint: '知识结构', icon: Map },
  { id: 'quiz_bank', label: '题库', hint: '分层练习', icon: FileQuestion },
  { id: 'code_case', label: '实操', hint: '代码案例', icon: Code2 },
  { id: 'video_script', label: '视频', hint: '讲解脚本', icon: Film },
];

const INITIAL_STAGES: StageItem[] = [
  { key: 'safety', label: '安全检查', agent: 'SafetyGuard', status: 'pending', progress: 8 },
  { key: 'profile', label: '了解学习情况', agent: 'ProfileAgent', status: 'pending', progress: 22 },
  { key: 'search', label: '查找课程资料', agent: 'CourseAgent', status: 'pending', progress: 38 },
  { key: 'generate', label: '资源生成', agent: 'ResourceAgents', status: 'pending', progress: 68 },
  { key: 'review', label: '检查内容', agent: 'TrustReviewAgent', status: 'pending', progress: 86 },
  {
    key: 'path',
    label: '安排学习顺序',
    agent: 'LearningPathAgent',
    status: 'pending',
    progress: 100,
  },
];

const COURSE_STUDIO_USER_ID = 'course-studio-student';

const DETAIL_TABS: Array<{ id: DetailTabId; title: string; icon: LucideIcon }> = [
  { id: 'fit', title: '为什么适合你', icon: UserRound },
  { id: 'process', title: '生成流程', icon: Search },
  { id: 'trust', title: '内容检查', icon: ShieldCheck },
  { id: 'follow', title: '后续学习', icon: Route },
];

const RESOURCE_META: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  markdown_lecture: {
    label: '讲义',
    icon: BookOpen,
    className:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-300/20 dark:bg-sky-300/10 dark:text-sky-100',
  },
  ppt_outline: {
    label: 'PPT',
    icon: Presentation,
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100',
  },
  mind_map: {
    label: '导图',
    icon: Map,
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100',
  },
  quiz_bank: {
    label: '题库',
    icon: FileQuestion,
    className:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-100',
  },
  code_case: {
    label: '实操',
    icon: Code2,
    className:
      'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-300/20 dark:bg-violet-300/10 dark:text-violet-100',
  },
  video_script: {
    label: '视频',
    icon: Film,
    className:
      'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100',
  },
};

function statusText(status: StageStatus): string {
  if (status === 'completed') return '完成';
  if (status === 'running') return '生成中';
  if (status === 'failed') return '失败';
  return '等待';
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

function splitList(value: string): string[] {
  return value
    .split(/[、,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueNonEmpty(values: Array<string | undefined | null>): string[] {
  return Array.from(
    new Set(values.map((item) => item?.trim()).filter((item): item is string => Boolean(item))),
  );
}

function formatDifficulty(difficulty: PersonalizationContext['preferredDifficulty']): string {
  if (difficulty === 'easy') return '基础巩固';
  if (difficulty === 'hard') return '拓展强化';
  return '稳步提升';
}

function hasSystemProfile(context: PersonalizationContext | null): boolean {
  if (!context) return false;
  return Boolean(
    context.hasLearningData ||
    context.hasPersonalizationSignals ||
    context.weakPoints.length > 0 ||
    context.learningPath ||
    context.recommendation,
  );
}

function derivePersonalizationDraft(context: PersonalizationContext) {
  const conversationProfile = context.conversationProfile;
  const weakPointNames = uniqueNonEmpty([
    ...(conversationProfile?.knowledgeBase?.weakPoints ?? []),
    ...context.weakPoints.map((item) => item.knowledgePoint),
    ...context.errorPatterns.map((item) => item.knowledgePoint),
  ]).slice(0, 8);

  const historyParts = [
    context.recentAccuracy === null
      ? null
      : `近期练习正确率约 ${Math.round(context.recentAccuracy * 100)}%`,
    context.dueReviews.length > 0 ? `${context.dueReviews.length} 条内容已到复习时间` : null,
    context.errorPatterns[0]
      ? `常见错误：${context.errorPatterns[0].knowledgePoint} / ${context.errorPatterns[0].errorType}`
      : null,
    context.learningPath?.reason ? `学习路径：${context.learningPath.reason}` : null,
  ];

  return {
    major: conversationProfile?.majorBackground?.value ?? '',
    goal:
      conversationProfile?.learningGoal?.value ??
      context.recommendation?.title ??
      '根据你现在的学习情况生成一套学习资料',
    weakPoints: weakPointNames.join('、'),
    history:
      uniqueNonEmpty(historyParts).join('；') ||
      (context.hasLearningData
        ? '已有学习记录，系统会结合之前的表现生成资料'
        : '学习记录还不多，系统会先按当前课程和你的需求生成第一版安排'),
    courseFocus:
      context.learningPath?.next ?? context.learningPath?.current ?? weakPointNames[0] ?? '',
    studyTime: conversationProfile?.learningPace?.value ?? '每天 45 分钟',
    preferenceText:
      conversationProfile?.resourcePreference?.value.join('、') ??
      `讲义、例题、PPT；难度：${formatDifficulty(context.preferredDifficulty)}`,
  };
}

function recommendationEvidence(context: PersonalizationContext | null): string[] {
  if (!context) return ['还没有读取到你的学习情况，可先补充课程或章节生成资料。'];

  const items = [
    context.hasPersonalizationSignals ? '参考了你最近对话中提到的学习情况。' : null,
    context.weakPoints.length > 0
      ? `参考了 ${context.weakPoints.length} 个需要加强的知识点和学习记录。`
      : null,
    context.recentAccuracy === null
      ? null
      : `来自近期练习正确率：${Math.round(context.recentAccuracy * 100)}%。`,
    context.dueReviews.length > 0 ? `来自 ${context.dueReviews.length} 条到期复习内容。` : null,
    context.learningPath?.next ? `来自学习路径下一站：${context.learningPath.next}。` : null,
  ];

  const evidence = uniqueNonEmpty(items).slice(0, 4);
  return evidence.length > 0
    ? evidence
    : ['系统暂未积累足够学习数据，补充一个课程重点即可生成初始资料。'];
}

function buildStudentInput(params: {
  major: string;
  goal: string;
  weakPoints: string;
  history: string;
  supplement: string;
  preferenceText: string;
  selectedTypes: string[];
  studyTime: string;
  courseFocus: string;
}) {
  const selectedLabels = RESOURCE_TYPES.filter((item) =>
    params.selectedTypes.includes(item.id),
  ).map((item) => item.label);
  return [
    `我的专业背景：${params.major || '未填写'}`,
    `当前课程：《人工智能导论》${params.courseFocus ? `，重点章节：${params.courseFocus}` : ''}`,
    `学习目标：${params.goal || '希望系统帮我规划学习目标'}`,
    `需要加强的内容：${params.weakPoints || '请结合我的学习情况判断'}`,
    `学习历史：${params.history || '暂无明确记录'}`,
    params.supplement ? `补充需求：${params.supplement}` : '',
    `资源偏好：${params.preferenceText || '未指定'}；希望生成：${selectedLabels.join('、')}`,
    `学习节奏：${params.studyTime || '每天 45 分钟'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function resourceSummary(resource: GeneratedResource): string {
  if (resource.contentPreview) return resource.contentPreview;
  if (resource.slides?.length) return resource.slides.slice(0, 3).join(' / ');
  if (resource.questionIds?.length) return `包含 ${resource.questionIds.length} 道课程题库练习`;
  if (resource.caseFile) return `实操案例：${resource.caseFile}`;
  if (resource.scriptFile) return `视频脚本：${resource.scriptFile}`;
  return '已生成资源内容摘要';
}

export function CourseStudioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTopic = searchParams.get('topic');
  const queryGoal = searchParams.get('goal');
  const queryTypes = searchParams.get('types');
  const [major, setMajor] = useState('');
  const [goal, setGoal] = useState('');
  const [weakPoints, setWeakPoints] = useState('');
  const [history, setHistory] = useState('');
  const [supplement, setSupplement] = useState('');
  const [courseFocus, setCourseFocus] = useState('');
  const [studyTime, setStudyTime] = useState('每天 45 分钟');
  const [preferenceText, setPreferenceText] = useState('图解、代码案例、分层练习');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(
    RESOURCE_TYPES.map((item) => item.id),
  );
  const [personalization, setPersonalization] = useState<PersonalizationContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [stages, setStages] = useState<StageItem[]>(INITIAL_STAGES);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [hits, setHits] = useState<CourseHit[]>([]);
  const [safety, setSafety] = useState<SafetyResult | null>(null);
  const [activeType, setActiveType] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profilePanelOpen, setProfilePanelOpen] = useState(false);
  const [flowPanelOpen, setFlowPanelOpen] = useState(false);
  const [activeDetail, setActiveDetail] = useState<DetailTabId>('fit');
  const [nextAction, setNextAction] = useState<'idle' | 'classroom' | 'plan'>('idle');
  const [nextActionError, setNextActionError] = useState<string | null>(null);

  useEffect(() => {
    if (queryTopic) setCourseFocus(queryTopic);
    if (queryGoal) setSupplement(queryGoal);
    if (queryTypes) {
      const requestedTypes = queryTypes
        .split(',')
        .filter((type) => RESOURCE_TYPES.some((item) => item.id === type));
      if (requestedTypes.length > 0) setSelectedTypes(requestedTypes);
    }
  }, [queryGoal, queryTopic, queryTypes]);

  const applyPersonalizationDraft = useCallback(
    (context: PersonalizationContext, mode: 'fill-empty' | 'replace' = 'replace') => {
      const draft = derivePersonalizationDraft(context);
      const applyText = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
        if (!value) return;
        setter((current) => (mode === 'replace' || !current.trim() ? value : current));
      };

      applyText(setMajor, draft.major);
      applyText(setGoal, draft.goal);
      applyText(setWeakPoints, draft.weakPoints);
      applyText(setHistory, draft.history);
      applyText(setCourseFocus, draft.courseFocus);
      applyText(setStudyTime, draft.studyTime);
      applyText(setPreferenceText, draft.preferenceText);
    },
    [],
  );

  const refreshPersonalization = useCallback(async () => {
    setContextLoading(true);
    setError(null);
    try {
      const context = await fetchJson<PersonalizationContext>(
        '/api/sky/cloud-mind/personalization-context',
      );
      setPersonalization(context);
      applyPersonalizationDraft(context, 'replace');
    } catch {
      setError('暂时没有读取到你的学习情况，可以补充当前课程或章节后生成资料。');
    } finally {
      setContextLoading(false);
    }
  }, [applyPersonalizationDraft]);

  useEffect(() => {
    let cancelled = false;
    const loadContext = async () => {
      setContextLoading(true);
      try {
        const context = await fetchJson<PersonalizationContext>(
          '/api/sky/cloud-mind/personalization-context',
        );
        if (cancelled) return;
        setPersonalization(context);
        applyPersonalizationDraft(context, 'fill-empty');
      } catch {
        /* keep editable profile available */
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    };

    void loadContext();

    return () => {
      cancelled = true;
    };
  }, [applyPersonalizationDraft]);

  const progress = useMemo(() => {
    const completed = stages.filter((stage) => stage.status === 'completed');
    const running = stages.find((stage) => stage.status === 'running');
    if (running) return running.progress;
    if (completed.length === 0) return 0;
    return completed[completed.length - 1]?.progress ?? 0;
  }, [stages]);

  const visibleResources = useMemo(() => {
    const resources = result?.resources ?? [];
    const filteredBySelection = resources.filter((resource) =>
      selectedTypes.includes(resource.type),
    );
    if (activeType === 'all') return filteredBySelection;
    return filteredBySelection.filter((resource) => resource.type === activeType);
  }, [activeType, result?.resources, selectedTypes]);

  const weakPointTags = useMemo(() => splitList(weakPoints), [weakPoints]);
  const evidenceItems = useMemo(() => {
    if (contextLoading) return ['正在查看课程、练习、错题和学习安排，了解你的学习情况。'];
    return recommendationEvidence(personalization);
  }, [contextLoading, personalization]);
  const systemProfileReady = hasSystemProfile(personalization);

  const updateStage = useCallback((key: string, status: StageStatus) => {
    setStages((items) => items.map((item) => (item.key === key ? { ...item, status } : item)));
  }, []);

  const toggleType = (type: string) => {
    setSelectedTypes((current) => {
      if (current.includes(type)) {
        return current.length === 1 ? current : current.filter((item) => item !== type);
      }
      return [...current, type];
    });
  };

  const removeWeakPoint = (tag: string) => {
    setWeakPoints((current) =>
      splitList(current)
        .filter((item) => item !== tag)
        .join('、'),
    );
  };

  const handleGenerate = async () => {
    const hasMeaningfulInput =
      major.trim() ||
      goal.trim() ||
      weakPoints.trim() ||
      history.trim() ||
      courseFocus.trim() ||
      supplement.trim() ||
      systemProfileReady;
    if (!hasMeaningfulInput) {
      setError('系统还缺少 1 项信息：请输入当前课程、章节或一句补充需求后再生成。');
      return;
    }

    const input = buildStudentInput({
      major,
      goal,
      weakPoints,
      history,
      supplement,
      preferenceText,
      selectedTypes,
      studyTime,
      courseFocus,
    });

    setLoading(true);
    setError(null);
    setResult(null);
    setProfile(null);
    setSafety(null);
    setHits([]);
    setActiveType('all');
    setStages(INITIAL_STAGES);

    try {
      updateStage('safety', 'running');
      const safetyResult = await fetchJson<SafetyResult>('/api/sky/content-safety/check', {
        method: 'POST',
        body: JSON.stringify({ input }),
      });
      setSafety(safetyResult);
      updateStage('safety', 'completed');

      if (!safetyResult.passed && safetyResult.action === 'reject') {
        throw new Error(safetyResult.message);
      }

      updateStage('profile', 'running');
      const profilePayload = await fetchJson<{ profile: StudentProfile }>(
        '/api/sky/student/profile/conversation',
        {
          method: 'POST',
          body: JSON.stringify({ input, userId: COURSE_STUDIO_USER_ID }),
        },
      );
      setProfile(profilePayload.profile);
      updateStage('profile', 'completed');

      updateStage('search', 'running');
      const query =
        splitList(weakPoints).join(' ') ||
        profilePayload.profile.dimensions.knowledgeBase.weakPoints.join(' ') ||
        courseFocus ||
        '人工智能导论';
      const searchPayload = await fetchJson<{ results: CourseHit[] }>(
        `/api/sky/course-knowledge/search?q=${encodeURIComponent(query)}&limit=6`,
      );
      setHits(searchPayload.results);
      updateStage('search', 'completed');

      updateStage('generate', 'running');
      const generation = await fetchJson<GenerationResult>('/api/sky/resource-generation/jobs', {
        method: 'POST',
        body: JSON.stringify({ input, userId: COURSE_STUDIO_USER_ID }),
      });
      setResult(generation);
      setProfile(generation.studentProfile);
      setSafety(generation.safety);
      setHits(generation.courseHits);
      updateStage('generate', 'completed');
      updateStage('review', 'completed');
      updateStage('path', 'completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败，请稍后再试');
      setStages((items) =>
        items.map((stage) => (stage.status === 'running' ? { ...stage, status: 'failed' } : stage)),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStartClassroom = async () => {
    const topic = courseFocus.trim() || goal.trim() || supplement.trim() || '人工智能导论';
    const resourceContext = (result?.resources ?? [])
      .slice(0, 4)
      .map((resource) => `${resource.title}：${resourceSummary(resource)}`)
      .join('\n');
    setNextAction('classroom');
    setNextActionError(null);
    try {
      const jobId = await submitClassroomJob({
        requirement: [
          `请围绕“${topic}”生成一套可授课的互动课堂。优先覆盖核心概念、示例和练习。`,
          resourceContext ? `本次已生成的资料摘要：\n${resourceContext}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        enableWebSearch: false,
        agentMode: 'default',
      });
      addActiveJobEntry({ jobId, topic });
      router.push(`/generation-progress?jobId=${encodeURIComponent(jobId)}`);
    } catch (err) {
      setNextActionError(err instanceof Error ? err.message : '课堂启动失败，请稍后再试');
      setNextAction('idle');
    }
  };

  const handleCreateLearningPlan = async () => {
    const goalTopic = courseFocus.trim() || goal.trim() || supplement.trim() || '人工智能导论';
    setNextAction('plan');
    setNextActionError(null);
    try {
      const response = await fetch('/api/sky/learning-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ goalTopic, strategy: 'balanced' }),
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || '学习任务生成失败');
      }
      router.push('/sky/learning');
    } catch (err) {
      setNextActionError(err instanceof Error ? err.message : '学习任务生成失败，请稍后再试');
      setNextAction('idle');
    }
  };

  return (
    <SkyAppShell>
      <div className="mx-auto max-w-4xl space-y-4 pb-24 sm:pb-10">
        <section className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <Badge
                variant="outline"
                className="h-7 rounded-full px-3 text-cyan-700 dark:text-cyan-100"
              >
                课程资源工坊
              </Badge>
              <h1 className="mt-3 text-2xl font-semibold leading-tight text-slate-950 dark:text-white sm:text-3xl">
                这次想生成什么学习资料？
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                已根据你的学习情况预设偏好。补一句本次重点，或直接生成一套资料。
              </p>
            </div>
            <Badge
              variant="outline"
              className="h-8 shrink-0 rounded-full px-3 text-slate-600 dark:text-slate-300"
            >
              {contextLoading
                ? '正在读取学习情况'
                : systemProfileReady
                  ? '已准备好'
                  : '补一句即可生成'}
            </Badge>
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-300/25 dark:bg-rose-300/10 dark:text-rose-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <section className="rounded-2xl border border-cyan-200/70 bg-cyan-50/60 p-4 shadow-sm dark:border-cyan-300/20 dark:bg-cyan-300/10 sm:p-5">
          <Textarea
            id="course-studio-intent"
            value={supplement}
            onChange={(event) => setSupplement(event.target.value)}
            placeholder="例如：帮我复习导数，准备期末考试"
            className="min-h-24 resize-none bg-white text-sm leading-6 dark:bg-slate-950/70"
          />
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {RESOURCE_TYPES.map((item) => (
                <ResourceTypePill
                  key={item.id}
                  item={item}
                  selected={selectedTypes.includes(item.id)}
                  onClick={() => toggleType(item.id)}
                />
              ))}
            </div>
            <Button
              type="button"
              className="min-h-11 w-full justify-center px-5 lg:w-auto lg:min-w-28"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              生成
            </Button>
          </div>
        </section>

        <div className="flex flex-wrap justify-center gap-2 text-sm">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setProfilePanelOpen((value) => !value)}
          >
            <UserRound className="h-4 w-4" />
            调整参考信息
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFlowPanelOpen((value) => !value)}
          >
            <Search className="h-4 w-4" />
            查看流程
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={refreshPersonalization}
            disabled={contextLoading || loading}
          >
            {contextLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            更新学习情况
          </Button>
        </div>

        {profilePanelOpen && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <BrainCircuit className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-100" />
                <h2 className="text-sm font-semibold text-slate-950 dark:text-white">参考信息</h2>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'h-7 shrink-0 rounded-full px-3',
                  systemProfileReady
                    ? 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-100'
                    : 'text-slate-500 dark:text-slate-300',
                )}
              >
                {contextLoading ? '读取中' : systemProfileReady ? '已自动应用' : '待补充'}
              </Badge>
            </div>
            <div className="mb-4 flex gap-2 rounded-xl bg-cyan-50 px-3 py-3 text-xs leading-5 text-cyan-800 dark:bg-cyan-300/10 dark:text-cyan-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>这些内容会帮助系统了解你的学习情况，不需要每次生成都填写。</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="major">专业背景</Label>
                <Input
                  id="major"
                  value={major}
                  onChange={(event) => setMajor(event.target.value)}
                  placeholder="软件工程大二，Python 基础较好"
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-focus">课程重点</Label>
                <Input
                  id="course-focus"
                  value={courseFocus}
                  onChange={(event) => setCourseFocus(event.target.value)}
                  placeholder="第 4 章 / 导数 / 重点公式"
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="goal">学习目标</Label>
                <Textarea
                  id="goal"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="想要更多例题或项目案例"
                  className="min-h-20 resize-none text-sm leading-6"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weak-points">薄弱点</Label>
                <Input
                  id="weak-points"
                  value={weakPoints}
                  onChange={(event) => setWeakPoints(event.target.value)}
                  placeholder="容易出错的知识点，例如：导数、受力分析"
                  className="min-h-11"
                />
                {weakPointTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {weakPointTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 rounded-full pr-1">
                        <span>{tag}</span>
                        <button
                          type="button"
                          aria-label={`移除薄弱点：${tag}`}
                          className="rounded-full p-0.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                          onClick={() => removeWeakPoint(tag)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="study-time">学习节奏</Label>
                <Input
                  id="study-time"
                  value={studyTime}
                  onChange={(event) => setStudyTime(event.target.value)}
                  placeholder="每天 45 分钟"
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="history">学习记录摘要</Label>
                <Textarea
                  id="history"
                  value={history}
                  onChange={(event) => setHistory(event.target.value)}
                  placeholder="系统会汇总近期练习、错题、复习和学习路径"
                  className="min-h-20 resize-none text-sm leading-6"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="preference-text">资料偏好</Label>
                <Input
                  id="preference-text"
                  value={preferenceText}
                  onChange={(event) => setPreferenceText(event.target.value)}
                  placeholder="图解、代码案例、分层练习"
                  className="min-h-11"
                />
              </div>
            </div>
          </section>
        )}

        {(flowPanelOpen || loading) && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <Search className="h-4 w-4 text-cyan-600 dark:text-cyan-100" />
                {loading ? '正在生成学习资料' : '生成流程'}
              </div>
              <Badge variant="outline" className="h-7 rounded-full px-3">
                {progress}%
              </Badge>
            </div>
            <Progress value={progress} className="mt-3 h-2" />
            {flowPanelOpen && <StageCards stages={stages} />}
          </section>
        )}

        {result && (
          <section className="rounded-2xl border border-sky-200 bg-sky-50/70 p-4 shadow-sm dark:border-sky-300/20 dark:bg-sky-300/10 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                  <Play className="h-4 w-4 text-sky-600 dark:text-sky-200" />
                  课程已经准备好，下一步做什么？
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  课堂会使用当前主题重新生成授课场景；学习任务会写入你的学习路径。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={handleStartClassroom}
                  disabled={nextAction !== 'idle'}
                  className="min-h-10 bg-sky-600 text-white hover:bg-sky-700"
                >
                  <Play className="h-4 w-4" />
                  {nextAction === 'classroom' ? '正在启动课堂' : '进入互动课堂'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCreateLearningPlan}
                  disabled={nextAction !== 'idle'}
                  className="min-h-10 border-sky-200 bg-white/80 dark:border-sky-300/30 dark:bg-slate-950/40"
                >
                  <BrainCircuit className="h-4 w-4" />
                  {nextAction === 'plan' ? '正在生成任务' : '生成学习任务'}
                </Button>
              </div>
            </div>
            {nextActionError && (
              <p className="mt-3 text-xs leading-5 text-rose-700 dark:text-rose-200">
                {nextActionError}
              </p>
            )}
          </section>
        )}

        {result && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-600 dark:text-cyan-100" />
                  <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
                    已生成 {result.resources.length} 份资料
                  </h2>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  找到 {hits.length} 条课程资料，内容检查
                  {result.reviewResult.passed ? '通过' : '需要复核'}。
                </p>
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                <FilterButton active={activeType === 'all'} onClick={() => setActiveType('all')}>
                  全部
                </FilterButton>
                {RESOURCE_TYPES.filter((item) => selectedTypes.includes(item.id)).map((item) => (
                  <FilterButton
                    key={item.id}
                    active={activeType === item.id}
                    onClick={() => setActiveType(item.id)}
                  >
                    {item.label}
                  </FilterButton>
                ))}
              </div>
            </div>

            {visibleResources.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  当前筛选下没有资料
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  切回全部，或重新选择需要生成的资料类型。
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleResources.map((resource) => (
                  <ResourceCard key={resource.id} resource={resource} />
                ))}
              </div>
            )}
          </section>
        )}

        {result && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700/40 dark:bg-slate-950/70">
            <div
              role="tablist"
              aria-label="生成详情"
              className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2 dark:bg-slate-900/60 sm:grid-cols-4"
            >
              {DETAIL_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeDetail === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`course-studio-detail-${tab.id}`}
                    onClick={() => setActiveDetail(tab.id)}
                    className={cn(
                      'flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors',
                      active
                        ? 'border-cyan-200 bg-white text-cyan-700 shadow-sm dark:border-cyan-300/30 dark:bg-cyan-300/10 dark:text-cyan-100'
                        : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-950/70',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.title}</span>
                  </button>
                );
              })}
            </div>

            <div
              id={`course-studio-detail-${activeDetail}`}
              role="tabpanel"
              className="border-t border-slate-200 p-4 dark:border-slate-700/40"
            >
              {activeDetail === 'fit' && (
                <>
                  {profile ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <SummaryRow label="背景" value={profile.dimensions.majorBackground.value} />
                      <SummaryRow label="目标" value={profile.dimensions.learningGoal.value} />
                      <SummaryRow label="风格" value={profile.dimensions.cognitiveStyle.value} />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      生成后显示学习情况摘要。
                    </p>
                  )}
                  <div className="mt-4 space-y-2">
                    {evidenceItems.map((item) => (
                      <div
                        key={item}
                        className="flex gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500 dark:bg-cyan-300" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeDetail === 'process' && (
                <>
                  <Progress value={progress} className="h-2" />
                  <StageCards stages={stages} />
                  {result.agentTrace.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {result.agentTrace.map((trace) => (
                        <div
                          key={`${trace.agent}-${trace.output}`}
                          className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {trace.agent}
                          </span>
                          ：{trace.output}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeDetail === 'trust' && (
                <>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-300/20 dark:bg-emerald-300/10">
                    <div className="text-xs font-medium text-emerald-700 dark:text-emerald-100">
                      {safety?.riskLevel ? `风险等级：${safety.riskLevel}` : '等待审核'}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-emerald-700/80 dark:text-emerald-100/80">
                      {safety?.message ?? '生成时会检查隐私、敏感内容和学术诚信风险。'}
                    </p>
                  </div>
                  <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    命中来源 {hits.length} 条
                  </div>
                  {hits.length > 0 && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {hits.slice(0, 4).map((hit) => (
                        <div
                          key={`${hit.document.file}-${hit.score}`}
                          className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-900/60 dark:text-slate-300"
                        >
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {hit.document.title}
                          </div>
                          <div className="mt-1 line-clamp-2">{hit.snippet}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeDetail === 'follow' && (
                <>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                        <Route className="h-4 w-4 text-cyan-600 dark:text-cyan-100" />
                        学习路径
                      </div>
                      {result.learningPath.map((node, index) => (
                        <div
                          key={`${node.dayRange}-${index}`}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700/40 dark:bg-slate-900/60"
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-600 text-xs text-white dark:bg-cyan-300 dark:text-slate-950">
                              {index + 1}
                            </span>
                            {node.goal}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {node.dayRange} · {node.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-100" />
                        下一步
                      </div>
                      <NextAction href="/sky/learning" icon={Route} label="加入天梯工坊计划" />
                      <NextAction
                        href="/sky/cloud-mind/quiz"
                        icon={FileQuestion}
                        label="生成配套练习"
                      />
                      <NextAction
                        href="/sky/learning#learning-plan"
                        icon={BrainCircuit}
                        label="查看个人学习计划"
                      />
                    </div>
                  </div>
                  <div className="mt-4 space-y-4">
                    <CourseStudioP1EvidencePanel result={result} userId={COURSE_STUDIO_USER_ID} />
                    <CourseStudioP2LongTermPanel p2={result.p2Enhancements} />
                  </div>
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </SkyAppShell>
  );
}

function ResourceTypePill({
  item,
  selected,
  onClick,
}: {
  item: ResourceTypeOption;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors',
        selected
          ? 'border-cyan-300 bg-white text-cyan-800 shadow-sm dark:border-cyan-300/40 dark:bg-slate-950/70 dark:text-cyan-50'
          : 'border-slate-200 bg-white/70 text-slate-600 hover:border-cyan-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function StageCards({ stages }: { stages: StageItem[] }) {
  return (
    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {stages.map((stage) => (
        <div
          key={stage.key}
          className="min-h-[86px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700/40 dark:bg-slate-900/60"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {stage.label}
            </span>
            {stage.status === 'running' ? (
              <Loader2 className="h-4 w-4 animate-spin text-cyan-600 dark:text-cyan-100" />
            ) : stage.status === 'completed' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : stage.status === 'failed' ? (
              <AlertTriangle className="h-4 w-4 text-rose-500" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
            )}
          </div>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {stage.agent} · {statusText(stage.status)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-xs font-semibold transition-colors',
        active
          ? 'border-cyan-300 bg-cyan-50 text-cyan-700 dark:border-cyan-300/40 dark:bg-cyan-300/10 dark:text-cyan-100'
          : 'border-slate-200 bg-white text-slate-500 hover:border-cyan-200 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300',
      )}
    >
      {children}
    </button>
  );
}

function resourceFileName(resource: GeneratedResource): string {
  return resource.downloadFileName ?? `${resource.id || 'learning-resource'}.md`;
}

function downloadableContent(resource: GeneratedResource): string {
  if (resource.content?.trim()) return resource.content.trim();
  return [
    `# ${resource.title}`,
    '',
    resourceSummary(resource),
    '',
    '## 来源',
    ...resource.sourceCitations,
  ].join('\n');
}

function downloadResource(resource: GeneratedResource) {
  const blob = new Blob([downloadableContent(resource)], {
    type: 'text/markdown;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = resourceFileName(resource);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ResourceCard({ resource }: { resource: GeneratedResource }) {
  const meta = RESOURCE_META[resource.type] ?? RESOURCE_META.markdown_lecture;
  const Icon = meta.icon;
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const content = downloadableContent(resource);
  const hasSubstantiveContent =
    content.trim().length > resourceSummary(resource).trim().length + 40;

  const copyContent = async () => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/40 dark:bg-slate-900/60">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold',
                meta.className,
              )}
            >
              <Icon className="h-4 w-4" />
              {meta.label}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
              {Math.round(resource.trust.confidence * 100)}%
            </span>
          </div>
          <h3 className="mt-3 text-base font-semibold leading-6 text-slate-950 dark:text-white">
            {resource.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {resourceSummary(resource)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setExpanded((value) => !value)}
            disabled={!hasSubstantiveContent}
          >
            <Eye className="h-4 w-4" />
            {expanded ? '收起' : '查看'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => downloadResource(resource)}
          >
            <Download className="h-4 w-4" />
            下载
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={copyContent}>
            <Clipboard className="h-4 w-4" />
            {copied ? '已复制' : '复制'}
          </Button>
        </div>
      </div>
      {resource.personalizationReason && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
          {resource.personalizationReason}
        </p>
      )}
      {expanded && (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700/50 dark:bg-slate-950/60">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap p-3 text-xs leading-5 text-slate-700 dark:text-slate-200">
            {content}
          </pre>
        </div>
      )}
      <div className="mt-3">
        <div className="mb-2 truncate text-xs text-slate-500 dark:text-slate-400">
          文件：{resourceFileName(resource)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {resource.sourceCitations.slice(0, 3).map((source) => (
            <Badge key={source} variant="outline" className="max-w-full rounded-full">
              <span className="truncate">{source}</span>
            </Badge>
          ))}
        </div>
      </div>
    </article>
  );
}

function NextAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-cyan-300/30 dark:hover:bg-cyan-300/10 dark:hover:text-cyan-100"
    >
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
