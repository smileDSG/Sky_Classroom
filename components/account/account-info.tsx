/**
 * Read-only account information display.
 */

'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const ROLE_MAP: Record<string, string> = {
  guest: '游客',
  user: '用户',
  admin: '管理员',
};

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'destructive' }> = {
  active: { label: '正常', variant: 'default' },
  suspended: { label: '已停用', variant: 'destructive' },
};

const PLAN_MAP: Record<string, string> = {
  free: '免费版',
  basic: '基础版',
  pro: '专业版',
  enterprise: '企业版',
};

interface UsageData {
  planType: string;
  llmCalls: { current: number; limit: number };
  generationCount: { current: number; limit: number };
  storageUsed: number;
  resetAt: number;
}

export function AccountInfo() {
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
    { label: '邮箱', value: user.email ?? '—' },
    { label: '用户名', value: user.username },
    { label: '角色', value: ROLE_MAP[user.role] ?? user.role },
    {
      label: '状态',
      value: (
        <Badge variant={statusInfo.variant} className="capitalize">
          {statusInfo.label}
        </Badge>
      ),
    },
    {
      label: '套餐类型',
      value: (
        <span
          className={cn(
            'capitalize',
            user.planType !== 'free' && 'text-amber-600 dark:text-amber-400 font-medium',
          )}
        >
          {PLAN_MAP[user.planType] ?? user.planType}
        </span>
      ),
    },
    {
      label: '用户ID',
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
          <CardTitle className="text-base">{'账户信息'}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {fields.map((field) => (
              <div
                key={field.label}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
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
          <CardTitle className="text-base">{'使用额度'}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading || !usage ? (
            <div className="h-20 flex items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* AI 调用次数 */}
              {usage.llmCalls.limit > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">AI 调用</span>
                    <span className="text-sm font-medium">
                      {usage.llmCalls.current} / {usage.llmCalls.limit}
                    </span>
                  </div>
                  <Progress
                    value={pct(usage.llmCalls.current, usage.llmCalls.limit)}
                    className={`h-2 ${barColor(pct(usage.llmCalls.current, usage.llmCalls.limit))}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    剩余 {usage.llmCalls.limit - usage.llmCalls.current} 次
                  </p>
                </div>
              )}
              {usage.llmCalls.limit === 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">AI 调用</span>
                  <Badge variant="secondary">不限量</Badge>
                </div>
              )}

              {/* 课程生成次数 */}
              {usage.generationCount.limit > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">课程生成</span>
                    <span className="text-sm font-medium">
                      {usage.generationCount.current} / {usage.generationCount.limit}
                    </span>
                  </div>
                  <Progress
                    value={pct(usage.generationCount.current, usage.generationCount.limit)}
                    className={`h-2 ${barColor(pct(usage.generationCount.current, usage.generationCount.limit))}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    剩余 {usage.generationCount.limit - usage.generationCount.current} 次
                  </p>
                </div>
              )}
              {usage.generationCount.limit === 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">课程生成</span>
                  <Badge variant="secondary">不限量</Badge>
                </div>
              )}

              {resetTime && (
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  每日 {resetTime} 重置额度
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
