/**
 * 升级套餐对话框 — 套餐对比与下单。
 */

'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { PLANS, type PlanType } from '@/lib/server/billing/plans';

interface UpgradeDialogProps {
  open: boolean;
  onClose: () => void;
  currentPlan: PlanType;
  onPlanChanged?: () => void;
}

export function UpgradeDialog({ open, onClose, currentPlan, onPlanChanged }: UpgradeDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpgrade = async (planType: PlanType) => {
    setSelectedPlan(planType);
    setProcessing(true);
    setMessage('');

    try {
      const res = await fetch('/api/billing/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planType, paymentMethod: 'mock' }),
      });

      if (!res.ok) {
        const json = await res.json();
        setMessage(json.error || '创建订单失败');
        return;
      }

      const json = await res.json();
      // 模拟支付完成
      const payRes = await fetch(json.mockPayUrl, { method: 'POST', credentials: 'include' });
      if (payRes.ok) {
        setMessage('支付成功！套餐已升级。');
        onPlanChanged?.();
        setTimeout(onClose, 2000);
      } else {
        setMessage('支付失败');
      }
    } catch {
      setMessage('网络错误');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>升级套餐</DialogTitle>
          <DialogDescription>选择适合你的套餐方案</DialogDescription>
        </DialogHeader>

        {message && (
          <div className={`text-sm p-3 rounded-md ${message.includes('成功') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.values(PLANS).map((plan) => {
            const isCurrent = plan.type === currentPlan;
            const isUpgrading = selectedPlan === plan.type && processing;

            return (
              <Card key={plan.type} className={isCurrent ? 'border-primary' : ''}>
                <CardHeader>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription>
                    ¥{plan.price}/月
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>AI 调用：{plan.llmCallsPerDay === 0 ? '不限量' : `${plan.llmCallsPerDay}次/天`}</div>
                  <div>内容生成：{plan.generationsPerDay === 0 ? '不限量' : `${plan.generationsPerDay}次/天`}</div>
                  <div>存储空间：{plan.storageLimit === 0 ? '不限量' : `${(plan.storageLimit / 1073741824).toFixed(0)} GB`}</div>
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <span className="text-xs text-muted-foreground">当前套餐</span>
                  ) : (
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => handleUpgrade(plan.type)}
                      disabled={processing}
                    >
                      {isUpgrading ? '处理中...' : '升级'}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
