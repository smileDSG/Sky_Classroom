'use client';

import {
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { MathRenderer } from './math-renderer';

// ── Types matching the API response ────────────────────────────────

interface ErrorPattern {
  knowledgePoint: string;
  errorType: string;
  frequency: number;
  lastOccurrence: string | number;
}

interface StudentProfile {
  userId: string;
  masteryBySubject: Record<string, number>;
  masteryByKnowledge: Record<string, number>;
  weakPoints: string[];
  strongPoints: string[];
  errorPatterns: ErrorPattern[];
  totalQuestions: number;
  totalCorrect: number;
  lastUpdated: string | number;
}

// ── Subject display names ──────────────────────────────────────────

const SUBJECT_LABELS: Record<string, string> = {
  math: '数学',
  physics: '物理',
  chemistry: '化学',
  biology: '生物',
  chinese: '语文',
  english: '英语',
  history: '历史',
  geography: '地理',
  politics: '政治',
  unknown: '其他',
};

function masteryColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 30) return 'text-orange-500';
  return 'text-red-500';
}

const causeLabels: Record<string, string> = {
  'calculation-error': '计算失误',
  'concept-unclear': '概念不清',
  'method-wrong': '方法错误',
  misreading: '审题错误',
  careless: '粗心大意',
  'format-error': '格式错误',
};

// ── Stat Card ──────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl border bg-slate-800/60 backdrop-blur-sm p-4 flex items-center gap-4">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', color)}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// ── Mastery Bar ────────────────────────────────────────────────────

function MasteryBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-sm w-24 shrink-0 truncate" title={label}>
        <MathRenderer content={label} />
      </span>
      <div className="flex-1">
        <Progress value={score} className="h-2" />
      </div>
      <span className={cn('text-sm font-semibold w-10 text-right', masteryColor(score))}>
        {score}%
      </span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────

interface StudentProfileDisplayProps {
  profile: StudentProfile;
  className?: string;
}

export function StudentProfileDisplay({ profile, className }: StudentProfileDisplayProps) {
  const {
    masteryBySubject,
    masteryByKnowledge,
    weakPoints,
    strongPoints,
    errorPatterns,
    totalQuestions,
    totalCorrect,
  } = profile;

  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const subjects = Object.entries(masteryBySubject || {})
    .filter(([k]) => k !== 'unknown' || masteryBySubject['unknown'] > 0)
    .map(([key, val]) => ({
      key,
      label: SUBJECT_LABELS[key] ?? key,
      score: val,
    }))
    .sort((a, b) => b.score - a.score);

  const knowledgePoints = Object.entries(masteryByKnowledge || {})
    .map(([kp, mastery]) => ({ kp, mastery }))
    .sort((a, b) => a.mastery - b.mastery);

  const sortedErrors = [...(errorPatterns || [])].sort((a, b) => b.frequency - a.frequency);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="总做题数"
          value={totalQuestions}
          icon={<BookOpen className="h-5 w-5 text-blue-600" />}
          color="bg-blue-900/30"
        />
        <StatCard
          label="正确数"
          value={totalCorrect}
          icon={<CheckCircle2 className="h-5 w-5 text-green-600" />}
          color="bg-green-900/30"
        />
        <StatCard
          label="正确率"
          value={`${accuracy}%`}
          icon={<Target className="h-5 w-5 text-amber-600" />}
          color="bg-amber-900/30"
        />
        <StatCard
          label="错误模式数"
          value={errorPatterns?.length ?? 0}
          icon={<AlertCircle className="h-5 w-5 text-rose-600" />}
          color="bg-rose-900/30"
        />
      </div>

      {/* Two column layout: Subjects + Knowledge */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Mastery */}
        <Card className="bg-slate-800/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              学科掌握情况
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {subjects.length > 0 ? (
              subjects.map((s) => <MasteryBar key={s.key} label={s.label} score={s.score} />)
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                暂无数据，开始做题后自动分析
              </p>
            )}
          </CardContent>
        </Card>

        {/* Knowledge Point Mastery */}
        <Card className="bg-slate-800/60 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              知识点掌握
            </CardTitle>
          </CardHeader>
          <CardContent>
            {knowledgePoints.length > 0 ? (
              <div className="space-y-1 max-h-[320px] overflow-y-auto">
                {knowledgePoints.map(({ kp, mastery }) => (
                  <MasteryBar key={kp} label={kp} score={mastery} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无数据</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weak & Strong Points */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weak Points */}
        <Card className="bg-slate-800/60 backdrop-blur-sm border-red-900/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-400">
              <TrendingDown className="h-4 w-4" />
              薄弱知识点（需要加强）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weakPoints && weakPoints.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {weakPoints.map((kp) => (
                  <Badge
                    key={kp}
                    variant="secondary"
                    className="bg-red-900/20 text-red-400 border-red-800/30"
                  >
                    <MathRenderer content={kp} />
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无薄弱知识点 🎉</p>
            )}
          </CardContent>
        </Card>

        {/* Strong Points */}
        <Card className="bg-slate-800/60 backdrop-blur-sm border-green-900/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              强势知识点（已掌握）
            </CardTitle>
          </CardHeader>
          <CardContent>
            {strongPoints && strongPoints.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {strongPoints.map((kp) => (
                  <Badge
                    key={kp}
                    variant="secondary"
                    className="bg-green-900/20 text-green-400 border-green-800/30"
                  >
                    <MathRenderer content={kp} />
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">继续加油，积累更多强势知识点 💪</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Error Patterns */}
      <Card className="bg-slate-800/60 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            高频错误模式
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedErrors.length > 0 ? (
            <div className="space-y-2">
              {sortedErrors.map((ep, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-slate-700/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-900/30 text-xs font-bold text-orange-400">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        <MathRenderer content={ep.knowledgePoint} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {causeLabels[ep.errorType] ?? ep.errorType}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="bg-orange-900/20 text-orange-400">
                    出现 {ep.frequency} 次
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">暂无错误记录 🎉</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
