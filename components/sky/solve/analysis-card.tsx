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
  easy:   { label: '基础', badge: 'border-emerald-700 bg-emerald-950/50 text-emerald-300', icon: '🟢' },
  medium: { label: '中等', badge: 'border-amber-700 bg-amber-950/50 text-amber-300', icon: '🟡' },
  hard:   { label: '困难', badge: 'border-red-700 bg-red-950/50 text-red-300', icon: '🔴' },
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
    <Card className={cn('overflow-hidden probe-panel', className)}>
      <CardHeader className="probe-header-gradient pb-3">
        <CardTitle className="flex items-center gap-2 text-sm text-[var(--probe-primary-bright)]">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--probe-primary)]/20 border border-[var(--probe-primary)]/30">
            <Lightbulb className="h-3.5 w-3.5" />
          </div>
          信号分析
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Subject + Difficulty + Type row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs font-medium border-[var(--probe-primary)]/30 text-[var(--probe-primary-bright)] bg-[var(--probe-primary)]/10">
            <BookOpen className="h-3 w-3 mr-1" />
            {subjectLabel}
          </Badge>

          <Badge className={cn('text-xs font-medium border', difficulty.badge)}>
            {difficulty.icon} {difficulty.label}
          </Badge>

          <Badge variant="secondary" className="text-xs bg-[var(--probe-accent)]/15 text-[var(--probe-accent)] border border-[var(--probe-accent)]/25">
            <Target className="h-3 w-3 mr-1" />
            {typeLabel}
          </Badge>

          <Badge variant="outline" className="text-xs border-[var(--probe-border-strong)] text-[var(--probe-muted)]">
            <Zap className="h-3 w-3 mr-1" />
            判断把握 {Math.round(analysis.confidence * 100)}%
          </Badge>
        </div>

        {/* Knowledge points */}
        {analysis.knowledgePoints.length > 0 && (
          <div>
            <div className="text-xs text-[var(--probe-muted)] mb-1.5">知识点</div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.knowledgePoints.map((kp, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-md bg-[var(--probe-primary)]/15 px-2 py-1 text-xs font-medium text-[var(--probe-primary-bright)] border border-[var(--probe-primary)]/30 shadow-[0_0_4px_var(--probe-glow)]"
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
