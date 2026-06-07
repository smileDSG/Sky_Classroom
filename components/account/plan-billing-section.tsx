/**
 * 套餐与账单 — 展示当前套餐详情、用量统计、套餐对比。
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Zap, Crown, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/auth-provider';
import { PLANS, type PlanType } from '@/lib/server/billing/plans';
import { UpgradeDialog } from '@/components/billing/upgrade-dialog';

interface UsageData {
  planType: string;
  llmCalls: { current: number; limit: number };
  generationCount: { current: number; limit: number };
  storageUsed: number;
  resetAt: number;
}

const PLAN_NAMES: Record<PlanType, string> = {
  free: '免费版',
  basic: '基础版',
  pro: '专业版',
  enterprise: '企业版',
};

const PLAN_STYLES: Record<PlanType, { gradient: string; badge: string; ring: string }> = {
  free: { gradient: 'from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900', badge: 'bg-slate-500', ring: 'ring-slate-200 dark:ring-slate-700' },
  basic: { gradient: 'from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40', badge: 'bg-blue-500', ring: 'ring-blue-200 dark:ring-blue-800' },
  pro: { gradient: 'from-violet-50 to-purple-50 dark:from-violet-950/40 dark:to-purple-950/40', badge: 'bg-violet-500', ring: 'ring-violet-200 dark:ring-violet-800' },
  enterprise: { gradient: 'from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40', badge: 'bg-gradient-to-r from-amber-500 to-orange-500', ring: 'ring-amber-200 dark:ring-amber-800' },
};

export function PlanBillingSection() {
  const { user } = useAuth();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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

  const currentPlan = PLANS[user.planType as PlanType] ?? PLANS.free;
  const style = PLAN_STYLES[user.planType as PlanType] ?? PLAN_STYLES.free;

  const pct = (current: number, limit: number) =>
    limit === 0 ? 0 : Math.min(100, Math.round((current / limit) * 100));
  const barColor = (p: number) =>
    p > 90 ? 'bg-red-500' : p > 70 ? 'bg-yellow-500' : 'bg-green-500';

  const resetTime = usage?.resetAt
    ? new Date(usage.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className="space-y-6">
      {/* 当前套餐卡片 */}
      <Card className={cn('border-2', style.ring)}>
        <CardHeader className={cn('bg-gradient-to-r rounded-t-lg', style.gradient)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg text-white', style.badge)}>
                <Crown className="size-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{PLAN_NAMES[user.planType as PlanType] ?? '免费版'}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {currentPlan.price === 0 ? '免费' : `¥${currentPlan.price}/月`}
                </p>
              </div>
            </div>
            <Badge className={cn('text-white', style.badge)}>
              当前套餐
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">套餐权益</h4>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {currentPlan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-4 pt-2 text-sm text-muted-foreground">
              <span>AI 调用：{currentPlan.llmCallsPerDay === 0 ? '不限量' : `${currentPlan.llmCallsPerDay}次/天`}</span>
              <span>内容生成：{currentPlan.generationsPerDay === 0 ? '不限量' : `${currentPlan.generationsPerDay}次/天`}</span>
              <span>存储空间：{currentPlan.storageLimit === 0 ? '不限量' : `${(currentPlan.storageLimit / 1073741824).toFixed(0)} GB`}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 今日用量卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="size-4 text-amber-500" />
              今日用量
            </CardTitle>
            {resetTime && (
              <span className="text-xs text-muted-foreground">{resetTime} 重置</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading || !usage ? (
            <div className="h-20 flex items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-5">
              <UsageRow
                label="AI 调用"
                current={usage.llmCalls.current}
                limit={usage.llmCalls.limit}
                pct={pct}
                barColor={barColor}
              />
              <UsageRow
                label="内容生成"
                current={usage.generationCount.current}
                limit={usage.generationCount.limit}
                pct={pct}
                barColor={barColor}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 全部套餐对比 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">全部套餐</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.values(PLANS).map((plan) => {
              const isCurrent = plan.type === user.planType;
              const planStyle = PLAN_STYLES[plan.type];

              return (
                <div
                  key={plan.type}
                  className={cn(
                    'rounded-lg border p-4 space-y-3 transition-all',
                    isCurrent
                      ? cn('border-2', planStyle.ring, 'bg-gradient-to-b', planStyle.gradient)
                      : 'hover:border-slate-300 dark:hover:border-slate-600',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{PLAN_NAMES[plan.type]}</span>
                    {isCurrent && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">当前</Badge>
                    )}
                  </div>
                  <div className="text-lg font-bold">
                    {plan.price === 0 ? '免费' : `¥${plan.price}`}
                    {plan.price > 0 && <span className="text-xs font-normal text-muted-foreground">/月</span>}
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Zap className="size-3" />
                      <span>AI：{plan.llmCallsPerDay === 0 ? '不限量' : `${plan.llmCallsPerDay}次/天`}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap className="size-3" />
                      <span>生成：{plan.generationsPerDay === 0 ? '不限量' : `${plan.generationsPerDay}次/天`}</span>
                    </div>
                  </div>
                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-1"
                      onClick={() => setUpgradeOpen(true)}
                    >
                      <ArrowUpRight className="size-3" />
                      升级
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        currentPlan={user.planType as PlanType}
      />
    </div>
  );
}

function UsageRow({
  label,
  current,
  limit,
  pct,
  barColor,
}: {
  label: string;
  current: number;
  limit: number;
  pct: (c: number, l: number) => number;
  barColor: (p: number) => string;
}) {
  const isUnlimited = limit === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {isUnlimited ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{current}</span>
            <Badge variant="secondary" className="text-[10px]">不限量</Badge>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            {current} / {limit}
          </span>
        )}
      </div>
      {isUnlimited ? (
        <div className="text-xs text-muted-foreground">
          今日已使用 {current} 次 — 你的套餐无限制
        </div>
      ) : (
        <>
          <Progress
            value={pct(current, limit)}
            className={`h-2 ${barColor(pct(current, limit))}`}
          />
          <p className="text-xs text-muted-foreground">
            剩余 {limit - current} 次
          </p>
        </>
      )}
    </div>
  );
}
