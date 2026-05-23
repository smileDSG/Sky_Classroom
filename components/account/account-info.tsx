/**
 * Read-only account information display.
 */

'use client';

import { useAuth } from '@/components/auth/auth-provider';
import { useI18n } from '@/lib/hooks/use-i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

export function AccountInfo() {
  const { t } = useI18n();
  const { user } = useAuth();

  if (!user) return null;

  const statusInfo = STATUS_MAP[user.status] ?? { label: user.status, variant: 'default' as const };

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
  );
}
