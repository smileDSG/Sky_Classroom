'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, GraduationCap, Loader2, Presentation } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { persistQuickIdentity, type QuickIdentity } from '@/lib/onboarding/quick-onboarding';

const OPTIONS: Array<{
  value: QuickIdentity;
  title: string;
  desc: string;
  icon: typeof GraduationCap;
}> = [
  { value: 'learner', title: '我是学生', desc: '学知识、做练习、复习备考', icon: GraduationCap },
  { value: 'educator', title: '我是老师', desc: '备课、做课件、上课讲解', icon: Presentation },
];

export function QuickOnboarding() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [selected, setSelected] = useState<QuickIdentity | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function finish(identity: QuickIdentity | null) {
    setSaving(true);
    setError('');
    try {
      if (identity) persistQuickIdentity(identity);
      const response = await fetch('/api/user/learning-onboarding/skip', { method: 'POST' });
      if (!response.ok) throw new Error('skip failed');
      await refresh();
      router.push('/');
    } catch {
      setError('进入失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-xl flex-col px-4 py-10 sm:justify-center">
      <header className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">欢迎来到天空课堂</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          你是哪类用户？只用于推荐合适的入口，可随时在设置里修改。
        </p>
      </header>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setSelected(option.value)}
              className={cn(
                'flex flex-col items-start gap-3 rounded-2xl border p-5 text-left transition-colors',
                active
                  ? 'border-sky-400 ring-2 ring-sky-400/30 bg-sky-50/60 dark:bg-sky-400/10'
                  : 'border-slate-200 hover:border-sky-200 dark:border-slate-700',
              )}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-200">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-semibold text-foreground">{option.title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{option.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 text-muted-foreground"
          disabled={saving}
          onClick={() => finish(null)}
        >
          暂时跳过
        </Button>
        <Button
          type="button"
          className="min-h-11"
          disabled={saving}
          onClick={() => finish(selected)}
        >
          {saving ? <Loader2 className="animate-spin" /> : null}
          进入天空课堂
          <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
