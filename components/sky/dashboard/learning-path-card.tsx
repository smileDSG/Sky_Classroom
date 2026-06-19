'use client';

import { useState, useEffect, type ElementType, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  Route,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Circle,
  PlayCircle,
  Brain,
  CalendarClock,
  AlertTriangle,
  Target,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type {
  LearningPath,
  LearningPathNode,
  PriorityStrategy,
  StrategyAlias,
} from '@/lib/teaching/learning-path-types';

interface LearningPathCardProps {
  onStartTopic?: (topic: string) => void;
}

interface PreviewData {
  weakPoints: string[];
  dueReviewItems: Array<{
    id: string;
    problemText: string;
    knowledgePoints: string[];
    nextReview: number;
    overdue: boolean;
  }>;
  topErrorPatterns: Array<{
    knowledgePoint: string;
    errorType: string;
    frequency: number;
  }>;
  causeDistribution: Record<string, number>;
  recentQuizSummary: {
    overallAccuracy: number;
    topErrorCauses: string[];
    recommendedDepthShift: 'deeper' | 'shallower' | 'maintain';
  } | null;
  learningStats: {
    todayStudyMinutes: number;
    streakDays: number;
    masteryPercent: number;
    checkedInToday: boolean;
  };
  masteryPercent: number;
}

const STRATEGIES: { key: StrategyAlias; label: string; icon: ElementType; desc: string }[] =
  [
    {
      key: 'balanced',
      label: '均衡提升',
      icon: BarChart3,
      desc: '综合考虑薄弱点、复习计划和错因',
    },
    {
      key: 'weakness-first',
      label: '薄弱优先',
      icon: AlertTriangle,
      desc: '优先攻克掌握度最低的知识点',
    },
    {
      key: 'review-first',
      label: '复习到期优先',
      icon: CalendarClock,
      desc: '优先安排今天到期的复习内容',
    },
    {
      key: 'error-first',
      label: '错因攻坚',
      icon: Brain,
      desc: '集中突破高频错误类型',
    },
    {
      key: 'goal-topic',
      label: '目标主题',
      icon: Target,
      desc: '围绕你输入的目标主题展开',
    },
  ];

function getNodeStatusIcon(node: LearningPathNode) {
  if (node.status === 'completed') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  }
  if (node.status === 'in_progress') {
    return <PlayCircle className="h-4 w-4 text-indigo-500" />;
  }
  return <Circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />;
}

function getNodeStatusColor(status: LearningPathNode['status']) {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500';
    case 'in_progress':
      return 'bg-indigo-500';
    default:
      return 'bg-slate-200 dark:bg-slate-700';
  }
}

