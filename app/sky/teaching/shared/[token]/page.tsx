'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'motion/react';
import { BookOpen, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MathRenderer } from '@/components/sky/solve/math-renderer';
import type { LessonPlan, LessonSection } from '@/lib/teaching/lesson-types';
import type { ContentChunk } from '@/lib/teaching/content-types';

interface SharedTeachingData {
  topic: string;
  plan: LessonPlan;
  sections: { section: LessonSection; chunks: ContentChunk[] }[];
  sharedBy: string;
  sharedAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  explanation: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  example: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  diagram: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400',
  quiz: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400',
};

const DEPTH_LABELS: Record<string, string> = {
  basic: '基础讲解',
  intermediate: '重点强化',
  advanced: '拓展提升',
};

export default function SharedTeachingPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<SharedTeachingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const res = await fetch(`/api/sky/teaching/shared/${token}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || '无法加载分享的教案');
        }

        const result = await res.json();
        setData(result.data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '加载失败';
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <p className="text-center text-muted-foreground">{error || '教案不存在'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{data.plan.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    分享自 {data.sharedBy} · {new Date(data.sharedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>预计 {data.plan.estimatedDuration} 分钟</span>
                <span>{data.plan.sections.length} 个章节</span>
                {data.plan.focusPoints.length > 0 && (
                  <div className="flex gap-1.5">
                    <span>重点：</span>
                    {data.plan.focusPoints.map((fp) => (
                      <Badge key={fp} variant="outline" className="text-[11px]">
                        {fp}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Sections */}
        <div className="space-y-6">
          {data.sections.map((s, index) => (
            <motion.div
              key={s.section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Badge variant="secondary" className={TYPE_COLORS[s.section.contentType]}>
                        {s.section.contentType === 'quiz'
                          ? '随堂测验'
                          : s.section.contentType === 'example'
                            ? '例题讲解'
                            : '知识讲解'}
                      </Badge>
                      {s.section.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {DEPTH_LABELS[s.section.depth]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {s.section.estimatedDuration}分钟
                      </span>
                    </div>
                  </div>
                  {s.section.knowledgePoints.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {s.section.knowledgePoints.map((kp) => (
                        <Badge
                          key={kp}
                          variant="outline"
                          className="text-[11px] border-sky-200/50 dark:border-sky-700/30 text-sky-700 dark:text-sky-300"
                        >
                          {kp}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...s.chunks]
                    .sort((a, b) => a.order - b.order)
                    .map((chunk) => (
                      <div
                        key={chunk.order}
                        className="rounded-lg p-4 bg-white/40 dark:bg-slate-700/20"
                      >
                        <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-100">
                          <MathRenderer content={chunk.content} />
                        </div>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 text-center text-sm text-muted-foreground"
        >
          <p>由天空课堂 AI 智能授课系统生成</p>
        </motion.div>
      </div>
    </div>
  );
}
