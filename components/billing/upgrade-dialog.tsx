/**
 * Upgrade dialog with plan comparison and checkout.
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
        setMessage(json.error || 'Failed to create order');
        return;
      }

      const json = await res.json();
      // Simulate payment completion
      const payRes = await fetch(json.mockPayUrl, { method: 'POST', credentials: 'include' });
      if (payRes.ok) {
        setMessage('Payment successful! Plan upgraded.');
        onPlanChanged?.();
        setTimeout(onClose, 2000);
      } else {
        setMessage('Payment failed');
      }
    } catch {
      setMessage('Network error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upgrade Plan</DialogTitle>
          <DialogDescription>Choose a plan that fits your needs</DialogDescription>
        </DialogHeader>

        {message && (
          <div className={`text-sm p-3 rounded-md ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
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
                    ¥{plan.price}/month
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>AI Calls: {plan.llmCallsPerDay === 0 ? 'Unlimited' : `${plan.llmCallsPerDay}/day`}</div>
                  <div>Generations: {plan.generationsPerDay === 0 ? 'Unlimited' : `${plan.generationsPerDay}/day`}</div>
                  <div>Storage: {plan.storageLimit === 0 ? 'Unlimited' : `${(plan.storageLimit / 1073741824).toFixed(0)} GB`}</div>
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <span className="text-xs text-muted-foreground">Current Plan</span>
                  ) : (
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => handleUpgrade(plan.type)}
                      disabled={processing}
                    >
                      {isUpgrading ? 'Processing...' : 'Upgrade'}
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
