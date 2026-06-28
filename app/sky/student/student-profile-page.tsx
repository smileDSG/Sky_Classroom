'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Loader2, AlertCircle, RefreshCw, UserCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StudentProfileDisplay } from '@/components/sky/solve/student-profile';
import { cn } from '@/lib/utils';

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

export function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchProfile = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);

    try {
      const shouldForce = force || !hasLoadedRef.current;
      const url = `/api/sky/student/profile?force=${shouldForce}`;
      const res = await fetch(url);
      const data = await res.json();

      if (data?.success && data.profile) {
        hasLoadedRef.current = true;
        setProfile(data.profile);
      } else {
        setError(data?.error ?? '获取学情数据失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络请求失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/sky/learning"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            返回天梯工坊
          </Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20">
            <UserCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold">学情分析</h2>
            <p className="text-sm text-muted-foreground">
              基于你的做题数据，自动生成学科掌握度与薄弱点分析
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchProfile(true)}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          刷新
        </Button>
      </div>

      {/* Loading */}
      {loading && !profile && (
        <Card className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-sky-500 mb-3" />
            <p className="text-sm text-muted-foreground">正在分析学情数据...</p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200/50 dark:border-red-800/30">
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <span className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchProfile()}
              className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Profile Data */}
      {profile && <StudentProfileDisplay profile={profile} />}
    </div>
  );
}
