'use client';

import { BookOpen, Lightbulb, Target, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────

export interface AnalysisCardData {
  subject: string;
  knowledgePoints: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'choice' | 'fill' | 'solve' | 'judge';
  confidence: number;
}

// ── Display helpers ─────────────────────────────────────────────────

const SUBJECT_LABELS: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学', biology: '生物',
  chinese: '语文', english: '英语', history: '历史', geography: '地理',
  politics: '政治', unknown: '未知',
};

const DIFFICULTY_CONFIG: Record<string, { label: string; badge: string; icon: string }> = {
  easy:   { label: '基础', badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300', icon: '🟢' },
  medium: { label: '中等', badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300', icon: '🟡' },
  hard:   { label: '困难', badge: 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300', icon: '🔴' },
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  choice: '选择题', fill: '填空题', solve: '解答题', judge: '判断题',
};

// ── Component ────────────────────────────────────────────────────────

interface AnalysisCardProps {
  analysis: AnalysisCardData;
  className?: string;
}

export function AnalysisCard({ analysis, className }: AnalysisCardProps) {
  const difficulty = DIFFICULTY_CONFIG[analysis.difficulty] ?? DIFFICULTY_CONFIG.medium;
  const subjectLabel = SUBJECT_LABELS[analysis.subject] ?? analysis.subject;
  const typeLabel = QUESTION_TYPE_LABELS[analysis.questionType] ?? analysis.questionType;

  return (
    <Card className={cn('overflow-hidden border-sky-200/50 dark:border-sky-800/40 shadow-md shadow-sky-100/50 dark:shadow-sky-900/20', className)}>
      <CardHeader className="border-b bg-gradient-to-r from-sky-50 to-transparent dark:from-sky-950/30 dark:to-transparent pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-sky-700 dark:text-sky-300">
          <Lightbulb className="h-4 w-4" />
          题目分析
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Subject + Difficulty + Type row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs font-medium">
            <BookOpen className="h-3 w-3 mr-1" />
            {subjectLabel}
          </Badge>

          <Badge className={cn('text-xs font-medium border', difficulty.badge)}>
            {difficulty.icon} {difficulty.label}
          </Badge>

          <Badge variant="secondary" className="text-xs">
            <Target className="h-3 w-3 mr-1" />
            {typeLabel}
          </Badge>

          <Badge variant="outline" className="text-xs text-muted-foreground">
            <Zap className="h-3 w-3 mr-1" />
            置信度 {Math.round(analysis.confidence * 100)}%
          </Badge>
        </div>

        {/* Knowledge points */}
        {analysis.knowledgePoints.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-1.5">知识点</div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.knowledgePoints.map((kp, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md bg-sky-50 dark:bg-sky-950/20 px-2 py-1 text-xs font-medium text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-800/30"
                >
                  {kp}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