export function LearningPathCard({ onStartTopic }: LearningPathCardProps) {
  const [path, setPath] = useState<LearningPath | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Generation dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [strategy, setStrategy] = useState<StrategyAlias>('balanced');
  const [priorities, setPriorities] = useState<PriorityStrategy[]>(['balanced']);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [goalTopic, setGoalTopic] = useState('');

  useEffect(() => {
    fetch('/api/sky/learning-path', { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        if (j.success && j.data.path) {
          setPath(j.data.path);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleOpenDialog = async () => {
    setDialogOpen(true);
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/sky/learning-path/preview', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setPreview(data.data);
      } else {
        toast.error(data.error || '加载预览失败');
      }
    } catch (err) {
      toast.error('加载预览失败，请检查网络');
      console.error('Preview load failed:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const body: {
        goalTopic?: string;
        strategy?: StrategyAlias;
        priorities?: PriorityStrategy[];
      } = { strategy };

      if (strategy === 'goal-topic') {
        body.goalTopic = goalTopic.trim();
      }

      if (showAdvanced) {
        body.priorities = priorities;
      }

      const res = await fetch('/api/sky/learning-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        const newPath = data.data?.path;
        setPath(newPath ?? null);
        setDialogOpen(false);
        if (newPath && newPath.nodes.length > 0) {
          toast.success('学习路径已生成');
        } else {
          toast.error('生成失败：未获取到路径内容，请稍后重试');
        }
      } else {
        toast.error(data.error || '生成失败，请重试');
      }
    } catch (err) {
      toast.error('生成请求失败，请检查网络或稍后重试');
      console.error('Create path failed:', err);
    } finally {
      setCreating(false);
    }
  };

  const togglePriority = (p: PriorityStrategy) => {
    setPriorities((prev) => {
      if (prev.includes(p)) {
        const next = prev.filter((x) => x !== p);
        return next.length > 0 ? next : ['balanced'];
      }
      return [...prev.filter((x) => x !== 'balanced'), p];
    });
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 p-5 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 mb-3">
          <Route className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">学习路径</span>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      </motion.div>
    );
  }

  if (!path) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 p-5 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2 mb-3">
            <Route className="h-4 w-4 text-indigo-500" />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">学习路径</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            还没有学习路径，让 AI 为你规划一条个性化学习路线吧。
          </p>
          <Button
            size="sm"
            onClick={handleOpenDialog}
            disabled={creating}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Route className="h-3.5 w-3.5 mr-1" />
            )}
            生成学习路径
          </Button>
        </motion.div>

        <GenerationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          preview={preview}
          previewLoading={previewLoading}
          strategy={strategy}
          onStrategyChange={(s) => {
            setStrategy(s);
            if (s === 'goal-topic') {
              setPriorities(['goal-topic']);
            } else if (s === 'weakness-first') {
              setPriorities(['weakness']);
            } else if (s === 'review-first') {
              setPriorities(['review']);
            } else if (s === 'error-first') {
              setPriorities(['error-pattern']);
            } else {
              setPriorities(['balanced']);
            }
          }}
          goalTopic={goalTopic}
          onGoalTopicChange={setGoalTopic}
          showAdvanced={showAdvanced}
          onShowAdvancedChange={setShowAdvanced}
          priorities={priorities}
          onTogglePriority={togglePriority}
          creating={creating}
          onCreate={handleCreate}
        />
      </>
    );
  }

  const completed = path.nodes.filter((n) => n.status === 'completed').length;
  const total = path.nodes.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const nextNode = path.nodes.find((n) => n.status === 'pending' || n.status === 'in_progress');
  const currentNode = path.nodes.find((n) => n.status === 'in_progress');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white/70 dark:bg-slate-900/50 p-5 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{path.title}</span>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {completed}/{total} 完成
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </div>

      {/* Node list */}
      <div className="space-y-2 mb-4 max-h-[160px] overflow-y-auto pr-1">
        {path.nodes.slice(0, 6).map((node) => (
          <div
            key={node.id}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
              node.status === 'in_progress'
                ? 'bg-indigo-50 dark:bg-indigo-900/20'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
            )}
          >
            <div className="shrink-0">{getNodeStatusIcon(node)}</div>
            <span
              className={cn(
                'truncate flex-1',
                node.status === 'completed'
                  ? 'text-slate-400 dark:text-slate-500 line-through'
                  : node.status === 'in_progress'
                    ? 'text-indigo-700 dark:text-indigo-300 font-medium'
                    : 'text-slate-600 dark:text-slate-300',
              )}
            >
              {node.topic}
            </span>
            {node.masteryAfter !== undefined && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                掌握度 {node.masteryAfter}%
              </span>
            )}
          </div>
        ))}
        {path.nodes.length > 6 && (
          <p className="text-xs text-slate-400 text-center">还有 {path.nodes.length - 6} 个节点...</p>
        )}
      </div>

      {/* Next action */}
      {nextNode && onStartTopic && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onStartTopic(nextNode.topic)}
          className="w-full text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:text-indigo-700"
        >
          <ArrowRight className="h-3.5 w-3.5 mr-1" />
          {currentNode ? `继续学习：${currentNode.topic}` : `开始学习：${nextNode.topic}`}
        </Button>
      )}
    </motion.div>
  );
}

interface GenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: PreviewData | null;
  previewLoading: boolean;
  strategy: StrategyAlias;
  onStrategyChange: (strategy: StrategyAlias) => void;
  goalTopic: string;
  onGoalTopicChange: (value: string) => void;
  showAdvanced: boolean;
  onShowAdvancedChange: (value: boolean) => void;
  priorities: PriorityStrategy[];
  onTogglePriority: (p: PriorityStrategy) => void;
  creating: boolean;
  onCreate: () => void;
}

