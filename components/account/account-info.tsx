/**
 * Read-only account information display.
 */

'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const ROLE_MAP: Record<string, string> = {
  guest: 'roleGuest',
  user: 'roleUser',
  admin: 'roleAdmin',
};

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'destructive' }> = {
  active: { label: 'statusActive', variant: 'default' },
  suspended: { label: 'statusSuspended', variant: 'destructive' },
};

const PLAN_MAP: Record<string, string> = {
  free: 'planFree',
  basic: 'planBasic',
  pro: 'planPro',
  enterprise: 'planEnterprise',
};

interface UsageData {
  planType: string;
  llmCalls: { current: number; limit: number };
  generationCount: { current: number; limit: number };
  storageUsed: number;
  resetAt: number;
}

export function AccountInfo() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/usage/check', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success) setUsage(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const statusInfo = STATUS_MAP[user.status] ?? { label: user.status, variant: 'default' as const };

  const pct = (current: number, limit: number) =>
    limit === 0 ? 0 : Math.round((current / limit) * 100);
  const barColor = (p: number) =>
    p > 90 ? 'bg-red-500' : p > 70 ? 'bg-yellow-500' : 'bg-green-500';

  const resetTime = usage?.resetAt
    ? new Date(usage.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const fields = [
    { label: t('account.email'), value: user.email ?? '—' },
    { label: t('account.username'), value: user.username },
    { label: t('account.role'), value: t(`account.${ROLE_MAP[user.role] ?? user.role}`) },
    {
      label: t('account.status'),
      value: (
        <Badge variant={statusInfo.variant} className="capitalize">
          {t(`account.${statusInfo.label}`)}
        </Badge>
      ),
    },
    {
      label: t('account.planType'),
      value: (
        <span
          className={cn(
            'capitalize',
            user.planType !== 'free' && 'text-amber-600 dark:text-amber-400 font-medium',
          )}
        >
          {t(`account.${PLAN_MAP[user.planType] ?? user.planType}`)}
        </span>
      ),
    },
    {
      label: t('account.userId'),
      value: (
        <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
          {user.id.slice(0, 8)}...{user.id.slice(-4)}
        </code>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Account Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('account.accountSection')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {fields.map((field) => (
              <div key={field.label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <dt className="text-sm text-muted-foreground">{field.label}</dt>
                <dd className="text-sm font-medium">{field.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('account.usageTitle') ?? 'Usage & Limits'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading || !usage ? (
            <div className="h-20 flex items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* LLM Calls */}
              {usage.llmCalls.limit > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">AI Calls</span>
                    <span className="text-sm font-medium">
                      {usage.llmCalls.current} / {usage.llmCalls.limit}
                    </span>
                  </div>
                  <Progress
                    value={pct(usage.llmCalls.current, usage.llmCalls.limit)}
                    className={`h-2 ${barColor(pct(usage.llmCalls.current, usage.llmCalls.limit))}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {usage.llmCalls.limit - usage.llmCalls.current} remaining
                  </p>
                </div>
              )}
              {usage.llmCalls.limit === 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">AI Calls</span>
                  <Badge variant="secondary">Unlimited</Badge>
                </div>
              )}

              {/* Generations */}
              {usage.generationCount.limit > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Generations</span>
                    <span className="text-sm font-medium">
                      {usage.generationCount.current} / {usage.generationCount.limit}
                    </span>
                  </div>
                  <Progress
                    value={pct(usage.generationCount.current, usage.generationCount.limit)}
                    className={`h-2 ${barColor(pct(usage.generationCount.current, usage.generationCount.limit))}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {usage.generationCount.limit - usage.generationCount.current} remaining
                  </p>
                </div>
              )}
              {usage.generationCount.limit === 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Generations</span>
                  <Badge variant="secondary">Unlimited</Badge>
                </div>
              )}

              {resetTime && (
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Resets daily at {resetTime}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
