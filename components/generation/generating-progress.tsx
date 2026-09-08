'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, Circle } from 'lucide-react';
interface GeneratingProgressProps {
  outlineReady: boolean; // Is outline generation complete?
  firstPageReady: boolean; // Is first page generated?
  statusMessage: string;
  error?: string | null;
}

// Status item component - declared outside main component
function StatusItem({
  completed,
  inProgress,
  hasError,
  label,
}: {
  completed: boolean;
  inProgress: boolean;
  hasError: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex-shrink-0">
        {hasError ? (
          <XCircle className="size-6 text-destructive" />
        ) : completed ? (
          <CheckCircle2 className="size-6 text-green-500" />
        ) : inProgress ? (
          <Loader2 className="size-6 text-primary animate-spin" />
        ) : (
          <Circle className="size-6 text-muted-foreground" />
        )}
      </div>
      <span
        className={`text-base ${
          hasError
            ? 'text-destructive'
            : completed
              ? 'text-green-600 font-medium'
              : inProgress
                ? 'text-primary font-medium'
                : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function GeneratingProgress({
  outlineReady,
  firstPageReady,
  statusMessage,
  error,
}: GeneratingProgressProps) {
  const [dots, setDots] = useState('');

  // Animated dots for loading state
  useEffect(() => {
    if (!error && !firstPageReady) {
      const interval = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
      }, 500);
      return () => clearInterval(interval);
    }
  }, [error, firstPageReady]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {error ? (
              <>
                <XCircle className="size-5 text-destructive" />
                {'生成失败'}
              </>
            ) : firstPageReady ? (
              <>
                <CheckCircle2 className="size-5 text-green-500" />
                {'即将打开课堂...'}
              </>
            ) : (
              <>
                <Loader2 className="size-5 animate-spin" />
                {'正在生成课程'}
                {dots}
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Two milestone status items */}
          <div className="divide-y">
            <StatusItem
              completed={outlineReady}
              inProgress={!outlineReady && !error}
              hasError={!outlineReady && !!error}
              label={outlineReady ? '课程大纲已生成' : '生成课程大纲'}
            />
            <StatusItem
              completed={firstPageReady}
              inProgress={outlineReady && !firstPageReady && !error}
              hasError={outlineReady && !firstPageReady && !!error}
              label={firstPageReady ? '首页已就绪！正在打开课堂...' : '首页内容生成中...'}
            />
          </div>

          {/* Status message */}
          {statusMessage && !error && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">{statusMessage}</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