function GenerationDialog({
  open,
  onOpenChange,
  preview,
  previewLoading,
  strategy,
  onStrategyChange,
  goalTopic,
  onGoalTopicChange,
  showAdvanced,
  onShowAdvancedChange,
  priorities,
  onTogglePriority,
  creating,
  onCreate,
}: GenerationDialogProps) {
  const canCreate =
    strategy !== 'goal-topic' || (strategy === 'goal-topic' && goalTopic.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500">
              <Route className="h-4 w-4 text-white" />
            </div>
            生成个性化学习路径
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400">
            基于天梯工坊数据为你规划下一步学习重点
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="p-5 space-y-5">
            {/* Workshop preview */}
            {previewLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              </div>
            ) : preview ? (
              <div className="grid grid-cols-2 gap-3">
                <PreviewCard
                  icon={AlertTriangle}
                  label="薄弱知识点"
                  color="text-rose-500"
                  bg="bg-rose-500/10"
                >
                  {preview.weakPoints.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {preview.weakPoints.slice(0, 4).map((kp) => (
                        <Badge
                          key={kp}
                          variant="outline"
                          className="text-[10px] border-rose-200 text-rose-600 dark:border-rose-800 dark:text-rose-400"
                        >
                          {kp}
                        </Badge>
                      ))}
                      {preview.weakPoints.length > 4 && (
                        <span className="text-[10px] text-slate-400">+{preview.weakPoints.length - 4}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">暂无薄弱点</span>
                  )}
                </PreviewCard>

                <PreviewCard
                  icon={CalendarClock}
                  label="今日复习"
                  color="text-amber-500"
                  bg="bg-amber-500/10"
                >
                  <div className="text-lg font-bold text-slate-700 dark:text-slate-200">
                    {preview.dueReviewItems.length}
                    <span className="text-xs font-normal text-slate-400 ml-1">项到期</span>
                  </div>
                  {preview.dueReviewItems.some((i) => i.overdue) && (
                    <Badge
                      variant="outline"
                      className="text-[10px] border-amber-200 text-amber-600 mt-1"
                    >
                      包含逾期
                    </Badge>
                  )}
                </PreviewCard>

                <PreviewCard
                  icon={Brain}
                  label="高频错因"
                  color="text-violet-500"
                  bg="bg-violet-500/10"
                >
                  {preview.topErrorPatterns.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {preview.topErrorPatterns.slice(0, 2).map((p) => (
                        <Badge
                          key={`${p.knowledgePoint}-${p.errorType}`}
                          variant="outline"
                          className="text-[10px] border-violet-200 text-violet-600 dark:border-violet-800 dark:text-violet-400"
                        >
                          {p.errorType}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">暂无错因数据</span>
                  )}
                </PreviewCard>

                <PreviewCard
                  icon={BarChart3}
                  label="最近测验"
                  color="text-emerald-500"
                  bg="bg-emerald-500/10"
                >
                  <div className="text-lg font-bold text-slate-700 dark:text-slate-200">
                    {preview.recentQuizSummary?.overallAccuracy ?? 0}%
                    <span className="text-xs font-normal text-slate-400 ml-1">正确率</span>
                  </div>
                </PreviewCard>
              </div>
            ) : null}

            {/* Strategy selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                选择生成策略
              </label>
              <div className="grid grid-cols-1 gap-2">
                {STRATEGIES.map(({ key, label, icon: Icon, desc }) => {
                  const active = strategy === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onStrategyChange(key)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all',
                        active
                          ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20'
                          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800',
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                          active ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-700',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            'text-sm font-medium',
                            active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200',
                          )}
                        >
                          {label}
                        </div>
                        <div className="text-xs text-slate-400 truncate">{desc}</div>
                      </div>
                      {active && (
                        <div className="h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Goal topic input */}
            {strategy === 'goal-topic' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  目标主题
                </label>
                <Input
                  placeholder="例如：二次函数、三角函数、电磁感应..."
                  value={goalTopic}
                  onChange={(e) => onGoalTopicChange(e.target.value)}
                  className="focus-visible:ring-indigo-500"
                />
                <p className="text-xs text-slate-400">输入知识点名称，AI 会围绕它展开先修与巩固路径</p>
              </div>
            )}

            {/* Advanced combination */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => onShowAdvancedChange(!showAdvanced)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {showAdvanced ? '收起组合策略' : '高级：组合多个优先级'}
              </button>
              {showAdvanced && (
                <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
                  {(
                    [
                      { key: 'weakness', label: '薄弱优先' },
                      { key: 'review', label: '复习到期' },
                      { key: 'error-pattern', label: '错因攻坚' },
                      { key: 'goal-topic', label: '目标主题' },
                    ] as { key: PriorityStrategy; label: string }[]
                  ).map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      <Checkbox
                        checked={priorities.includes(key)}
                        onCheckedChange={() => onTogglePriority(key)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-slate-100 dark:border-slate-700/50">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={onCreate}
            disabled={creating || !canCreate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Route className="h-3.5 w-3.5 mr-1" />
            )}
            确认生成
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewCard({
  icon: Icon,
  label,
  color,
  bg,
  children,
}: {
  icon: ElementType;
  label: string;
  color: string;
  bg: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800/40 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <div className={cn('flex h-5 w-5 items-center justify-center rounded', bg)}>
          <Icon className={cn('h-3 w-3', color)} />
        </div>
        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      {children}
    </div>
  );
}
